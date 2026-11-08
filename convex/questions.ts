import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { requireAdmin } from "./lib/auth";
import { appendAdminAudit } from "./lib/audit";
import {
  questionContent,
  validateQuestion,
  positive,
  text,
  digest,
} from "./lib/questionContent";
import {
  nextQuestionState,
  assertIndependentReviewer,
  questionState,
  questionWorkflowError as fail,
} from "./lib/questionWorkflow";

const contentArgs = {
  content: questionContent,
  taxonomyVersionId: v.id("taxonomyVersions"),
  referenceVersionId: v.optional(v.id("questionReferenceVersions")),
};
const workflowArgs = {
  questionVersionId: v.id("questionVersions"),
  expectedWorkflowRevision: v.number(),
};
/** Authorize an admin and load the exact question version at its expected workflow revision. */
async function load(
  ctx: MutationCtx,
  args: {
    questionVersionId: Id<"questionVersions">;
    expectedWorkflowRevision: number;
  },
) {
  const actor = await requireAdmin(ctx);
  const version = await ctx.db.get("questionVersions", args.questionVersionId);
  if (!version) fail("QUESTION_NOT_FOUND");
  if (
    !Number.isSafeInteger(args.expectedWorkflowRevision) ||
    args.expectedWorkflowRevision !== version.workflowRevision
  )
    fail("STALE_REVISION");
  const question = await ctx.db.get("questions", version.questionId);
  if (!question) fail("QUESTION_NOT_FOUND");
  return { actor, version, question };
}
/** Find bounded duplicate candidates while excluding all versions of this canonical question. */
async function candidates(
  ctx: Pick<QueryCtx, "db">,
  version: { contentFingerprint: string; questionId: Id<"questions"> },
  reportOverflow = false,
) {
  // Two bounded index ranges exclude all revisions of this canonical question.
  const lower = await ctx.db
    .query("questionVersions")
    .withIndex("by_contentFingerprint_and_questionId", (q) =>
      q
        .eq("contentFingerprint", version.contentFingerprint)
        .lt("questionId", version.questionId),
    )
    .take(51);
  const upper = await ctx.db
    .query("questionVersions")
    .withIndex("by_contentFingerprint_and_questionId", (q) =>
      q
        .eq("contentFingerprint", version.contentFingerprint)
        .gt("questionId", version.questionId),
    )
    .take(51);
  const rows = [...lower, ...upper];
  if (rows.length > 50 && !reportOverflow) fail("DUPLICATE_OVERFLOW");
  const ids = [
    ...new Set(
      rows
        .slice(0, 50)
        .filter((r) => r.questionId !== version.questionId)
        .map((r) => r.questionId),
    ),
  ].sort();
  const versions = rows
    .slice(0, 50)
    .filter((r) => r.questionId !== version.questionId)
    .map((r) => ({ id: r._id, contentHash: r.contentHash }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    ids,
    fingerprint: await digest(versions),
    overflow: rows.length > 50,
  };
}
/** Atomically transition workflow state and append its admin audit event. */
async function change(
  ctx: MutationCtx,
  version: Awaited<ReturnType<typeof load>>["version"],
  action: Parameters<typeof nextQuestionState>[3],
  reason?: string,
) {
  const next = nextQuestionState(
    version.state,
    version.workflowRevision,
    version.workflowRevision,
    action,
    reason,
  );
  await ctx.db.patch("questionVersions", version._id, next);
  await appendAdminAudit(ctx, {
    entityType: "question_version",
    entityId: version._id,
    action,
    before: { state: version.state, revision: version.workflowRevision },
    after: { state: next.state, revision: next.workflowRevision },
  });
  return next.workflowRevision;
}
/** Create an attributed canonical question and its initial immutable draft. */
export const createDraft = mutation({
  args: { questionId: v.string(), ...contentArgs },
  returns: v.id("questionVersions"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    text(args.questionId);
    if (args.questionId.length > 100) fail("VALIDATION_FAILED");
    if (
      await ctx.db
        .query("questions")
        .withIndex("by_questionId", (q) => q.eq("questionId", args.questionId))
        .unique()
    )
      fail("CONTENT_CONFLICT");
    const hashes = await validateQuestion(
      ctx,
      args.content,
      args.taxonomyVersionId,
      args.referenceVersionId,
    );
    const id = await ctx.db.insert("questions", {
      questionId: args.questionId,
      contributorId: actor._id,
      family: args.content.family,
      latestVersion: 1,
      revision: 1,
      createdAt: Date.now(),
    });
    const versionId = await ctx.db.insert("questionVersions", {
      questionId: id,
      version: 1,
      content: args.content,
      taxonomyVersionId: args.taxonomyVersionId,
      ...(args.referenceVersionId
        ? { referenceVersionId: args.referenceVersionId }
        : {}),
      ...hashes,
      creatorId: actor._id,
      createdAt: Date.now(),
      state: "draft",
      workflowRevision: 1,
    });
    await appendAdminAudit(ctx, {
      entityType: "question_version",
      entityId: versionId,
      action: "create",
      before: null,
      after: {
        questionId: args.questionId,
        version: 1,
        contentHash: hashes.contentHash,
      },
    });
    return versionId;
  },
});
/** Append a corrected draft without changing prior content or original attribution. */
export const createRevision = mutation({
  args: {
    questionId: v.id("questions"),
    expectedCanonicalRevision: v.number(),
    ...contentArgs,
  },
  returns: v.id("questionVersions"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    positive(args.expectedCanonicalRevision);
    const question = await ctx.db.get("questions", args.questionId);
    if (!question) fail("QUESTION_NOT_FOUND");
    if (question.revision !== args.expectedCanonicalRevision)
      fail("STALE_REVISION");
    if (question.family !== args.content.family) fail("CONTENT_CONFLICT");
    const hashes = await validateQuestion(
      ctx,
      args.content,
      args.taxonomyVersionId,
      args.referenceVersionId,
    );
    const version = question.latestVersion + 1;
    positive(version);
    const id = await ctx.db.insert("questionVersions", {
      questionId: question._id,
      version,
      content: args.content,
      taxonomyVersionId: args.taxonomyVersionId,
      ...(args.referenceVersionId
        ? { referenceVersionId: args.referenceVersionId }
        : {}),
      ...hashes,
      creatorId: actor._id,
      createdAt: Date.now(),
      state: "draft",
      workflowRevision: 1,
    });
    await ctx.db.patch("questions", question._id, {
      latestVersion: version,
      revision: question.revision + 1,
    });
    await appendAdminAudit(ctx, {
      entityType: "question_version",
      entityId: id,
      action: "revise",
      before: null,
      after: { version, contentHash: hashes.contentHash },
    });
    return id;
  },
});
/** Submit a validated draft only for its authorized contributor or material editor. */
export const submitForReview = mutation({
  args: workflowArgs,
  returns: v.number(),
  handler: async (ctx, args) => {
    const { actor, version, question } = await load(ctx, args);
    if (actor._id !== question.contributorId && actor._id !== version.creatorId)
      fail("FORBIDDEN");
    await validateQuestion(
      ctx,
      version.content,
      version.taxonomyVersionId,
      version.referenceVersionId,
    );
    return change(ctx, version, "submit");
  },
});
const disposition = v.union(
  v.literal("none_found"),
  v.literal("adjudicated_distinct"),
  v.literal("unresolved"),
);
/** Record an independent version-specific review and its atomic state transition. */
export const reviewVersion = mutation({
  args: {
    ...workflowArgs,
    decision: v.union(
      v.literal("approve"),
      v.literal("needs_revision"),
      v.literal("reject"),
    ),
    reason: v.string(),
    assessment: v.array(
      v.object({ passed: v.boolean(), evidence: v.string() }),
    ),
    duplicateDisposition: disposition,
    duplicateEvidence: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { actor, version, question } = await load(ctx, args);
    assertIndependentReviewer(
      actor._id,
      question.contributorId,
      version.creatorId,
    );
    nextQuestionState(
      version.state,
      version.workflowRevision,
      args.expectedWorkflowRevision,
      args.decision,
      args.reason,
    );
    const score = args.assessment.filter((a) => a.passed).length;
    if (
      args.assessment.length !== 5 ||
      args.assessment.some((a) => !a.evidence.trim())
    )
      fail("VALIDATION_FAILED");
    text(args.duplicateEvidence);
    const duplicate = await candidates(
      ctx,
      version,
      args.decision !== "approve",
    );
    if (args.decision === "approve") {
      await validateQuestion(
        ctx,
        version.content,
        version.taxonomyVersionId,
        version.referenceVersionId,
      );
      if (
        score !== 5 ||
        args.duplicateDisposition === "unresolved" ||
        (duplicate.ids.length &&
          args.duplicateDisposition !== "adjudicated_distinct")
      )
        fail("VALIDATION_FAILED");
    }
    const reviewId = await ctx.db.insert("questionReviews", {
      questionVersionId: version._id,
      reviewerId: actor._id,
      kind: "review",
      decision: args.decision,
      expectedRevision: version.workflowRevision,
      resultingRevision: version.workflowRevision + 1,
      reason: args.reason,
      assessment: args.assessment,
      rubric: "editorial-quality-v1",
      score,
      duplicateDisposition: args.duplicateDisposition,
      duplicateEvidence: args.duplicateEvidence,
      candidateFingerprint: duplicate.fingerprint,
      decidedAt: Date.now(),
    });
    if (args.decision === "approve")
      await ctx.db.patch("questionVersions", version._id, {
        approvalDecisionId: reviewId,
      });
    return change(ctx, version, args.decision, args.reason);
  },
});
/** Publish only after rechecking approval, quality, duplicates and immutable content integrity. */
export const publishVersion = mutation({
  args: workflowArgs,
  returns: v.number(),
  handler: async (ctx, args) => {
    const { version, question } = await load(ctx, args);
    const approval = version.approvalDecisionId
      ? await ctx.db.get("questionReviews", version.approvalDecisionId)
      : null;
    if (
      !approval ||
      approval.questionVersionId !== version._id ||
      approval.decision !== "approve" ||
      approval.score !== 5
    )
      fail("VALIDATION_FAILED");
    assertIndependentReviewer(
      approval.reviewerId,
      question.contributorId,
      version.creatorId,
    );
    const hashes = await validateQuestion(
      ctx,
      version.content,
      version.taxonomyVersionId,
      version.referenceVersionId,
    );
    if (hashes.contentHash !== version.contentHash) fail("CONTENT_CONFLICT");
    const duplicate = await candidates(ctx, version);
    if (duplicate.fingerprint !== approval.candidateFingerprint) {
      const latest = await ctx.db
        .query("questionReviews")
        .withIndex("by_questionVersionId", (q) =>
          q.eq("questionVersionId", version._id),
        )
        .order("desc")
        .first();
      if (
        !latest ||
        latest.kind !== "duplicate_recheck" ||
        latest.candidateFingerprint !== duplicate.fingerprint ||
        latest.duplicateDisposition === "unresolved"
      )
        fail("DUPLICATE_RECHECK_REQUIRED");
      assertIndependentReviewer(
        latest.reviewerId,
        question.contributorId,
        version.creatorId,
      );
    }
    return change(ctx, version, "publish");
  },
});
/** Record an independent recheck of the current duplicate candidate fingerprint. */
export const reviewDuplicateCandidates = mutation({
  args: {
    ...workflowArgs,
    candidateSetFingerprint: v.string(),
    disposition,
    evidence: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { actor, version, question } = await load(ctx, args);
    assertIndependentReviewer(
      actor._id,
      question.contributorId,
      version.creatorId,
    );
    if (version.state !== "approved") fail("INVALID_TRANSITION");
    const duplicate = await candidates(ctx, version);
    text(args.evidence);
    if (duplicate.fingerprint !== args.candidateSetFingerprint)
      fail("STALE_REVISION");
    if (
      args.disposition === "unresolved" ||
      (duplicate.ids.length && args.disposition !== "adjudicated_distinct")
    )
      fail("VALIDATION_FAILED");
    await ctx.db.insert("questionReviews", {
      questionVersionId: version._id,
      reviewerId: actor._id,
      kind: "duplicate_recheck",
      decision: "duplicate_recheck",
      expectedRevision: version.workflowRevision,
      resultingRevision: version.workflowRevision + 1,
      reason: args.evidence,
      rubric: "editorial-quality-v1",
      duplicateDisposition: args.disposition,
      duplicateEvidence: args.evidence,
      candidateFingerprint: duplicate.fingerprint,
      decidedAt: Date.now(),
    });
    await ctx.db.patch("questionVersions", version._id, {
      workflowRevision: version.workflowRevision + 1,
    });
    await appendAdminAudit(ctx, {
      entityType: "question_version",
      entityId: version._id,
      action: "duplicate_recheck",
      before: { revision: version.workflowRevision },
      after: {
        revision: version.workflowRevision + 1,
        candidateFingerprint: duplicate.fingerprint,
      },
    });
    return version.workflowRevision + 1;
  },
});
/** Remove an approved or published version from future eligibility without deleting history. */
export const archiveVersion = mutation({
  args: workflowArgs,
  returns: v.number(),
  handler: async (ctx, args) =>
    change(ctx, (await load(ctx, args)).version, "archive"),
});
/** Return full admin review context with bounded review and duplicate histories. */
export const getAdminVersion = query({
  args: { questionVersionId: v.id("questionVersions") },
  returns: v.union(
    v.null(),
    v.object({
      version: schema.doc("questionVersions"),
      question: schema.doc("questions"),
      reference: v.union(v.null(), schema.doc("questionReferenceVersions")),
      reviews: v.array(schema.doc("questionReviews")),
      reviewOverflow: v.boolean(),
      duplicates: v.object({
        ids: v.array(v.id("questions")),
        fingerprint: v.string(),
        overflow: v.boolean(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const version = await ctx.db.get(
      "questionVersions",
      args.questionVersionId,
    );
    if (!version) return null;
    const question = await ctx.db.get("questions", version.questionId);
    if (!question) fail("QUESTION_NOT_FOUND");
    const reviews = await ctx.db
      .query("questionReviews")
      .withIndex("by_questionVersionId", (q) =>
        q.eq("questionVersionId", version._id),
      )
      .order("desc")
      .take(51);
    return {
      version,
      question,
      reference: version.referenceVersionId
        ? await ctx.db.get(
            "questionReferenceVersions",
            version.referenceVersionId,
          )
        : null,
      reviews: reviews.slice(0, 50),
      reviewOverflow: reviews.length > 50,
      duplicates: await candidates(ctx, version, true),
    };
  },
});
/** Return an indexed page of question versions to an active admin. */
export const listAdminVersions = query({
  args: {
    state: v.optional(questionState),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("questionVersions")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      fail("INVALID_PAGE_SIZE");
    return ctx.db
      .query("questionVersions")
      .withIndex("by_state", (q) =>
        args.state ? q.eq("state", args.state) : q,
      )
      .paginate(args.paginationOpts);
  },
});

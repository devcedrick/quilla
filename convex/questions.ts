import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
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
  questionState,
  assertIndependentReviewer,
  questionWorkflowError as fail,
} from "./lib/questionWorkflow";
import {
  workflowArgs,
  loadWorkflow,
  changeWorkflow,
  safeWorkflowFailure,
} from "./lib/questionLifecycle";
import { bulkModerationBatchSize } from "../lib/question-import-contract.mjs";

const contentArgs = {
  content: questionContent,
  taxonomyVersionId: v.id("taxonomyVersions"),
  referenceVersionId: v.optional(v.id("questionReferenceVersions")),
};
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
    const { actor, version, question } = await loadWorkflow(ctx, args);
    if (actor._id !== question.contributorId && actor._id !== version.creatorId)
      fail("FORBIDDEN");
    await validateQuestion(
      ctx,
      version.content,
      version.taxonomyVersionId,
      version.referenceVersionId,
    );
    return changeWorkflow(ctx, version, "submit");
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
    const { actor, version, question } = await loadWorkflow(ctx, args);
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
    return changeWorkflow(ctx, version, args.decision, args.reason);
  },
});
/** Recheck and publish one approved version inside the caller's transaction. */
async function publishOne(
  ctx: Parameters<typeof changeWorkflow>[0],
  version: Awaited<ReturnType<typeof loadWorkflow>>["version"],
  question: Awaited<ReturnType<typeof loadWorkflow>>["question"],
) {
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
  return changeWorkflow(ctx, version, "publish");
}
/** Publish only after rechecking approval, quality, duplicates and immutable content integrity. */
export const publishVersion = mutation({
  args: workflowArgs,
  returns: v.number(),
  handler: async (ctx, args) => {
    const { version, question } = await loadWorkflow(ctx, args);
    return publishOne(ctx, version, question);
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
    const { actor, version, question } = await loadWorkflow(ctx, args);
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
    changeWorkflow(ctx, (await loadWorkflow(ctx, args)).version, "archive"),
});
const bulkResult = v.array(
  v.object({
    questionVersionId: v.id("questionVersions"),
    workflowRevision: v.optional(v.number()),
    code: v.optional(v.string()),
  }),
);
/** Run each item in its own error boundary after one authorization check. */
async function runBulk(
  ctx: Parameters<typeof changeWorkflow>[0],
  items: Array<{
    questionVersionId: Id<"questionVersions">;
    expectedWorkflowRevision: number;
  }>,
  operation: (
    ctx: Parameters<typeof changeWorkflow>[0],
    actor: Awaited<ReturnType<typeof requireAdmin>>,
    item: (typeof items)[number],
  ) => Promise<number>,
) {
  const actor = await requireAdmin(ctx);
  if (!items.length || items.length > bulkModerationBatchSize)
    fail("INVALID_BATCH");
  const results: Array<{
    questionVersionId: Id<"questionVersions">;
    workflowRevision?: number;
    code?: string;
  }> = [];
  for (const item of items) {
    try {
      results.push({
        questionVersionId: item.questionVersionId,
        workflowRevision: await operation(ctx, actor, item),
      });
    } catch (error) {
      const code = safeWorkflowFailure(error);
      // Unexpected failures must abort the transaction rather than commit an
      // item whose audit event or invariant could not be completed.
      if (code === "OPERATION_FAILED") throw error;
      results.push({
        questionVersionId: item.questionVersionId,
        code,
      });
    }
  }
  return results;
}
/** Submit up to ten drafts and report each item's independent outcome. */
export const bulkSubmitForReview = mutation({
  args: { items: v.array(v.object(workflowArgs)) },
  returns: bulkResult,
  handler: async (ctx, args) =>
    runBulk(ctx, args.items, async (ctx, actor, item) => {
      const { version, question } = await loadWorkflow(ctx, item, actor);
      if (
        actor._id !== question.contributorId &&
        actor._id !== version.creatorId
      )
        fail("FORBIDDEN");
      await validateQuestion(
        ctx,
        version.content,
        version.taxonomyVersionId,
        version.referenceVersionId,
      );
      return changeWorkflow(ctx, version, "submit");
    }),
});
/** Publish up to ten approved versions with the same per-version checks. */
export const bulkPublishVersions = mutation({
  args: { items: v.array(v.object(workflowArgs)) },
  returns: bulkResult,
  handler: async (ctx, args) =>
    runBulk(ctx, args.items, async (ctx, actor, item) => {
      const { version, question } = await loadWorkflow(ctx, item, actor);
      return publishOne(ctx, version, question);
    }),
});
/** Archive up to ten approved or published versions without deleting history. */
export const bulkArchiveVersions = mutation({
  args: { items: v.array(v.object(workflowArgs)) },
  returns: bulkResult,
  handler: async (ctx, args) =>
    runBulk(ctx, args.items, async (ctx, actor, item) => {
      const { version } = await loadWorkflow(ctx, item, actor);
      return changeWorkflow(ctx, version, "archive");
    }),
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

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { requireAdmin } from "./lib/auth";
import { appendAdminAudit } from "./lib/audit";
import { validateQuestion } from "./lib/questionContent";
import {
  assertIndependentReviewer,
  questionWorkflowError as fail,
} from "./lib/questionWorkflow";
import { changeWorkflow } from "./lib/questionLifecycle";
import { entryAt } from "./lib/questionImportState";
import {
  assertSeedManifests,
  requireSeedTarget,
  resolveSeedApprover,
  seedAccess,
  seedBatch,
  seedChecksum,
  seedLeaseMs,
  seedLeasedRun,
  seedRunForActor,
} from "./lib/seedPublicationProtocol";
import {
  safeSeedFailure,
  seedPublicationPolicy,
  seedStageBatchSize,
} from "../lib/question-import-contract.mjs";

const stageItem = v.object({ ordinal: v.number(), importOrdinal: v.number() });
const versionIds = v.array(v.id("questionVersions"));
const runFields = {
  target: v.string(),
  runId: v.id("seedPublicationRuns"),
};

/** Resolve the exact completed import plan and the two participating admins. */
async function beginRun(
  ctx: Parameters<typeof changeWorkflow>[0],
  args: {
    target: string;
    importRunId: Id<"questionImportRuns">;
    planChecksum: string;
    inventoryHash: string;
    resumeRunId?: Id<"seedPublicationRuns">;
  },
) {
  const actor = await requireAdmin(ctx);
  const targetUrl = requireSeedTarget(args.target);
  seedChecksum(args.planChecksum);
  seedChecksum(args.inventoryHash);
  if (process.env.SEED_PUBLICATION_PLAN_CHECKSUM !== args.planChecksum)
    fail("SEED_PLAN_MISMATCH");
  const importRun = await ctx.db.get("questionImportRuns", args.importRunId);
  if (!importRun || importRun.target !== args.target)
    fail("SEED_IMPORT_REQUIRED");
  if (importRun.ownerId !== actor._id) fail("SEED_RUN_FORBIDDEN");
  if (importRun.state !== "complete") fail("SEED_IMPORT_REQUIRED");
  if (
    importRun.planChecksum !== args.planChecksum ||
    importRun.inventoryHash !== args.inventoryHash
  )
    fail("SEED_IMPORT_MISMATCH");
  const policy = seedPublicationPolicy;
  const expectedRecords =
    policy.expectedQuestions +
    policy.expectedReferences +
    policy.expectedAssets;
  if (
    importRun.expected !== expectedRecords ||
    importRun.staged !== expectedRecords ||
    importRun.processed !== expectedRecords
  )
    fail("SEED_POLICY_MISMATCH");
  assertSeedManifests(importRun.manifests);
  const approver = await resolveSeedApprover(ctx, actor._id);
  const same = args.resumeRunId
    ? await ctx.db.get("seedPublicationRuns", args.resumeRunId)
    : await ctx.db
        .query("seedPublicationRuns")
        .withIndex("by_target_and_planChecksum", (q) =>
          q.eq("target", args.target).eq("planChecksum", args.planChecksum),
        )
        .unique();
  if (same) {
    if (
      same.importerId !== actor._id ||
      same.planChecksum !== args.planChecksum ||
      same.importRunId !== importRun._id
    )
      fail("SEED_RUN_FORBIDDEN");
    if (same.state === "complete" || same.state === "rolled_back")
      return { runId: same._id, generation: same.generation };
    if (same.rolledBack > 0) fail("SEED_ALREADY_ROLLED_BACK");
    if (same.approverId !== approver._id) fail("SEED_APPROVER_MISMATCH");
    if (same.state !== "paused" && same.leaseUntil > Date.now())
      fail("SEED_BUSY");
    await ctx.db.patch("seedPublicationRuns", same._id, {
      generation: same.generation + 1,
      state: same.staged === same.expected ? "running" : "preparing",
      leaseUntil: Date.now() + seedLeaseMs,
      updatedAt: Date.now(),
      lastFailure: undefined,
    });
    await appendAdminAudit(ctx, {
      entityType: "seed_publication",
      entityId: same._id,
      action: "resume",
      before: { generation: same.generation, state: same.state },
      after: { generation: same.generation + 1 },
    });
    return { runId: same._id, generation: same.generation + 1 };
  }
  const prior = await ctx.db
    .query("seedPublicationRuns")
    .withIndex("by_target_and_planChecksum", (q) => q.eq("target", args.target))
    .first();
  if (prior) fail("SEED_PLAN_MISMATCH");
  const active = await ctx.db
    .query("seedPublicationRuns")
    .withIndex("by_targetUrl_and_leaseUntil", (q) =>
      q.eq("targetUrl", targetUrl).gt("leaseUntil", Date.now()),
    )
    .first();
  if (active) fail("SEED_BUSY");
  const runId = await ctx.db.insert("seedPublicationRuns", {
    target: args.target,
    targetUrl,
    importRunId: importRun._id,
    planChecksum: args.planChecksum,
    inventoryHash: args.inventoryHash,
    importerId: actor._id,
    approverId: approver._id,
    expected: policy.expectedQuestions,
    staged: 0,
    submitted: 0,
    approved: 0,
    published: 0,
    rolledBack: 0,
    stagedCounts: importRun.manifests
      .map((pin) => ({ family: pin.family, questions: 0 }))
      .sort((a, b) => a.family - b.family),
    state: "preparing",
    generation: 1,
    leaseUntil: Date.now() + seedLeaseMs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  await appendAdminAudit(ctx, {
    entityType: "seed_publication",
    entityId: runId,
    action: "begin",
    before: null,
    after: {
      importRunId: importRun._id,
      planChecksum: args.planChecksum,
      expected: policy.expectedQuestions,
      target: args.target,
    },
  });
  return { runId, generation: 1 };
}

/** Acquire or resume the one-time seed publication run. */
export const begin = mutation({
  args: {
    target: v.string(),
    importRunId: v.id("questionImportRuns"),
    planChecksum: v.string(),
    inventoryHash: v.string(),
    resumeRunId: v.optional(v.id("seedPublicationRuns")),
  },
  returns: v.object({
    runId: v.id("seedPublicationRuns"),
    generation: v.number(),
  }),
  handler: beginRun,
});

/** Pin an ordered batch of draft versions produced by the completed import. */
export const stage = mutation({
  args: { ...seedAccess, items: v.array(stageItem) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedLeasedRun(ctx, args, "importer");
    seedBatch(args.items, seedStageBatchSize);
    if (run.state === "running") {
      for (const item of args.items) {
        const prior = await ctx.db
          .query("seedPublicationItems")
          .withIndex("by_runId_and_ordinal", (q) =>
            q.eq("runId", run._id).eq("ordinal", item.ordinal),
          )
          .unique();
        if (!prior || prior.importOrdinal !== item.importOrdinal)
          fail("SEED_NOT_PREPARING");
      }
      return null;
    }
    if (run.state !== "preparing") fail("SEED_NOT_PREPARING");
    let staged = run.staged;
    const counts = run.stagedCounts.map((count) => ({ ...count }));
    const now = Date.now();
    for (const item of args.items) {
      if (
        !Number.isSafeInteger(item.ordinal) ||
        !Number.isSafeInteger(item.importOrdinal) ||
        item.ordinal < 0 ||
        item.importOrdinal < 0
      )
        fail("SEED_ORDER");
      const prior = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_ordinal", (q) =>
          q.eq("runId", run._id).eq("ordinal", item.ordinal),
        )
        .unique();
      if (prior) {
        if (prior.importOrdinal !== item.importOrdinal)
          fail("SEED_NOT_PREPARING");
        continue;
      }
      if (item.ordinal !== staged) fail("SEED_ORDER");
      const entry = await entryAt(ctx, run.importRunId, item.importOrdinal);
      if (
        !entry ||
        entry.kind !== "question" ||
        entry.state !== "done" ||
        !entry.resultId
      )
        fail("SEED_IMPORT_MISMATCH");
      const duplicate = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_importOrdinal", (q) =>
          q.eq("runId", run._id).eq("importOrdinal", item.importOrdinal),
        )
        .unique();
      if (duplicate) fail("SEED_DUPLICATE_ITEM");
      const version = await ctx.db.get(
        "questionVersions",
        entry.resultId as Id<"questionVersions">,
      );
      if (!version) fail("SEED_ITEM_UNAVAILABLE");
      const question = await ctx.db.get("questions", version.questionId);
      if (!question) fail("SEED_ITEM_UNAVAILABLE");
      if (
        version.state !== "draft" ||
        version.creatorId !== run.importerId ||
        version.version !== entry.version ||
        version.content.family !== entry.family ||
        question.family !== entry.family
      )
        fail("SEED_ITEM_UNAVAILABLE");
      const pinned = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_questionVersionId", (q) =>
          q.eq("questionVersionId", version._id),
        )
        .first();
      if (pinned) fail("SEED_DUPLICATE_ITEM");
      const count = counts.find((value) => value.family === entry.family);
      if (!count) fail("SEED_POLICY_MISMATCH");
      count.questions++;
      if (count.questions > seedPublicationPolicy.perFamilyQuestions)
        fail("SEED_POLICY_MISMATCH");
      await ctx.db.insert("seedPublicationItems", {
        runId: run._id,
        ordinal: staged,
        importOrdinal: entry.ordinal,
        questionVersionId: version._id,
        questionId: question._id,
        family: entry.family,
        sourceId: entry.sourceId,
        sourceChecksum: entry.sourceChecksum,
        state: "staged",
        stagedAt: now,
        transitionedAt: now,
      });
      staged++;
    }
    if (staged !== run.staged) {
      const complete = staged === run.expected;
      if (
        complete &&
        counts.some(
          (count) =>
            count.questions !== seedPublicationPolicy.perFamilyQuestions,
        )
      )
        fail("SEED_POLICY_MISMATCH");
      await ctx.db.patch("seedPublicationRuns", run._id, {
        staged,
        stagedCounts: counts,
        state: complete ? "running" : "preparing",
        leaseUntil: Date.now() + seedLeaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "seed_publication",
        entityId: run._id,
        action: "stage",
        before: { staged: run.staged },
        after: { staged },
      });
    }
    return null;
  },
});

/** Submit pinned drafts in bounded batches for the independent seed approval. */
export const submit = mutation({
  args: { ...seedAccess, questionVersionIds: versionIds },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedLeasedRun(ctx, args, "importer");
    seedBatch(args.questionVersionIds);
    if (run.state !== "running" || run.staged !== run.expected)
      fail("SEED_NOT_RUNNING");
    let submitted = 0;
    const now = Date.now();
    for (const questionVersionId of args.questionVersionIds) {
      const item = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_questionVersionId", (q) =>
          q.eq("runId", run._id).eq("questionVersionId", questionVersionId),
        )
        .unique();
      if (!item) fail("SEED_ITEM_UNAVAILABLE");
      if (item.state !== "staged") {
        if (item.state === "rolled_back") fail("SEED_ITEM_UNAVAILABLE");
        continue;
      }
      const version = await ctx.db.get(
        "questionVersions",
        item.questionVersionId,
      );
      if (!version || version.state !== "draft") fail("SEED_ITEM_UNAVAILABLE");
      const hashes = await validateQuestion(
        ctx,
        version.content,
        version.taxonomyVersionId,
        version.referenceVersionId,
      );
      if (hashes.contentHash !== version.contentHash) fail("CONTENT_CONFLICT");
      await changeWorkflow(ctx, version, "submit");
      await ctx.db.patch("seedPublicationItems", item._id, {
        state: "submitted",
        transitionedAt: now,
      });
      submitted++;
    }
    if (submitted) {
      await ctx.db.patch("seedPublicationRuns", run._id, {
        submitted: run.submitted + submitted,
        leaseUntil: Date.now() + seedLeaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "seed_publication",
        entityId: run._id,
        action: "submit",
        before: { submitted: run.submitted },
        after: { submitted: run.submitted + submitted },
      });
    }
    return null;
  },
});

/** Record plan-level seed acceptance and approve submitted versions. */
export const approve = mutation({
  args: { ...seedAccess, questionVersionIds: versionIds },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedLeasedRun(ctx, args, "approver");
    seedBatch(args.questionVersionIds);
    if (
      run.state !== "running" ||
      run.staged !== run.expected ||
      run.submitted !== run.expected
    )
      fail("SEED_APPROVAL_ORDER");
    const policy = seedPublicationPolicy;
    let approved = 0;
    const now = Date.now();
    for (const questionVersionId of args.questionVersionIds) {
      const item = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_questionVersionId", (q) =>
          q.eq("runId", run._id).eq("questionVersionId", questionVersionId),
        )
        .unique();
      if (!item) fail("SEED_ITEM_UNAVAILABLE");
      if (item.state === "approved") continue;
      if (item.state !== "submitted") fail("SEED_APPROVAL_REQUIRED");
      const version = await ctx.db.get(
        "questionVersions",
        item.questionVersionId,
      );
      if (!version || version.state !== "pending_review")
        fail("SEED_APPROVAL_REQUIRED");
      const question = await ctx.db.get("questions", version.questionId);
      if (!question) fail("SEED_ITEM_UNAVAILABLE");
      assertIndependentReviewer(
        run.approverId,
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
      const assessment = [
        {
          passed: true,
          evidence: `Completed import run ${run.importRunId} processed the pinned inventory.`,
        },
        {
          passed: true,
          evidence: `Plan checksum ${run.planChecksum} and inventory checksum ${run.inventoryHash} match the one-time seed target.`,
        },
        {
          passed: true,
          evidence: `Policy: ${policy.families} families x ${policy.perFamilyQuestions} questions = ${policy.expectedQuestions}; ${policy.expectedReferences} references; ${policy.expectedAssets} images.`,
        },
        {
          passed: true,
          evidence: `Version content hash ${version.contentHash} was revalidated against the sealed taxonomy and exact reference.`,
        },
        {
          passed: true,
          evidence: `Approver ${run.approverId} is independent of importer ${run.importerId} and contributor ${question.contributorId}.`,
        },
      ];
      const reviewId = await ctx.db.insert("questionReviews", {
        questionVersionId: version._id,
        reviewerId: run.approverId,
        kind: "seed_acceptance",
        decision: "accept",
        expectedRevision: version.workflowRevision,
        resultingRevision: version.workflowRevision + 1,
        reason: `One-time seed bootstrap acceptance for plan ${run.planChecksum} under ADR 0022.`,
        rubric: "seed-bootstrap-v1",
        score: 5,
        assessment,
        seedRunId: run._id,
        planChecksum: run.planChecksum,
        decidedAt: now,
      });
      await ctx.db.patch("questionVersions", version._id, {
        approvalDecisionId: reviewId,
      });
      await changeWorkflow(ctx, version, "approve");
      await ctx.db.patch("seedPublicationItems", item._id, {
        state: "approved",
        approvalId: reviewId,
        transitionedAt: now,
      });
      approved++;
    }
    if (approved) {
      await ctx.db.patch("seedPublicationRuns", run._id, {
        approved: run.approved + approved,
        leaseUntil: Date.now() + seedLeaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "seed_publication",
        entityId: run._id,
        action: "approve",
        before: { approved: run.approved },
        after: { approved: run.approved + approved },
      });
    }
    return null;
  },
});

/** Publish approved seed versions; completion releases the lease and enables serving. */
export const publish = mutation({
  args: { ...seedAccess, questionVersionIds: versionIds },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedLeasedRun(ctx, args, "approver");
    seedBatch(args.questionVersionIds);
    if (run.state !== "running" || run.approved !== run.expected)
      fail("SEED_APPROVAL_ORDER");
    let published = 0;
    const now = Date.now();
    for (const questionVersionId of args.questionVersionIds) {
      const item = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_questionVersionId", (q) =>
          q.eq("runId", run._id).eq("questionVersionId", questionVersionId),
        )
        .unique();
      if (!item) fail("SEED_ITEM_UNAVAILABLE");
      if (item.state === "published") continue;
      if (item.state !== "approved" || !item.approvalId)
        fail("SEED_APPROVAL_REQUIRED");
      const version = await ctx.db.get(
        "questionVersions",
        item.questionVersionId,
      );
      if (!version || version.state !== "approved")
        fail("SEED_APPROVAL_REQUIRED");
      const approval = await ctx.db.get("questionReviews", item.approvalId);
      if (
        !approval ||
        approval.questionVersionId !== version._id ||
        approval.kind !== "seed_acceptance" ||
        approval.decision !== "accept" ||
        approval.rubric !== "seed-bootstrap-v1" ||
        approval.score !== 5 ||
        approval.seedRunId !== run._id ||
        approval.planChecksum !== run.planChecksum ||
        approval.reviewerId !== run.approverId
      )
        fail("SEED_APPROVAL_REQUIRED");
      const question = await ctx.db.get("questions", version.questionId);
      if (!question) fail("SEED_ITEM_UNAVAILABLE");
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
      await changeWorkflow(ctx, version, "publish");
      await ctx.db.patch("seedPublicationItems", item._id, {
        state: "published",
        transitionedAt: now,
      });
      published++;
    }
    if (published) {
      const total = run.published + published;
      if (total > run.expected) fail("SEED_APPROVAL_ORDER");
      const complete = total === run.expected;
      await ctx.db.patch("seedPublicationRuns", run._id, {
        published: total,
        state: complete ? "complete" : "running",
        leaseUntil: complete ? 0 : Date.now() + seedLeaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "seed_publication",
        entityId: run._id,
        action: complete ? "complete" : "publish",
        before: { published: run.published },
        after: {
          published: total,
          ...(complete ? { planChecksum: run.planChecksum } : {}),
        },
      });
    }
    return null;
  },
});

/** Release the lease without undoing staged versions or recorded approvals. */
export const pause = mutation({
  args: { ...runFields, code: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedRunForActor(ctx, args, "either");
    if (run.state === "complete" || run.state === "rolled_back")
      fail("SEED_INVALID_STATE");
    if (args.code && safeSeedFailure(args.code) !== args.code)
      fail("SEED_INVALID_STATE");
    if (run.state === "paused") {
      if (args.code && args.code !== run.lastFailure)
        await ctx.db.patch("seedPublicationRuns", run._id, {
          lastFailure: args.code,
          updatedAt: Date.now(),
        });
      return null;
    }
    await ctx.db.patch("seedPublicationRuns", run._id, {
      state: "paused",
      leaseUntil: 0,
      updatedAt: Date.now(),
      ...(args.code ? { lastFailure: args.code } : {}),
    });
    await appendAdminAudit(ctx, {
      entityType: "seed_publication",
      entityId: run._id,
      action: "pause",
      before: { state: run.state, staged: run.staged },
      after: { state: "paused", code: args.code ?? null },
    });
    return null;
  },
});

/** Return bounded operational status without content, answers or credentials. */
export const status = query({
  args: {
    target: v.string(),
    runId: v.id("seedPublicationRuns"),
    after: v.number(),
  },
  returns: v.object({
    run: schema.doc("seedPublicationRuns"),
    items: v.array(schema.doc("seedPublicationItems")),
  }),
  handler: async (ctx, args) => {
    const { run } = await seedRunForActor(ctx, args, "either");
    if (!Number.isSafeInteger(args.after) || args.after < -1)
      fail("SEED_INVALID_CHECKPOINT");
    const items = await ctx.db
      .query("seedPublicationItems")
      .withIndex("by_runId_and_ordinal", (q) =>
        q.eq("runId", run._id).gt("ordinal", args.after),
      )
      .take(100);
    return { run, items };
  },
});

/** Archive published or staged versions. Rollback never hard-deletes history. */
export const rollbackBatch = mutation({
  args: {
    ...runFields,
    questionVersionIds: versionIds,
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { run } = await seedRunForActor(ctx, args, "either");
    seedBatch(args.questionVersionIds);
    if (!args.reason.trim()) fail("SEED_INVALID_STATE");
    if (run.state === "preparing" || run.state === "running")
      fail("SEED_NOT_PAUSED");
    const now = Date.now();
    let rolledBack = 0;
    for (const questionVersionId of args.questionVersionIds) {
      const item = await ctx.db
        .query("seedPublicationItems")
        .withIndex("by_runId_and_questionVersionId", (q) =>
          q.eq("runId", run._id).eq("questionVersionId", questionVersionId),
        )
        .unique();
      if (!item) fail("SEED_ITEM_UNAVAILABLE");
      if (item.state === "rolled_back") continue;
      const version = await ctx.db.get(
        "questionVersions",
        item.questionVersionId,
      );
      if (!version) fail("SEED_ITEM_UNAVAILABLE");
      await ctx.db.patch("questionVersions", version._id, {
        state: "archived",
        workflowRevision: version.workflowRevision + 1,
      });
      await appendAdminAudit(ctx, {
        entityType: "question_version",
        entityId: version._id,
        action: "seed_rollback",
        before: {
          state: version.state,
          revision: version.workflowRevision,
        },
        after: {
          state: "archived",
          revision: version.workflowRevision + 1,
          seedRunId: run._id,
        },
      });
      await ctx.db.patch("seedPublicationItems", item._id, {
        state: "rolled_back",
        transitionedAt: now,
      });
      rolledBack++;
    }
    if (rolledBack) {
      const total = run.rolledBack + rolledBack;
      if (total > run.expected) fail("SEED_ROLLBACK_ORDER");
      const complete = total === run.expected;
      await ctx.db.patch("seedPublicationRuns", run._id, {
        rolledBack: total,
        state: complete ? "rolled_back" : "paused",
        rollbackReason: args.reason,
        leaseUntil: 0,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "seed_publication",
        entityId: run._id,
        action: complete ? "rollback_complete" : "rollback",
        before: { rolledBack: run.rolledBack },
        after: { rolledBack: total, reason: args.reason },
      });
    }
    return null;
  },
});

import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { appendSystemAudit } from "./lib/audit";
import { digest } from "./lib/questionContent";
import {
  nextQuestionState,
  questionWorkflowError as fail,
} from "./lib/questionWorkflow";
import {
  entryAt,
  matchSource,
  receiptDescriptor,
  resolveQuestion,
  resolveReference,
  inspectSource,
  stageDescriptors,
} from "./lib/questionImportState";
import { importQuestionDraft } from "./lib/questionImports";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import {
  completeAssetUploadForActor,
  reserveAssetForActor,
} from "./lib/questionAssets";
import { verifyStoredAsset } from "./lib/questionAssetUpload";
import {
  assertBootstrapPlan,
  bootstrapAssessment,
  bootstrapBatch,
  bootstrapLeaseMs,
  bootstrapLeasedRun,
  bootstrapQueryRun,
  bootstrapReviewReason,
  bootstrapRun,
  ensureSystemUser,
  requireBootstrapTarget,
  systemApproverIdentifier,
  systemImporterIdentifier,
} from "./lib/seedBootstrapProtocol";
import {
  descriptor,
  manifestPin,
  sourceRecord,
  runAccess,
  type SourceRecord,
} from "./lib/questionImportProtocol";
import {
  bootstrapStageBatchSize,
  importChainStart,
  safeBootstrapFailure,
} from "../lib/question-import-contract.mjs";

const checkedSource = v.object({ descriptor, source: sourceRecord });
const classification = v.object({
  ordinal: v.number(),
  status: v.union(
    v.literal("new"),
    v.literal("identical"),
    v.literal("conflict"),
    v.literal("dependency_pending"),
    v.literal("invalid"),
  ),
  duplicateCandidates: v.number(),
  code: v.optional(v.string()),
});
const runFields = {
  target: v.string(),
  runId: v.id("questionImportRuns"),
};

const uploadContextRef = makeFunctionReference<
  "query",
  {
    runId: Id<"questionImportRuns">;
    target: string;
    generation: number;
    ordinal: number;
  },
  { asset: Doc<"questionAssets">; leaseUntil: number }
>("seedBootstrap:assetUploadContext");
const completeRef = makeFunctionReference<
  "mutation",
  {
    runId: Id<"questionImportRuns">;
    target: string;
    generation: number;
    ordinal: number;
    storageId: Id<"_storage">;
    expectedRevision: number;
  },
  null
>("seedBootstrap:completeAsset");
const storageBindingRef = makeFunctionReference<
  "query",
  { storageId: Id<"_storage"> },
  boolean
>("questionAssets:storageBinding");

/** Acquire or resume the one-time developer bootstrap run. */
export const begin = internalMutation({
  args: {
    target: v.string(),
    planChecksum: v.string(),
    inventoryHash: v.string(),
    manifests: v.array(manifestPin),
    resumeRunId: v.optional(v.id("questionImportRuns")),
  },
  returns: v.object({
    runId: v.id("questionImportRuns"),
    generation: v.number(),
  }),
  handler: async (ctx, args) => {
    const targetUrl = requireBootstrapTarget(args.target);
    await assertBootstrapPlan(args);
    for (const pin of args.manifests) {
      const taxonomy = await ctx.db
        .query("taxonomyVersions")
        .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", pin.taxonomyId))
        .unique();
      if (!taxonomy || taxonomy.state !== "sealed")
        fail("TAXONOMY_UNAVAILABLE");
    }
    const importer = await ensureSystemUser(ctx, systemImporterIdentifier);
    const approver = await ensureSystemUser(ctx, systemApproverIdentifier);
    const latest = await ctx.db
      .query("questionImportRuns")
      .withIndex("by_mode_and_target", (q) =>
        q.eq("mode", "bootstrap").eq("target", args.target),
      )
      .order("desc")
      .take(20);
    let resume = args.resumeRunId
      ? latest.find((run) => run._id === args.resumeRunId)
      : latest
          .filter((run) => run.state !== "rolled_back")
          .sort((left, right) => right.createdAt - left.createdAt)[0];
    if (args.resumeRunId && !resume)
      resume = await bootstrapRun(ctx, {
        runId: args.resumeRunId,
        target: args.target,
      });
    if (resume) {
      if (resume.mode !== "bootstrap") fail("BOOTSTRAP_TARGET_CONFLICT");
      if (resume.planChecksum !== args.planChecksum)
        fail("BOOTSTRAP_PLAN_MISMATCH");
      if (resume.state === "complete")
        return { runId: resume._id, generation: resume.generation };
      if (resume.state === "rolled_back") fail("BOOTSTRAP_ALREADY_ROLLED_BACK");
      if ((resume.rolledBack ?? 0) > 0) fail("BOOTSTRAP_ALREADY_ROLLED_BACK");
      if (resume.ownerId !== importer._id || resume.approverId !== approver._id)
        fail("BOOTSTRAP_TARGET_CONFLICT");
      if (resume.state !== "paused" && resume.leaseUntil > Date.now())
        fail("BOOTSTRAP_BUSY");
      // Resuming a paused or expired run must not create a second live worker
      // on the same target. The paused run itself holds no lease, so any
      // active lease here belongs to a competing run.
      const competing = await ctx.db
        .query("questionImportRuns")
        .withIndex("by_targetUrl_and_leaseUntil", (q) =>
          q.eq("targetUrl", targetUrl).gt("leaseUntil", Date.now()),
        )
        .take(2);
      if (competing.some((other) => other._id !== resume._id))
        fail("BOOTSTRAP_BUSY");
      await ctx.db.patch("questionImportRuns", resume._id, {
        generation: resume.generation + 1,
        state: resume.staged === resume.expected ? "running" : "preparing",
        leaseUntil: Date.now() + bootstrapLeaseMs,
        updatedAt: Date.now(),
        lastFailure: undefined,
      });
      await appendSystemAudit(ctx, importer._id, {
        entityType: "question_import",
        entityId: resume._id,
        action: "bootstrap_resume",
        before: { generation: resume.generation, state: resume.state },
        after: { generation: resume.generation + 1 },
      });
      return { runId: resume._id, generation: resume.generation + 1 };
    }
    // A fully rolled-back attempt may be retried as a fresh run; an active or
    // partially rolled-back attempt must be finished or rolled back first.
    const active = await ctx.db
      .query("questionImportRuns")
      .withIndex("by_targetUrl_and_leaseUntil", (q) =>
        q.eq("targetUrl", targetUrl).gt("leaseUntil", Date.now()),
      )
      .first();
    if (active) fail("BOOTSTRAP_BUSY");
    const expected = args.manifests.reduce(
      (total, pin) => total + pin.questions + pin.references + pin.assets,
      0,
    );
    const runId = await ctx.db.insert("questionImportRuns", {
      target: args.target,
      targetUrl,
      mode: "bootstrap",
      ownerId: importer._id,
      approverId: approver._id,
      planChecksum: args.planChecksum,
      inventoryHash: args.inventoryHash,
      manifests: args.manifests,
      stagedCounts: args.manifests.map((pin) => ({
        family: pin.family,
        questions: 0,
        references: 0,
        assets: 0,
      })),
      expected,
      chain: importChainStart,
      staged: 0,
      processed: 0,
      rolledBack: 0,
      state: "preparing",
      generation: 1,
      leaseUntil: Date.now() + bootstrapLeaseMs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await appendSystemAudit(ctx, importer._id, {
      entityType: "question_import",
      entityId: runId,
      action: "bootstrap_begin",
      before: null,
      after: {
        planChecksum: args.planChecksum,
        expected,
        target: args.target,
        importerId: importer._id,
        approverId: approver._id,
      },
    });
    return { runId, generation: 1 };
  },
});

/** Compare a bounded source batch against the target without writing content. */
export const preflight = internalQuery({
  args: {
    ...runAccess,
    records: v.array(checkedSource),
  },
  returns: v.array(classification),
  handler: async (ctx, args) => {
    const run = await bootstrapQueryRun(ctx, args);
    bootstrapBatch(args.records);
    const importer = await ctx.db.get("users", run.ownerId);
    if (!importer || importer.role !== "system")
      fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
    const results = [];
    for (const record of args.records) {
      try {
        await matchSource(record.source, record.descriptor);
        const pin = run.manifests.find(
          (value) => value.family === record.descriptor.family,
        );
        if (!pin) fail("INVALID_IMPORT_ENTRY");
        const taxonomy = await ctx.db
          .query("taxonomyVersions")
          .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", pin.taxonomyId))
          .unique();
        if (!taxonomy || taxonomy.state !== "sealed")
          fail("TAXONOMY_UNAVAILABLE");
        results.push({
          ordinal: record.descriptor.ordinal,
          ...(await inspectSource(ctx, record.source, pin, {
            duplicateCandidates: false,
            actor: importer,
          })),
        });
      } catch (error) {
        const data = error instanceof ConvexError ? error.data : null;
        const code =
          data &&
          typeof data === "object" &&
          "code" in data &&
          typeof data.code === "string" &&
          safeBootstrapFailure(data.code) === data.code
            ? data.code
            : "VALIDATION_FAILED";
        results.push({
          ordinal: record.descriptor.ordinal,
          status: "invalid" as const,
          duplicateCandidates: 0,
          code,
        });
      }
    }
    return results;
  },
});

/** Pin an ordered batch of the reviewed inventory. */
export const stage = internalMutation({
  args: { ...runAccess, entries: v.array(descriptor) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await bootstrapLeasedRun(ctx, args);
    bootstrapBatch(args.entries, bootstrapStageBatchSize);
    const result = await stageDescriptors(ctx, run, args.entries, {
      notPreparing: "BOOTSTRAP_NOT_PREPARING",
      order: "BOOTSTRAP_ORDER",
    });
    if (result.after !== result.before)
      await appendSystemAudit(ctx, run.ownerId, {
        entityType: "question_import",
        entityId: run._id,
        action: "bootstrap_stage_inventory",
        before: { staged: result.before },
        after: { staged: result.after, chain: result.chain },
      });
    return null;
  },
});

/**
 * Move one exact question version to published under this bootstrap run.
 * A version archived by a fully rolled-back bootstrap may be accepted again;
 * all other lifecycle states fail closed.
 */
async function acceptAndPublishQuestion(
  ctx: MutationCtx,
  run: Doc<"questionImportRuns">,
  importer: Doc<"users">,
  approver: Doc<"users">,
  questionVersionId: Id<"questionVersions">,
  source: Extract<SourceRecord, { kind: "question" }>["value"],
  taxonomyId: string,
) {
  let version = await ctx.db.get("questionVersions", questionVersionId);
  if (!version) fail("QUESTION_NOT_FOUND");
  if (version.state === "published") {
    const approval = version.approvalDecisionId
      ? await ctx.db.get("questionReviews", version.approvalDecisionId)
      : null;
    if (
      version.bootstrapRunId !== run._id ||
      !approval ||
      approval.kind !== "bootstrap_acceptance" ||
      approval.importRunId !== run._id ||
      approval.planChecksum !== run.planChecksum
    )
      fail("CONTENT_CONFLICT");
    return;
  }
  if (version.state === "archived") {
    const previous = version.bootstrapRunId
      ? await ctx.db.get("questionImportRuns", version.bootstrapRunId)
      : null;
    if (
      !previous ||
      previous.mode !== "bootstrap" ||
      previous.state !== "rolled_back" ||
      version.archivedByBootstrapRunId !== previous._id
    )
      fail("CONTENT_CONFLICT");
    const revision = version.workflowRevision;
    await ctx.db.patch("questionVersions", version._id, {
      state: "pending_review",
      workflowRevision: revision + 1,
      bootstrapRunId: run._id,
      archivedByBootstrapRunId: undefined,
    });
    await appendSystemAudit(ctx, importer._id, {
      entityType: "question_version",
      entityId: version._id,
      action: "bootstrap_reactivate",
      before: { state: version.state, revision },
      after: { state: "pending_review", revision: revision + 1 },
    });
    version = await ctx.db.get("questionVersions", version._id);
    if (!version) fail("QUESTION_NOT_FOUND");
  } else {
    if (version.state !== "draft") fail("CONTENT_CONFLICT");
    const question = await ctx.db.get("questions", version.questionId);
    if (
      version.creatorId !== importer._id ||
      !question ||
      question.contributorId !== importer._id
    )
      fail("CONTENT_CONFLICT");
    if (version.bootstrapRunId !== run._id)
      await ctx.db.patch("questionVersions", version._id, {
        bootstrapRunId: run._id,
      });
    const next = nextQuestionState(
      version.state,
      version.workflowRevision,
      version.workflowRevision,
      "submit",
    );
    await ctx.db.patch("questionVersions", version._id, next);
    await appendSystemAudit(ctx, importer._id, {
      entityType: "question_version",
      entityId: version._id,
      action: "bootstrap_submit",
      before: { state: version.state, revision: version.workflowRevision },
      after: next,
    });
    version = await ctx.db.get("questionVersions", version._id);
    if (!version) fail("QUESTION_NOT_FOUND");
  }
  // Record plan-level bootstrap acceptance as the system approver.
  const reviewId = await ctx.db.insert("questionReviews", {
    questionVersionId: version._id,
    reviewerId: approver._id,
    kind: "bootstrap_acceptance",
    decision: "accept",
    expectedRevision: version.workflowRevision,
    resultingRevision: version.workflowRevision + 1,
    reason: bootstrapReviewReason(run),
    rubric: "seed-bootstrap-v1",
    score: 5,
    assessment: bootstrapAssessment(run, {
      versionId: version._id,
      contentHash: version.contentHash,
    }),
    importRunId: run._id,
    planChecksum: run.planChecksum,
    decidedAt: Date.now(),
  });
  await ctx.db.patch("questionVersions", version._id, {
    approvalDecisionId: reviewId,
  });
  let next = nextQuestionState(
    version.state,
    version.workflowRevision,
    version.workflowRevision,
    "approve",
  );
  await ctx.db.patch("questionVersions", version._id, next);
  await appendSystemAudit(ctx, approver._id, {
    entityType: "question_version",
    entityId: version._id,
    action: "bootstrap_accept",
    before: { state: version.state, revision: version.workflowRevision },
    after: { ...next, reviewId },
  });
  version = await ctx.db.get("questionVersions", version._id);
  if (!version) fail("QUESTION_NOT_FOUND");
  const resolved = await resolveQuestion(ctx, source, taxonomyId);
  if (resolved.hashes.contentHash !== version.contentHash)
    fail("CONTENT_CONFLICT");
  next = nextQuestionState(
    version.state,
    version.workflowRevision,
    version.workflowRevision,
    "publish",
  );
  await ctx.db.patch("questionVersions", version._id, next);
  await appendSystemAudit(ctx, approver._id, {
    entityType: "question_version",
    entityId: version._id,
    action: "bootstrap_publish",
    before: { state: version.state, revision: version.workflowRevision },
    after: { ...next, planChecksum: run.planChecksum },
  });
}

/** Apply one bounded batch, publishing each accepted question as it lands. */
export const applyBatch = internalMutation({
  args: { ...runAccess, records: v.array(checkedSource) },
  returns: v.object({
    processed: v.number(),
    state: v.union(v.literal("running"), v.literal("complete")),
    uploadOrdinal: v.optional(v.number()),
    uploadRevision: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const run = await bootstrapLeasedRun(ctx, args, { allowComplete: true });
    bootstrapBatch(args.records);
    if (run.state === "complete") {
      for (const record of args.records) {
        const entry = await entryAt(ctx, run._id, record.descriptor.ordinal);
        if (
          !entry ||
          entry.state !== "done" ||
          (await digest(receiptDescriptor(entry))) !==
            (await digest(record.descriptor))
        )
          fail("BOOTSTRAP_LEASE_LOST");
        await matchSource(record.source, record.descriptor);
      }
      return { processed: run.processed, state: "complete" as const };
    }
    if (run.state !== "running") fail("BOOTSTRAP_NOT_RUNNING");
    const importer = await ctx.db.get("users", run.ownerId);
    const approver = run.approverId
      ? await ctx.db.get("users", run.approverId)
      : null;
    if (
      !importer ||
      importer.role !== "system" ||
      !approver ||
      approver.role !== "system"
    )
      fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
    let processed = run.processed;
    for (const record of args.records) {
      const entry = await entryAt(ctx, run._id, record.descriptor.ordinal);
      if (
        !entry ||
        (await digest(record.descriptor)) !==
          (await digest(receiptDescriptor(entry)))
      )
        fail("IMPORT_SOURCE_CHANGED");
      await matchSource(record.source, record.descriptor);
      if (entry.state === "done") continue;
      if (entry.ordinal !== processed) fail("BOOTSTRAP_ORDER");
      const pin = run.manifests.find((value) => value.family === entry.family);
      if (!pin) fail("INVALID_IMPORT_ENTRY");
      const resolved =
        record.source.kind === "question"
          ? await resolveQuestion(ctx, record.source.value, pin.taxonomyId)
          : undefined;
      const classification = await inspectSource(ctx, record.source, pin, {
        ...(resolved ? { resolvedQuestion: resolved } : {}),
        duplicateCandidates: false,
        actor: importer,
      });
      if (classification.status === "conflict") fail("CONTENT_CONFLICT");
      let resultId: string;
      if (record.source.kind === "asset") {
        if (args.records.length !== 1) fail("IMPORT_ASSET_BATCH");
        const { path: _path, ...metadata } = record.source.value;
        void _path;
        resultId = await reserveAssetForActor(ctx, importer, metadata);
        const asset = await ctx.db.get(
          "questionAssets",
          resultId as Id<"questionAssets">,
        );
        if (!asset) fail("INVALID_IMPORT_ENTRY");
        if (asset.state !== "verified" || !asset.storageId) {
          await ctx.db.patch("questionImportEntries", entry._id, {
            resultId,
            outcome:
              entry.outcome ??
              (classification.status === "new" ? "created" : "reused"),
          });
          await ctx.db.patch("questionImportRuns", run._id, {
            leaseUntil: Date.now() + bootstrapLeaseMs,
            updatedAt: Date.now(),
          });
          return {
            processed: run.processed,
            state: "running" as const,
            uploadOrdinal: entry.ordinal,
            uploadRevision: asset.revision,
          };
        }
      } else if (record.source.kind === "reference") {
        const reference = await resolveReference(ctx, record.source.value);
        if (!reference) fail("UNVERIFIED_ASSET");
        resultId = await createReferenceDraft(ctx, reference, {
          actor: importer,
        });
      } else {
        if (!resolved) fail("INVALID_IMPORT_ENTRY");
        if (resolved.missingReference) fail("REFERENCE_NOT_FOUND");
        const draft = await importQuestionDraft(
          ctx,
          resolved.input,
          resolved.hashes,
          { actor: importer, bootstrapRunId: run._id },
        );
        await acceptAndPublishQuestion(
          ctx,
          run,
          importer,
          approver,
          draft.questionVersionId,
          record.source.value,
          pin.taxonomyId,
        );
        resultId = draft.questionVersionId;
      }
      await ctx.db.patch("questionImportEntries", entry._id, {
        state: "done",
        resultId,
        outcome:
          entry.outcome ??
          (classification.status === "identical" ? "reused" : "created"),
        failureCode: undefined,
      });
      processed++;
    }
    if (processed === run.processed)
      return { processed, state: "running" as const };
    await ctx.db.patch("questionImportRuns", run._id, {
      processed,
      state: processed === run.expected ? "complete" : "running",
      leaseUntil:
        processed === run.expected ? 0 : Date.now() + bootstrapLeaseMs,
      updatedAt: Date.now(),
      lastFailure: undefined,
    });
    await appendSystemAudit(ctx, importer._id, {
      entityType: "question_import",
      entityId: run._id,
      action: "bootstrap_checkpoint",
      before: { processed: run.processed },
      after: { processed },
    });
    if (processed === run.expected)
      await appendSystemAudit(ctx, importer._id, {
        entityType: "question_import",
        entityId: run._id,
        action: "bootstrap_complete",
        before: { processed: run.processed },
        after: { processed, planChecksum: run.planChecksum },
      });
    return {
      processed,
      state:
        processed === run.expected
          ? ("complete" as const)
          : ("running" as const),
    };
  },
});

/** Create a short-lived upload URL for the exact pending asset reservation. */
export const assetUploadUrl = internalMutation({
  args: { ...runAccess, ordinal: v.number() },
  returns: v.object({
    uploadUrl: v.string(),
    expectedRevision: v.number(),
  }),
  handler: async (ctx, args) => {
    const run = await bootstrapLeasedRun(ctx, args);
    if (run.state !== "running" || run.processed !== args.ordinal)
      fail("BOOTSTRAP_ORDER");
    const entry = await entryAt(ctx, run._id, args.ordinal);
    if (!entry || entry.kind !== "asset" || !entry.resultId)
      fail("INVALID_IMPORT_ENTRY");
    const asset = await ctx.db.get(
      "questionAssets",
      entry.resultId as Id<"questionAssets">,
    );
    if (
      !asset ||
      asset.uploaderId !== run.ownerId ||
      asset.state !== "pending" ||
      asset.assetId !== entry.sourceId
    )
      fail("FORBIDDEN");
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      expectedRevision: asset.revision,
    };
  },
});

/** Internal query used by the verification action to recheck the upload fence. */
export const assetUploadContext = internalQuery({
  args: { ...runAccess, ordinal: v.number() },
  returns: v.object({
    asset: schema.doc("questionAssets"),
    leaseUntil: v.number(),
  }),
  handler: async (ctx, args) => {
    const run = await bootstrapQueryRun(ctx, args);
    if (run.state !== "running" || run.processed !== args.ordinal)
      fail("BOOTSTRAP_ORDER");
    const entry = await entryAt(ctx, run._id, args.ordinal);
    if (!entry || entry.kind !== "asset" || !entry.resultId)
      fail("INVALID_IMPORT_ENTRY");
    const asset = await ctx.db.get(
      "questionAssets",
      entry.resultId as Id<"questionAssets">,
    );
    if (
      !asset ||
      asset.uploaderId !== run.ownerId ||
      asset.state !== "pending" ||
      asset.assetId !== entry.sourceId
    )
      fail("FORBIDDEN");
    return { asset, leaseUntil: run.leaseUntil };
  },
});

/** Bind the uploaded storage object after verifying its exact bytes. */
export const completeAsset = internalMutation({
  args: {
    ...runAccess,
    ordinal: v.number(),
    storageId: v.id("_storage"),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await bootstrapLeasedRun(ctx, args);
    if (run.state !== "running" || run.processed !== args.ordinal)
      fail("BOOTSTRAP_ORDER");
    const entry = await entryAt(ctx, run._id, args.ordinal);
    if (!entry || entry.kind !== "asset" || !entry.resultId)
      fail("INVALID_IMPORT_ENTRY");
    const importer = await ctx.db.get("users", run.ownerId);
    if (!importer || importer.role !== "system")
      fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
    return completeAssetUploadForActor(ctx, importer, {
      assetId: entry.resultId as Id<"questionAssets">,
      expectedRevision: args.expectedRevision,
      storageId: args.storageId,
    });
  },
});

/** Verify a direct storage upload in an action before binding it. */
export const verifyAsset = internalAction({
  args: {
    ...runAccess,
    ordinal: v.number(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { storageId, ...access } = args;
    const { asset, leaseUntil } = await ctx.runQuery(uploadContextRef, access);
    if (leaseUntil <= Date.now()) fail("BOOTSTRAP_LEASE_LOST");
    return verifyStoredAsset(
      ctx,
      asset,
      storageId,
      asset.revision,
      (bound) =>
        ctx.runMutation(completeRef, {
          ...access,
          storageId: bound,
          expectedRevision: asset.revision,
        }),
      (bound) => ctx.runQuery(storageBindingRef, { storageId: bound }),
    );
  },
});

/** Renew only the live fenced lease. */
export const renew = internalMutation({
  args: runAccess,
  returns: v.null(),
  handler: async (ctx, args) => {
    await bootstrapLeasedRun(ctx, args);
    await ctx.db.patch("questionImportRuns", args.runId, {
      leaseUntil: Date.now() + bootstrapLeaseMs,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Release the lease without undoing committed work. */
export const pause = internalMutation({
  args: { ...runFields, code: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await bootstrapRun(ctx, args);
    if (run.state === "complete" || run.state === "rolled_back")
      fail("BOOTSTRAP_INVALID_STATE");
    if (args.code && safeBootstrapFailure(args.code) !== args.code)
      fail("BOOTSTRAP_INVALID_STATE");
    if (run.state === "paused") {
      if (args.code && args.code !== run.lastFailure)
        await ctx.db.patch("questionImportRuns", run._id, {
          lastFailure: args.code,
          updatedAt: Date.now(),
        });
      return null;
    }
    await ctx.db.patch("questionImportRuns", run._id, {
      state: "paused",
      leaseUntil: 0,
      updatedAt: Date.now(),
      ...(args.code ? { lastFailure: args.code } : {}),
    });
    await appendSystemAudit(ctx, run.ownerId, {
      entityType: "question_import",
      entityId: run._id,
      action: "bootstrap_pause",
      before: { state: run.state, processed: run.processed },
      after: { state: "paused", code: args.code ?? null },
    });
    return null;
  },
});

/** Return bounded operational status without question text, answers or credentials. */
export const status = internalQuery({
  args: {
    target: v.string(),
    runId: v.id("questionImportRuns"),
    after: v.number(),
  },
  returns: v.object({
    run: schema.doc("questionImportRuns"),
    entries: v.array(schema.doc("questionImportEntries")),
  }),
  handler: async (ctx, args) => {
    const run = await bootstrapRun(ctx, args);
    if (!Number.isSafeInteger(args.after) || args.after < -1)
      fail("BOOTSTRAP_INVALID_CHECKPOINT");
    const entries = await ctx.db
      .query("questionImportEntries")
      .withIndex("by_runId_and_ordinal", (q) =>
        q.eq("runId", run._id).gt("ordinal", args.after),
      )
      .take(100);
    return { run, entries };
  },
});

/** Archive bootstrap-published versions in bounded batches; never hard-delete. */
export const rollbackBatch = internalMutation({
  args: { ...runFields, reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await bootstrapRun(ctx, args);
    if (!args.reason.trim() || args.reason.length > 500)
      fail("BOOTSTRAP_INVALID_STATE");
    if (run.state === "rolled_back") return null;
    if (run.state === "preparing" || run.state === "running")
      fail("BOOTSTRAP_NOT_PAUSED");
    const importer = await ctx.db.get("users", run.ownerId);
    if (!importer || importer.role !== "system")
      fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
    const published = await ctx.db
      .query("questionVersions")
      .withIndex("by_bootstrapRunId_and_state", (q) =>
        q.eq("bootstrapRunId", run._id).eq("state", "published"),
      )
      .take(10);
    for (const version of published) {
      await ctx.db.patch("questionVersions", version._id, {
        state: "archived",
        workflowRevision: version.workflowRevision + 1,
        archivedByBootstrapRunId: run._id,
      });
      await appendSystemAudit(ctx, importer._id, {
        entityType: "question_version",
        entityId: version._id,
        action: "bootstrap_rollback",
        before: {
          state: version.state,
          revision: version.workflowRevision,
        },
        after: {
          state: "archived",
          revision: version.workflowRevision + 1,
          runId: run._id,
        },
      });
    }
    const remaining = await ctx.db
      .query("questionVersions")
      .withIndex("by_bootstrapRunId_and_state", (q) =>
        q.eq("bootstrapRunId", run._id).eq("state", "published"),
      )
      .first();
    const total = (run.rolledBack ?? 0) + published.length;
    if (total > run.expected) fail("BOOTSTRAP_ROLLBACK_ORDER");
    await ctx.db.patch("questionImportRuns", run._id, {
      rolledBack: total,
      state: remaining ? "paused" : "rolled_back",
      rollbackReason: args.reason,
      leaseUntil: 0,
      updatedAt: Date.now(),
    });
    await appendSystemAudit(ctx, importer._id, {
      entityType: "question_import",
      entityId: run._id,
      action: remaining ? "bootstrap_rollback" : "bootstrap_rollback_complete",
      before: { rolledBack: run.rolledBack ?? 0 },
      after: { rolledBack: total, reason: args.reason },
    });
    return null;
  },
});

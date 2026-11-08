import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { appendAdminAudit } from "./lib/audit";
import { digest, positive, bounded } from "./lib/questionContent";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
import {
  batch,
  checksum,
  descriptor,
  manifestPin,
  sourceRecord,
  runAccess,
  requireImportTarget,
  validateDescriptor,
} from "./lib/questionImportProtocol";
import {
  ownedRun,
  leasedRun,
  entryAt,
  matchSource,
  resolveQuestion,
  resolveReference,
  inspectSource,
} from "./lib/questionImportState";
import { importQuestionDraft } from "./lib/questionImports";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import {
  importChainStart,
  safeImportFailure,
} from "../lib/question-import-contract.mjs";
import schema from "./schema";
const leaseMs = 5 * 60 * 1000;
const assetReserve = makeFunctionReference<
  "mutation",
  {
    assetId: string;
    sha256: string;
    mediaType: "image/png" | "image/webp";
    width: number;
    height: number;
    provenance: {
      kind: "original" | "licensed" | "synthetic";
      author: string;
      assistance: string;
      sources: string[];
    };
  },
  Id<"questionAssets">
>("questionAssets:beginAssetUpload");
const assetComplete = makeFunctionReference<
  "mutation",
  {
    assetId: Id<"questionAssets">;
    expectedRevision: number;
    storageId: Id<"_storage">;
  },
  null
>("questionAssets:completeUpload");
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

/** Compare a bounded source batch against a development target without writes. */
export const preflight = query({
  args: {
    target: v.string(),
    manifest: manifestPin,
    records: v.array(checkedSource),
  },
  returns: v.array(classification),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    requireImportTarget(args.target);
    batch(args.records);
    const taxonomy = await ctx.db
      .query("taxonomyVersions")
      .withIndex("by_taxonomyId", (q) =>
        q.eq("taxonomyId", args.manifest.taxonomyId),
      )
      .unique();
    if (!taxonomy || taxonomy.state !== "sealed") fail("TAXONOMY_UNAVAILABLE");
    const results = [];
    for (const record of args.records) {
      try {
        await matchSource(record.source, record.descriptor);
        if (record.descriptor.family !== args.manifest.family)
          fail("INVALID_IMPORT_ENTRY");
        results.push({
          ordinal: record.descriptor.ordinal,
          ...(await inspectSource(ctx, record.source, args.manifest)),
        });
      } catch (error) {
        const data = error instanceof ConvexError ? error.data : null;
        const code =
          data &&
          typeof data === "object" &&
          "code" in data &&
          typeof data.code === "string" &&
          safeImportFailure(data.code) === data.code
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
/** Acquire the deployment-wide import lease or resume an identical expired run. */
export const begin = mutation({
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
    const actor = await requireAdmin(ctx);
    const targetUrl = requireImportTarget(args.target);
    checksum(args.planChecksum);
    checksum(args.inventoryHash);
    bounded(args.manifests, 16384);
    if (
      !args.manifests.length ||
      args.manifests.length > 7 ||
      new Set(args.manifests.map((p) => p.family)).size !==
        args.manifests.length
    )
      fail("INVALID_IMPORT_PLAN");
    for (const pin of args.manifests) {
      positive(pin.family);
      positive(pin.revision);
      checksum(pin.checksum);
      if (
        pin.family > 7 ||
        !pin.corpusId.trim() ||
        pin.taxonomyId !== "cse-taxonomy-2027-v2" ||
        pin.blueprintIds.join(",") !==
          "cse-professional-2027-v3,cse-subprofessional-2027-v3" ||
        [pin.questions, pin.references, pin.assets].some(
          (n) => !Number.isSafeInteger(n) || n < 0,
        )
      )
        fail("INVALID_IMPORT_PLAN");
      const taxonomy = await ctx.db
        .query("taxonomyVersions")
        .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", pin.taxonomyId))
        .unique();
      if (!taxonomy || taxonomy.state !== "sealed")
        fail("TAXONOMY_UNAVAILABLE");
    }
    if (
      (await digest({
        manifests: args.manifests,
        inventoryHash: args.inventoryHash,
      })) !== args.planChecksum
    )
      fail("INVALID_IMPORT_PLAN");
    const active = await ctx.db
      .query("questionImportRuns")
      .withIndex("by_targetUrl_and_leaseUntil", (q) =>
        q.eq("targetUrl", targetUrl).gt("leaseUntil", Date.now()),
      )
      .first();
    if (active) fail("IMPORT_BUSY");
    const same = args.resumeRunId
      ? await ownedRun(ctx, { runId: args.resumeRunId, target: args.target })
      : await ctx.db
          .query("questionImportRuns")
          .withIndex("by_target_and_planChecksum", (q) =>
            q.eq("target", args.target).eq("planChecksum", args.planChecksum),
          )
          .unique();
    if (same) {
      if (same.ownerId !== actor._id || same.planChecksum !== args.planChecksum)
        fail("IMPORT_RUN_FORBIDDEN");
      if (same.state === "complete")
        return { runId: same._id, generation: same.generation };
      await ctx.db.patch("questionImportRuns", same._id, {
        generation: same.generation + 1,
        leaseUntil: Date.now() + leaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "question_import",
        entityId: same._id,
        action: "resume",
        before: { generation: same.generation },
        after: { generation: same.generation + 1 },
      });
      return { runId: same._id, generation: same.generation + 1 };
    }
    const expected = args.manifests.reduce(
      (n, p) => n + p.questions + p.references + p.assets,
      0,
    );
    if (expected < 1 || expected > 10000) fail("INVALID_IMPORT_PLAN");
    const runId = await ctx.db.insert("questionImportRuns", {
      target: args.target,
      targetUrl,
      ownerId: actor._id,
      planChecksum: args.planChecksum,
      inventoryHash: args.inventoryHash,
      manifests: args.manifests,
      stagedCounts: args.manifests.map((p) => ({
        family: p.family,
        questions: 0,
        references: 0,
        assets: 0,
      })),
      expected,
      chain: importChainStart,
      staged: 0,
      processed: 0,
      state: "preparing",
      generation: 1,
      leaseUntil: Date.now() + leaseMs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await appendAdminAudit(ctx, {
      entityType: "question_import",
      entityId: runId,
      action: "begin",
      before: null,
      after: { planChecksum: args.planChecksum, expected, target: args.target },
    });
    return { runId, generation: 1 };
  },
});
/** Renew only the live fenced lease; lost workers must explicitly resume. */
export const renew = mutation({
  args: runAccess,
  returns: v.null(),
  handler: async (ctx, args) => {
    await leasedRun(ctx, args);
    await ctx.db.patch("questionImportRuns", args.runId, {
      leaseUntil: Date.now() + leaseMs,
      updatedAt: Date.now(),
    });
    return null;
  },
});
/** Persist an immutable ordered inventory, verifying its final hash before processing. */
export const stage = mutation({
  args: { ...runAccess, entries: v.array(descriptor) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await leasedRun(ctx, args);
    batch(args.entries);
    if (run.state !== "preparing") fail("IMPORT_NOT_PREPARING");
    let chain = run.chain;
    let staged = run.staged;
    const counts = run.stagedCounts.map((c) => ({ ...c }));
    for (const d of args.entries) {
      validateDescriptor(d);
      if (!run.manifests.some((p) => p.family === d.family))
        fail("INVALID_IMPORT_ENTRY");
      const prior = await entryAt(ctx, run._id, d.ordinal);
      if (prior) {
        const saved = {
          ordinal: prior.ordinal,
          kind: prior.kind,
          sourceId: prior.sourceId,
          version: prior.version,
          family: prior.family,
          sourceChecksum: prior.sourceChecksum,
        };
        if ((await digest(saved)) !== (await digest(d)))
          fail("IMPORT_SOURCE_CHANGED");
        continue;
      }
      if (d.ordinal !== staged || staged >= run.expected) fail("IMPORT_ORDER");
      const previous = staged ? await entryAt(ctx, run._id, staged - 1) : null;
      const rank = { asset: 0, reference: 1, question: 2 };
      if (previous && rank[previous.kind] > rank[d.kind]) fail("IMPORT_ORDER");
      const duplicate = await ctx.db
        .query("questionImportEntries")
        .withIndex("by_runId_and_kind_and_sourceId_and_version", (q) =>
          q
            .eq("runId", run._id)
            .eq("kind", d.kind)
            .eq("sourceId", d.sourceId)
            .eq("version", d.version),
        )
        .unique();
      if (duplicate) fail("IMPORT_DUPLICATE_ID");
      const count = counts.find((c) => c.family === d.family)!;
      const field =
        d.kind === "question"
          ? "questions"
          : d.kind === "reference"
            ? "references"
            : "assets";
      count[field]++;
      if (
        count[field] > run.manifests.find((p) => p.family === d.family)![field]
      )
        fail("INVALID_IMPORT_PLAN");
      await ctx.db.insert("questionImportEntries", {
        runId: run._id,
        ...d,
        state: "pending",
      });
      chain = await digest({ chain, entry: d });
      staged++;
    }
    if (staged === run.expected && chain !== run.inventoryHash)
      fail("INVALID_IMPORT_PLAN");
    if (staged !== run.staged) {
      await ctx.db.patch("questionImportRuns", run._id, {
        chain,
        staged,
        stagedCounts: counts,
        state: staged === run.expected ? "running" : "preparing",
        leaseUntil: Date.now() + leaseMs,
        updatedAt: Date.now(),
      });
      await appendAdminAudit(ctx, {
        entityType: "question_import",
        entityId: run._id,
        action: "stage_inventory",
        before: { staged: run.staged },
        after: { staged, chain },
      });
    }
    return null;
  },
});
/** Apply metadata through the approved lifecycle; checkpoint and domain writes are atomic. */
export const applyBatch = mutation({
  args: { ...runAccess, records: v.array(checkedSource) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await leasedRun(ctx, args);
    batch(args.records);
    if (run.state !== "running") fail("IMPORT_NOT_RUNNING");
    let processed = run.processed;
    for (const record of args.records) {
      const entry = await entryAt(ctx, run._id, record.descriptor.ordinal);
      if (
        !entry ||
        (await digest(record.descriptor)) !==
          (await digest({
            ordinal: entry.ordinal,
            kind: entry.kind,
            sourceId: entry.sourceId,
            version: entry.version,
            family: entry.family,
            sourceChecksum: entry.sourceChecksum,
          }))
      )
        fail("IMPORT_SOURCE_CHANGED");
      await matchSource(record.source, record.descriptor);
      if (entry.state === "done") continue;
      if (entry.ordinal !== processed) fail("IMPORT_ORDER");
      const pin = run.manifests.find((p) => p.family === entry.family)!;
      const classification = await inspectSource(ctx, record.source, pin);
      if (classification.status === "conflict") fail("CONTENT_CONFLICT");
      let resultId: string;
      if (record.source.kind === "asset") {
        const { path: _path, ...metadata } = record.source.value;
        void _path;
        resultId = await ctx.runMutation(assetReserve, metadata);
        const asset = await ctx.db.get(
          "questionAssets",
          resultId as Id<"questionAssets">,
        );
        if (!asset || asset.state !== "verified") {
          if (args.records.length !== 1) fail("IMPORT_ASSET_BATCH");
          await ctx.db.patch("questionImportEntries", entry._id, {
            resultId,
            outcome:
              entry.outcome ??
              (classification.status === "new" ? "created" : "reused"),
          });
          return null; // Reservation is durable; upload and receipt are reconciled separately.
        }
      } else if (record.source.kind === "reference") {
        const resolved = await resolveReference(ctx, record.source.value);
        if (!resolved) fail("UNVERIFIED_ASSET");
        resultId = await createReferenceDraft(ctx, resolved);
      } else {
        const resolved = await resolveQuestion(
          ctx,
          record.source.value,
          pin.taxonomyId,
        );
        if (resolved.missingReference) fail("REFERENCE_NOT_FOUND");
        resultId = (await importQuestionDraft(ctx, resolved.input))
          .questionVersionId;
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
    if (processed === run.processed) return null;
    await ctx.db.patch("questionImportRuns", run._id, {
      processed,
      state: processed === run.expected ? "complete" : "running",
      leaseUntil: processed === run.expected ? 0 : Date.now() + leaseMs,
      updatedAt: Date.now(),
      lastFailure: undefined,
    });
    await appendAdminAudit(ctx, {
      entityType: "question_import",
      entityId: run._id,
      action: "checkpoint",
      before: { processed: run.processed },
      after: { processed },
    });
    if (processed === run.expected)
      await appendAdminAudit(ctx, {
        entityType: "question_import",
        entityId: run._id,
        action: "complete",
        before: { processed: run.processed },
        after: { processed, planChecksum: run.planChecksum },
      });
    return null;
  },
});
/** Record a sanitized interruption and release the lease without undoing committed drafts. */
export const interrupt = mutation({
  args: { ...runAccess, code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await leasedRun(ctx, args);
    if (safeImportFailure(args.code) !== args.code)
      fail("INVALID_IMPORT_ENTRY");
    const entry = await entryAt(ctx, run._id, run.processed);
    if (entry)
      await ctx.db.patch("questionImportEntries", entry._id, {
        failureCode: args.code,
      });
    await ctx.db.patch("questionImportRuns", run._id, {
      lastFailure: args.code,
      leaseUntil: 0,
      updatedAt: Date.now(),
    });
    await appendAdminAudit(ctx, {
      entityType: "question_import",
      entityId: run._id,
      action: "interrupt",
      before: { processed: run.processed },
      after: { code: args.code, processed: run.processed },
    });
    return null;
  },
});
/** Return bounded operational status without question text, answers or credentials. */
export const status = query({
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
    const run = await ownedRun(ctx, args);
    if (!Number.isSafeInteger(args.after) || args.after < -1)
      fail("INVALID_IMPORT_ENTRY");
    const entries = await ctx.db
      .query("questionImportEntries")
      .withIndex("by_runId_and_ordinal", (q) =>
        q.eq("runId", run._id).gt("ordinal", args.after),
      )
      .take(100);
    return { run, entries };
  },
});
/** Authorize the current image upload without trusting a caller's asset database ID. */
export const uploadContext = internalQuery({
  args: { ...runAccess, ordinal: v.number() },
  returns: v.object({
    asset: schema.doc("questionAssets"),
    leaseUntil: v.number(),
  }),
  handler: async (ctx, args) => {
    const run = await ownedRun(ctx, args);
    if (
      run.generation !== args.generation ||
      run.state !== "running" ||
      run.processed !== args.ordinal
    )
      fail("IMPORT_ORDER");
    const entry = await entryAt(ctx, run._id, args.ordinal);
    if (!entry || entry.kind !== "asset") fail("INVALID_IMPORT_ENTRY");
    const asset = await ctx.db
      .query("questionAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", entry.sourceId))
      .unique();
    if (!asset || asset.uploaderId !== run.ownerId || asset.state !== "pending")
      fail("FORBIDDEN");
    return { asset, leaseUntil: run.leaseUntil };
  },
});
/** Fence the storage binding in the same transaction as its existing verification helper. */
export const completeAsset = internalMutation({
  args: {
    ...runAccess,
    ordinal: v.number(),
    storageId: v.id("_storage"),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await leasedRun(ctx, args);
    if (run.state !== "running" || run.processed !== args.ordinal)
      fail("IMPORT_ORDER");
    const entry = await entryAt(ctx, run._id, args.ordinal);
    if (!entry || entry.kind !== "asset") fail("INVALID_IMPORT_ENTRY");
    const asset = await ctx.db
      .query("questionAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", entry.sourceId))
      .unique();
    if (!asset) fail("ASSET_NOT_FOUND");
    await ctx.runMutation(assetComplete, {
      assetId: asset._id,
      expectedRevision: args.expectedRevision,
      storageId: args.storageId,
    });
    return null;
  },
});

import type { Infer } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "./auth";
import {
  requireImportTarget,
  type SourceRecord,
  type Descriptor,
  validateDescriptor,
  manifestPin,
} from "./questionImportProtocol";
import { questionWorkflowError as fail } from "./questionWorkflow";
import { digest, canonical, validateQuestion } from "./questionContent";
import { validateAssetMetadata } from "./questionAssetMetadata";
import { validateReferenceInput } from "./questionReferenceDrafts";

/** Leave half of the 16 MiB transaction read limit for the rest of preflight. */
const duplicateScanByteLimit = 8 * 1024 * 1024;
export type DuplicateScanBudget = { remainingBytes: number };
/** Share one duplicate-scan read budget across every record in a preflight query. */
export function newDuplicateScanBudget(): DuplicateScanBudget {
  return { remainingBytes: duplicateScanByteLimit };
}

/** Load a run only for its original active admin and exact target. */
export async function ownedRun(
  ctx: QueryCtx,
  args: { runId: Id<"questionImportRuns">; target: string },
) {
  const actor = await requireAdmin(ctx);
  requireImportTarget(args.target);
  const run = await ctx.db.get("questionImportRuns", args.runId);
  if (!run || run.ownerId !== actor._id || run.target !== args.target)
    fail("IMPORT_RUN_FORBIDDEN");
  return run;
}
/** Fence every import mutation against expired or superseded workers. */
export async function leasedRun(
  ctx: MutationCtx,
  args: { runId: Id<"questionImportRuns">; target: string; generation: number },
  options: { allowComplete?: boolean } = {},
) {
  const run = await ownedRun(ctx, args);
  if (run.generation !== args.generation) fail("IMPORT_LEASE_LOST");
  if (run.state === "complete") {
    if (options.allowComplete) return run;
    fail("IMPORT_LEASE_LOST");
  }
  if (run.leaseUntil <= Date.now()) fail("IMPORT_LEASE_LOST");
  // A different run may have acquired the deployment-wide target lease while
  // this worker's transaction was in flight; the active index is the shared fence.
  const active = await ctx.db
    .query("questionImportRuns")
    .withIndex("by_targetUrl_and_leaseUntil", (q) =>
      q.eq("targetUrl", run.targetUrl).gt("leaseUntil", Date.now()),
    )
    .take(2);
  if (active.some((other) => other._id !== run._id)) fail("IMPORT_LEASE_LOST");
  return run;
}
/** Project a persisted receipt onto the descriptor fields used for identity checks. */
export function receiptDescriptor(entry: {
  ordinal: number;
  kind: "asset" | "reference" | "question";
  sourceId: string;
  version: number;
  family: number;
  sourceChecksum: string;
}): Descriptor {
  return {
    ordinal: entry.ordinal,
    kind: entry.kind,
    sourceId: entry.sourceId,
    version: entry.version,
    family: entry.family,
    sourceChecksum: entry.sourceChecksum,
  };
}
/** Read an exact ordinal through the checkpoint index. */
export async function entryAt(
  ctx: Pick<QueryCtx, "db">,
  runId: Id<"questionImportRuns">,
  ordinal: number,
) {
  return ctx.db
    .query("questionImportEntries")
    .withIndex("by_runId_and_ordinal", (q) =>
      q.eq("runId", runId).eq("ordinal", ordinal),
    )
    .unique();
}
/** Verify that payload identity, family and checksum match its pinned descriptor. */
export async function matchSource(source: SourceRecord, d: Descriptor) {
  validateDescriptor(d);
  const id =
    source.kind === "question"
      ? source.value.questionId
      : source.kind === "reference"
        ? source.value.referenceId
        : source.value.assetId;
  const version = source.kind === "asset" ? 0 : source.value.version;
  if (
    source.kind !== d.kind ||
    id !== d.sourceId ||
    version !== d.version ||
    (source.kind !== "asset" && source.value.family !== d.family) ||
    (await digest(source.value)) !== d.sourceChecksum
  )
    fail("IMPORT_SOURCE_CHANGED");
}
/** Resolve canonical asset IDs without exposing private storage identifiers to reports. */
export async function resolveReference(
  ctx: Pick<QueryCtx, "db">,
  source: Extract<SourceRecord, { kind: "reference" }>["value"],
) {
  const { referenceId, version, ...content } = source;
  const blocks = [];
  for (const block of content.blocks) {
    if (block.type !== "image") blocks.push(block);
    else {
      const asset = await ctx.db
        .query("questionAssets")
        .withIndex("by_assetId", (q) => q.eq("assetId", block.assetId))
        .unique();
      if (
        !asset ||
        asset.state !== "verified" ||
        !asset.storageId ||
        !(await ctx.db.system.get("_storage", asset.storageId))
      )
        return null;
      blocks.push({ ...block, assetId: asset._id });
    }
  }
  return { referenceId, version, content: { ...content, blocks } };
}
/** Resolve exact shared-reference versions; never substitute the latest version. */
export async function resolveQuestion(
  ctx: Pick<QueryCtx, "db">,
  source: Extract<SourceRecord, { kind: "question" }>["value"],
  taxonomyId: string,
) {
  const { questionId, version, reference, ...content } = source;
  const taxonomy = await ctx.db
    .query("taxonomyVersions")
    .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", taxonomyId))
    .unique();
  if (!taxonomy || taxonomy.state !== "sealed") fail("TAXONOMY_UNAVAILABLE");
  const ref = reference
    ? await ctx.db
        .query("questionReferenceVersions")
        .withIndex("by_referenceId_and_version", (q) =>
          q
            .eq("referenceId", reference.referenceId)
            .eq("version", reference.referenceVersion),
        )
        .unique()
    : null;
  const input = {
    questionId,
    version,
    content,
    taxonomyVersionId: taxonomy._id,
    ...(ref ? { referenceVersionId: ref._id } : {}),
  };
  const hashes = await validateQuestion(ctx, content, taxonomy._id, ref?._id);
  return { input, hashes, missingReference: Boolean(reference && !ref) };
}
/** Classify an exact existing identity using the lifecycle's immutable content contract. */
type ResolvedQuestion = Awaited<ReturnType<typeof resolveQuestion>>;
/** Count distinct cross-question matches without letting version history hide them. */
async function duplicateCandidateCount(
  ctx: Pick<QueryCtx, "db">,
  fingerprint: string,
  canonicalQuestionId?: Id<"questions">,
  budget: DuplicateScanBudget = newDuplicateScanBudget(),
) {
  const seen = new Set<Id<"questions">>();
  let scanned = 0;
  const collect = async (side?: "lt" | "gt") => {
    if (budget.remainingBytes <= 0) return;
    for await (const row of ctx.db
      .query("questionVersions")
      .withIndex("by_contentFingerprint_and_questionId", (q) => {
        const base = q.eq("contentFingerprint", fingerprint);
        if (!side || !canonicalQuestionId) return base;
        return side === "lt"
          ? base.lt("questionId", canonicalQuestionId)
          : base.gt("questionId", canonicalQuestionId);
      })) {
      seen.add(row.questionId);
      scanned++;
      budget.remainingBytes -= new TextEncoder().encode(canonical(row)).length;
      // Bound the advisory scan; the report is intentionally not exhaustive.
      if (seen.size >= 51 || scanned >= 512 || budget.remainingBytes <= 0)
        return;
    }
  };
  if (canonicalQuestionId) {
    await collect("lt");
    if (seen.size < 51 && scanned < 512 && budget.remainingBytes > 0)
      await collect("gt");
  } else await collect();
  return Math.min(51, seen.size);
}
export async function inspectSource(
  ctx: QueryCtx,
  source: SourceRecord,
  pin: Infer<typeof manifestPin>,
  options: {
    resolvedQuestion?: ResolvedQuestion;
    duplicateCandidates?: boolean;
    duplicateScanBudget?: DuplicateScanBudget;
  } = {},
) {
  if (source.kind === "asset") {
    validateAssetMetadata(source.value);
    const { path: _path, ...metadata } = source.value;
    void _path;
    const existing = await ctx.db
      .query("questionAssets")
      .withIndex("by_assetId", (q) => q.eq("assetId", metadata.assetId))
      .unique();
    if (!existing) return { status: "new" as const, duplicateCandidates: 0 };
    const matches = Object.entries(metadata).every(
      ([key, value]) =>
        canonical(value) === canonical(existing[key as keyof typeof existing]),
    );
    const actor = await requireAdmin(ctx);
    return {
      status: !matches
        ? ("conflict" as const)
        : existing.state === "verified"
          ? existing.storageId &&
            (await ctx.db.system.get("_storage", existing.storageId))
            ? ("identical" as const)
            : ("conflict" as const)
          : existing.state === "pending" && existing.uploaderId === actor._id
            ? ("dependency_pending" as const)
            : ("conflict" as const),
      duplicateCandidates: 0,
    };
  }
  if (source.kind === "reference") {
    const { referenceId, version, ...content } = source.value;
    validateReferenceInput({ referenceId, version, content });
    const resolved = await resolveReference(ctx, source.value);
    // Asset IDs are replaced during resolution, so the size check must run on
    // the exact content that apply will validate and store.
    if (resolved) validateReferenceInput(resolved);
    const existing = await ctx.db
      .query("questionReferenceVersions")
      .withIndex("by_referenceId_and_version", (q) =>
        q
          .eq("referenceId", source.value.referenceId)
          .eq("version", source.value.version),
      )
      .unique();
    if (existing) {
      const blocks = [];
      for (const block of existing.content.blocks) {
        if (block.type !== "image") blocks.push(block);
        else {
          const asset = await ctx.db.get("questionAssets", block.assetId);
          if (!asset)
            return { status: "conflict" as const, duplicateCandidates: 0 };
          blocks.push({ ...block, assetId: asset.assetId });
        }
      }
      if (
        (await digest({
          ...existing.content,
          blocks,
          referenceId: existing.referenceId,
          version: existing.version,
        })) !== (await digest(source.value))
      )
        return { status: "conflict" as const, duplicateCandidates: 0 };
    }
    if (!resolved)
      return { status: "dependency_pending" as const, duplicateCandidates: 0 };
    const latest = await ctx.db
      .query("questionReferenceVersions")
      .withIndex("by_referenceId_and_version", (q) =>
        q.eq("referenceId", source.value.referenceId),
      )
      .order("desc")
      .first();
    return {
      status: existing
        ? existing.contentHash === (await digest(resolved.content))
          ? ("identical" as const)
          : ("conflict" as const)
        : latest &&
            (source.value.version <= latest.version ||
              latest.content.family !== source.value.family ||
              latest.content.module !== source.value.module ||
              latest.content.language !== source.value.language)
          ? ("conflict" as const)
          : ("new" as const),
      duplicateCandidates: 0,
    };
  }
  const resolved =
    options.resolvedQuestion ??
    (await resolveQuestion(ctx, source.value, pin.taxonomyId));
  const canonicalQuestion = await ctx.db
    .query("questions")
    .withIndex("by_questionId", (q) =>
      q.eq("questionId", source.value.questionId),
    )
    .unique();
  const existing = canonicalQuestion
    ? await ctx.db
        .query("questionVersions")
        .withIndex("by_questionId_and_version", (q) =>
          q
            .eq("questionId", canonicalQuestion._id)
            .eq("version", source.value.version),
        )
        .unique()
    : null;
  if (existing) {
    const ref = existing.referenceVersionId
      ? await ctx.db.get(
          "questionReferenceVersions",
          existing.referenceVersionId,
        )
      : null;
    const taxonomy = await ctx.db.get(
      "taxonomyVersions",
      existing.taxonomyVersionId,
    );
    const portable = {
      ...existing.content,
      questionId: source.value.questionId,
      version: existing.version,
      ...(ref
        ? {
            reference: {
              referenceId: ref.referenceId,
              referenceVersion: ref.version,
            },
          }
        : {}),
    };
    if (
      taxonomy?.taxonomyId !== pin.taxonomyId ||
      (await digest(portable)) !== (await digest(source.value))
    )
      return { status: "conflict" as const, duplicateCandidates: 0 };
  }
  const duplicateCandidates =
    resolved.missingReference || options.duplicateCandidates === false
      ? 0
      : await duplicateCandidateCount(
          ctx,
          resolved.hashes.contentFingerprint,
          canonicalQuestion?._id,
          options.duplicateScanBudget,
        );
  return {
    status: resolved.missingReference
      ? ("dependency_pending" as const)
      : existing
        ? existing.contentHash === resolved.hashes.contentHash
          ? ("identical" as const)
          : ("conflict" as const)
        : canonicalQuestion &&
            (canonicalQuestion.family !== source.value.family ||
              source.value.version <= canonicalQuestion.latestVersion)
          ? ("conflict" as const)
          : ("new" as const),
    duplicateCandidates,
  };
}

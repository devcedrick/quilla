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
) {
  const run = await ownedRun(ctx, args);
  if (
    run.state === "complete" ||
    run.generation !== args.generation ||
    run.leaseUntil <= Date.now()
  )
    fail("IMPORT_LEASE_LOST");
  return run;
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
export async function inspectSource(
  ctx: QueryCtx,
  source: SourceRecord,
  pin: Infer<typeof manifestPin>,
) {
  if (source.kind === "asset") {
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
    const resolved = await resolveReference(ctx, source.value);
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
  const resolved = await resolveQuestion(ctx, source.value, pin.taxonomyId);
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
  const duplicates = resolved.missingReference
    ? []
    : await ctx.db
        .query("questionVersions")
        .withIndex("by_contentFingerprint", (q) =>
          q.eq("contentFingerprint", resolved.hashes.contentFingerprint),
        )
        .take(51);
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
    duplicateCandidates: duplicates.filter(
      (d) => d.questionId !== canonicalQuestion?._id,
    ).length,
  };
}

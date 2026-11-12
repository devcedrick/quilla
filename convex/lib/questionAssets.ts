import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { provenance, canonical } from "./questionContent";
import { validateAssetMetadata } from "./questionAssetMetadata";
import { appendActorAudit } from "./audit";
import { questionWorkflowError as fail } from "./questionWorkflow";

type AssetInput = {
  assetId: string;
  sha256: string;
  mediaType: "image/png" | "image/webp";
  width: number;
  height: number;
  provenance: Infer<typeof provenance>;
};

/** Reserve immutable image metadata for an already-authorized actor. */
export async function reserveAssetForActor(
  ctx: MutationCtx,
  actor: Doc<"users">,
  args: AssetInput,
) {
  validateAssetMetadata(args);
  const existing = await ctx.db
    .query("questionAssets")
    .withIndex("by_assetId", (q) => q.eq("assetId", args.assetId))
    .unique();
  if (existing) {
    if (
      existing.sha256 !== args.sha256 ||
      existing.mediaType !== args.mediaType ||
      existing.width !== args.width ||
      existing.height !== args.height ||
      canonical(existing.provenance) !== canonical(args.provenance)
    )
      fail("CONTENT_CONFLICT");
    if (
      existing.state !== "verified" &&
      (existing.uploaderId !== actor._id || existing.state !== "pending")
    )
      // Pending reservations stay with their uploader. An abandoned
      // reservation requires the separately authorized reconciliation path.
      fail("FORBIDDEN");
    return existing._id;
  }
  const id = await ctx.db.insert("questionAssets", {
    ...args,
    uploaderId: actor._id,
    createdAt: Date.now(),
    state: "pending",
    revision: 1,
  });
  await appendActorAudit(ctx, actor, {
    entityType: "question_asset",
    entityId: id,
    action: "reserve",
    before: null,
    after: { assetId: args.assetId, sha256: args.sha256, revision: 1 },
  });
  return id;
}

/** Bind a server-created blob for an already-authorized uploader. */
export async function completeAssetUploadForActor(
  ctx: MutationCtx,
  actor: Doc<"users">,
  args: {
    assetId: Id<"questionAssets">;
    expectedRevision: number;
    storageId: Id<"_storage">;
  },
) {
  const asset = await ctx.db.get("questionAssets", args.assetId);
  if (!asset || asset.uploaderId !== actor._id || asset.state !== "pending")
    fail("FORBIDDEN");
  if (asset.revision !== args.expectedRevision) fail("STALE_REVISION");
  const stored = await ctx.db.system.get("_storage", args.storageId);
  if (
    !stored ||
    stored.size > 1048576 ||
    stored.contentType !== asset.mediaType
  )
    fail("VALIDATION_FAILED");
  await ctx.db.patch("questionAssets", asset._id, {
    storageId: args.storageId,
    state: "verified",
    revision: asset.revision + 1,
  });
  await appendActorAudit(ctx, actor, {
    entityType: "question_asset",
    entityId: asset._id,
    action: "verify",
    before: { state: "pending", revision: asset.revision },
    after: {
      state: "verified",
      revision: asset.revision + 1,
      sha256: asset.sha256,
    },
  });
  return null;
}

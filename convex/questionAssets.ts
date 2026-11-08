import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { appendAdminAudit } from "./lib/audit";
import { provenance, canonical } from "./lib/questionContent";
import { validateAssetMetadata } from "./lib/questionAssetMetadata";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
import schema from "./schema";

/** Reserve immutable image metadata or reuse an identical authorized reservation. */
export const beginAssetUpload = mutation({
  args: {
    assetId: v.string(),
    sha256: v.string(),
    mediaType: v.union(v.literal("image/png"), v.literal("image/webp")),
    width: v.number(),
    height: v.number(),
    provenance,
  },
  returns: v.id("questionAssets"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
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
    await appendAdminAudit(ctx, {
      entityType: "question_asset",
      entityId: id,
      action: "reserve",
      before: null,
      after: { assetId: args.assetId, sha256: args.sha256, revision: 1 },
    });
    return id;
  },
});
/** Authorize protected asset access and enforce upload ownership or verified-read state. */
export const getForAction = internalQuery({
  args: { assetId: v.id("questionAssets"), upload: v.boolean() },
  returns: schema.doc("questionAssets"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const asset = await ctx.db.get("questionAssets", args.assetId);
    if (!asset) fail("ASSET_NOT_FOUND");
    if (
      args.upload &&
      (asset.uploaderId !== actor._id || asset.state !== "pending")
    )
      fail("FORBIDDEN");
    if (!args.upload && (asset.state !== "verified" || !asset.storageId))
      fail("UNVERIFIED_ASSET");
    return asset;
  },
});
/** Bind a server-created blob after rechecking uploader, revision and storage metadata. */
export const completeUpload = internalMutation({
  args: {
    assetId: v.id("questionAssets"),
    expectedRevision: v.number(),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
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
    await appendAdminAudit(ctx, {
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
  },
});

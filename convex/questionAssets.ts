import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { provenance } from "./lib/questionContent";
import { validateAssetMetadata } from "./lib/questionAssetMetadata";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
import {
  completeAssetUploadForActor,
  reserveAssetForActor,
} from "./lib/questionAssets";
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
    return reserveAssetForActor(ctx, actor, args);
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
/** Report whether a storage object is already committed to an asset binding. */
export const storageBinding = internalQuery({
  args: { storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const asset = await ctx.db
      .query("questionAssets")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    return asset !== null;
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
    return completeAssetUploadForActor(ctx, actor, args);
  },
});

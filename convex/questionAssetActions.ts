import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { storeVerifiedAsset } from "./lib/questionAssetUpload";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";

// Explicit references avoid manual edits to generated bindings before authorized codegen.
const get = makeFunctionReference<
  "query",
  { assetId: Id<"questionAssets">; upload: boolean },
  Doc<"questionAssets">
>("questionAssets:getForAction");
const complete = makeFunctionReference<
  "mutation",
  {
    assetId: Id<"questionAssets">;
    expectedRevision: number;
    storageId: Id<"_storage">;
  },
  null
>("questionAssets:completeUpload");
/** Verify bounded image bytes before storage and compensate failed registration. */
export const uploadAsset = action({
  args: {
    assetId: v.id("questionAssets"),
    expectedRevision: v.number(),
    bytes: v.bytes(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const asset = await ctx.runQuery(get, {
      assetId: args.assetId,
      upload: true,
    });
    return storeVerifiedAsset(
      ctx,
      asset,
      args.bytes,
      args.expectedRevision,
      (storageId) =>
        ctx.runMutation(complete, {
          assetId: asset._id,
          expectedRevision: args.expectedRevision,
          storageId,
        }),
    );
  },
});
/** Return verified asset bytes only after active-admin authorization. */
export const readAsset = action({
  args: { assetId: v.id("questionAssets") },
  returns: v.bytes(),
  handler: async (ctx, args) => {
    const asset = await ctx.runQuery(get, {
      assetId: args.assetId,
      upload: false,
    });
    const blob = asset.storageId
      ? await ctx.storage.get(asset.storageId)
      : null;
    if (!blob || blob.size > 1048576) fail("UNVERIFIED_ASSET");
    return blob.arrayBuffer();
  },
});

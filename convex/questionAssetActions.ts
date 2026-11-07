import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { imageDimensions } from "./lib/questionImage";
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
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision !== asset.revision
    )
      fail("STALE_REVISION");
    if (!args.bytes.byteLength || args.bytes.byteLength > 1048576)
      fail("VALIDATION_FAILED");
    const dimensions = imageDimensions(
      new Uint8Array(args.bytes),
      asset.mediaType,
    );
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", args.bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (
      hash !== asset.sha256 ||
      dimensions.width !== asset.width ||
      dimensions.height !== asset.height
    )
      fail("VALIDATION_FAILED");
    const storageId = await ctx.storage.store(
      new Blob([args.bytes], { type: asset.mediaType }),
    );
    try {
      await ctx.runMutation(complete, {
        assetId: asset._id,
        expectedRevision: args.expectedRevision,
        storageId,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return null;
  },
});
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

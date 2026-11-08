import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { action } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { runAccess } from "./lib/questionImportProtocol";
import { storeVerifiedAsset } from "./lib/questionAssetUpload";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
const get = makeFunctionReference<
  "query",
  {
    runId: Id<"questionImportRuns">;
    target: string;
    generation: number;
    ordinal: number;
  },
  { asset: Doc<"questionAssets">; leaseUntil: number }
>("questionImports:uploadContext");
const complete = makeFunctionReference<
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
>("questionImports:completeAsset");
/** Upload one protected image, fencing the final binding against lease loss. */
export const uploadAsset = action({
  args: { ...runAccess, ordinal: v.number(), bytes: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { bytes, ...access } = args;
    const { asset, leaseUntil } = await ctx.runQuery(get, access);
    if (leaseUntil <= Date.now()) fail("IMPORT_LEASE_LOST");
    return storeVerifiedAsset(ctx, asset, bytes, asset.revision, (storageId) =>
      ctx.runMutation(complete, {
        ...access,
        storageId,
        expectedRevision: asset.revision,
      }),
    );
  },
});

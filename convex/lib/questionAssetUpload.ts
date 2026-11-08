import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { imageDimensions } from "./questionImage";
import { questionWorkflowError as fail } from "./questionWorkflow";

/** Verify exact bounded image bytes and compensate a rejected storage binding. */
export async function storeVerifiedAsset(
  ctx: ActionCtx,
  asset: Doc<"questionAssets">,
  bytes: ArrayBuffer,
  expectedRevision: number,
  complete: (storageId: Id<"_storage">) => Promise<null>,
) {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== asset.revision
  )
    fail("STALE_REVISION");
  if (!bytes.byteLength || bytes.byteLength > 1048576)
    fail("VALIDATION_FAILED");
  const dimensions = imageDimensions(new Uint8Array(bytes), asset.mediaType);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (
    hash !== asset.sha256 ||
    dimensions.width !== asset.width ||
    dimensions.height !== asset.height
  )
    fail("VALIDATION_FAILED");
  const storageId = await ctx.storage.store(
    new Blob([bytes], { type: asset.mediaType }),
  );
  try {
    await complete(storageId);
  } catch (error) {
    await ctx.storage.delete(storageId);
    throw error;
  }
  return null;
}

import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { imageDimensions } from "./questionImage";
import { questionWorkflowError as fail } from "./questionWorkflow";

/** Verify exact bounded image bytes against immutable reservation metadata. */
async function assertImageBytes(
  asset: Doc<"questionAssets">,
  bytes: ArrayBuffer,
) {
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
}

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
  await assertImageBytes(asset, bytes);
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

/** Verify a blob uploaded directly through a short-lived storage URL. */
export async function verifyStoredAsset(
  ctx: ActionCtx,
  asset: Doc<"questionAssets">,
  storageId: Id<"_storage">,
  expectedRevision: number,
  complete: (storageId: Id<"_storage">) => Promise<null>,
  isBound: (storageId: Id<"_storage">) => Promise<boolean>,
) {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision !== asset.revision
  )
    fail("STALE_REVISION");
  try {
    const blob = await ctx.storage.get(storageId);
    if (!blob) fail("ASSET_NOT_FOUND");
    await assertImageBytes(asset, await blob.arrayBuffer());
    await complete(storageId);
  } catch (error) {
    let bound = true;
    try {
      bound = await isBound(storageId);
    } catch {
      // Unknown binding state: retain the caller's blob for reconciliation.
    }
    if (!bound) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // Preserve the original verification error; reconciliation can retry.
      }
    }
    throw error;
  }
  return null;
}

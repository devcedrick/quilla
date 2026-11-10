import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { requireAdmin } from "./auth";
import { appendAdminAudit } from "./audit";
import {
  bounded,
  digest,
  positive,
  referenceContent,
  text,
  validateProvenance,
} from "./questionContent";
import { validateAssetId } from "./questionAssetMetadata";
import { questionWorkflowError as fail } from "./questionWorkflow";

type ReferenceContentInput = Omit<Infer<typeof referenceContent>, "blocks"> & {
  blocks: Array<
    | { type: "text"; text: string }
    | { type: "table"; caption: string; headers: string[]; rows: string[][] }
    | {
        type: "image";
        assetId: string;
        caption: string;
        alt: string;
        description: string;
      }
  >;
};
/**
 * Validate immutable reference metadata without requiring database access.
 * Imports defer the size limit until portable asset IDs are resolved.
 */
export function validateReferenceInput(
  input: {
    referenceId: string;
    version: number;
    content: ReferenceContentInput;
  },
  options: { enforceSize?: boolean } = {},
) {
  text(input.referenceId);
  text(input.content.title);
  positive(input.version);
  positive(input.content.family);
  if (options.enforceSize !== false) bounded(input.content, 131072);
  validateProvenance(input.content.provenance);
  if (input.referenceId.length > 100 || !input.content.blocks.length)
    fail("VALIDATION_FAILED");
  for (const block of input.content.blocks) {
    if (block.type === "text") text(block.text);
    else if (block.type === "table") {
      text(block.caption);
      if (
        !block.headers.length ||
        !block.rows.length ||
        block.headers.some((h) => !h.trim()) ||
        block.rows.some((r) => r.length !== block.headers.length)
      )
        fail("VALIDATION_FAILED");
    } else {
      validateAssetId(block.assetId);
      text(block.caption);
      text(block.alt);
      text(block.description);
    }
  }
}
/** Immutable reference creation for both interactive authoring and trusted imports. */
export async function createReferenceDraft(
  ctx: MutationCtx,
  input: {
    referenceId: string;
    version: number;
    content: Infer<typeof referenceContent>;
  },
  idempotent = true,
) {
  const actor = await requireAdmin(ctx);
  validateReferenceInput(input);
  for (const block of input.content.blocks) {
    if (block.type === "image") {
      const asset = await ctx.db.get("questionAssets", block.assetId);
      if (!asset || asset.state !== "verified" || !asset.storageId)
        fail("UNVERIFIED_ASSET");
    }
  }
  const contentHash = await digest(input.content);
  const latest = await ctx.db
    .query("questionReferenceVersions")
    .withIndex("by_referenceId_and_version", (q) =>
      q.eq("referenceId", input.referenceId),
    )
    .order("desc")
    .first();
  const exact = await ctx.db
    .query("questionReferenceVersions")
    .withIndex("by_referenceId_and_version", (q) =>
      q.eq("referenceId", input.referenceId).eq("version", input.version),
    )
    .unique();
  if (exact) {
    if (!idempotent || exact.contentHash !== contentHash)
      fail("CONTENT_CONFLICT");
    return exact._id;
  }
  if (
    latest &&
    (input.version <= latest.version ||
      latest.content.family !== input.content.family ||
      latest.content.module !== input.content.module ||
      latest.content.language !== input.content.language)
  )
    fail("CONTENT_CONFLICT");
  const id = await ctx.db.insert("questionReferenceVersions", {
    ...input,
    contentHash,
    creatorId: actor._id,
    createdAt: Date.now(),
  });
  await appendAdminAudit(ctx, {
    entityType: "question_reference",
    entityId: id,
    action: "create_version",
    before: null,
    after: {
      referenceId: input.referenceId,
      version: input.version,
      contentHash,
    },
  });
  return id;
}

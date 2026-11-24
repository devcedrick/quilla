import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import schema from "./schema";
import { requireAdmin } from "./lib/auth";
import {
  digest,
  language,
  moduleId,
  positive,
  referenceContent,
} from "./lib/questionContent";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";

/** Append an immutable reference only when its latest-version expectation matches. */
export const createReferenceVersion = mutation({
  args: {
    referenceId: v.string(),
    expectedLatestVersion: v.number(),
    content: referenceContent,
  },
  returns: v.id("questionReferenceVersions"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (
      !Number.isSafeInteger(args.expectedLatestVersion) ||
      args.expectedLatestVersion < 0
    )
      fail("VALIDATION_FAILED");
    const previous = await ctx.db
      .query("questionReferenceVersions")
      .withIndex("by_referenceId_and_version", (q) =>
        q.eq("referenceId", args.referenceId),
      )
      .order("desc")
      .first();
    if ((previous?.version ?? 0) !== args.expectedLatestVersion)
      fail("STALE_REVISION");
    return createReferenceDraft(
      ctx,
      {
        referenceId: args.referenceId,
        version: args.expectedLatestVersion + 1,
        content: args.content,
      },
      { idempotent: false },
    );
  },
});
/** Return bounded reference choices compatible with an authoring scope. */
export const listAdminOptions = query({
  args: { family: v.number(), module: moduleId, language },
  returns: v.object({
    options: v.array(
      v.object({
        referenceVersionId: v.id("questionReferenceVersions"),
        referenceId: v.string(),
        version: v.number(),
        title: v.string(),
        createdAt: v.number(),
      }),
    ),
    overflow: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    positive(args.family);
    const rows = await ctx.db
      .query("questionReferenceVersions")
      .withIndex("by_scope_and_createdAt", (q) =>
        q
          .eq("family", args.family)
          .eq("module", args.module)
          .eq("language", args.language),
      )
      .order("desc")
      // Reference content is bounded at 128 KiB. 101 full rows stay below the
      // 16 MiB transaction limit even before deduplication.
      .take(101);
    const seen = new Set<string>();
    const options = [];
    let overflow = rows.length > 100;
    for (const row of rows) {
      if (seen.has(row.referenceId)) continue;
      seen.add(row.referenceId);
      options.push({
        referenceVersionId: row._id,
        referenceId: row.referenceId,
        version: row.version,
        title: row.content.title,
        createdAt: row.createdAt,
      });
      if (options.length === 100) {
        overflow = true;
        break;
      }
    }
    return { options, overflow };
  },
});
/** Resolve an exact immutable reference and admin-only image preview URLs. */
export const getAdminPreview = query({
  args: { referenceVersionId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      reference: schema.doc("questionReferenceVersions"),
      assets: v.array(
        v.object({
          assetId: v.id("questionAssets"),
          url: v.union(v.null(), v.string()),
          alt: v.string(),
          width: v.number(),
          height: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const referenceVersionId = ctx.db.normalizeId(
      "questionReferenceVersions",
      args.referenceVersionId,
    );
    if (!referenceVersionId) return null;
    const reference = await ctx.db.get(
      "questionReferenceVersions",
      referenceVersionId,
    );
    if (!reference) return null;
    if ((await digest(reference.content)) !== reference.contentHash)
      fail("CONTENT_CONFLICT");
    const seen = new Set<string>();
    const assets = [];
    for (const block of reference.content.blocks) {
      if (block.type !== "image" || seen.has(block.assetId)) continue;
      seen.add(block.assetId);
      const asset = await ctx.db.get("questionAssets", block.assetId);
      const url =
        asset?.state === "verified" && asset.storageId
          ? await ctx.storage.getUrl(asset.storageId)
          : null;
      assets.push({
        assetId: block.assetId,
        url,
        alt: block.alt,
        width: asset?.width ?? 0,
        height: asset?.height ?? 0,
      });
    }
    return { reference, assets };
  },
});

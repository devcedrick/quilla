import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { requireAdmin } from "./lib/auth";
import { appendAdminAudit } from "./lib/audit";
import { v2Concepts } from "./lib/taxonomyCatalog";
import {
  identifier,
  loadCatalog,
  taxonomyEntry,
  taxonomyKind,
  taxonomyState,
  taxonomyError,
  validateCatalog,
  type TaxonomyEntry,
} from "./lib/taxonomy";

const expected = {
  taxonomyVersionId: v.id("taxonomyVersions"),
  expectedRevision: v.number(),
};
/** Authorize a taxonomy write and check its expected revision and editable state. */
async function editable(
  ctx: MutationCtx,
  id: Id<"taxonomyVersions">,
  revision: number,
  draftOnly = true,
) {
  await requireAdmin(ctx);
  const version = await ctx.db.get("taxonomyVersions", id);
  if (!version) taxonomyError("TAXONOMY_NOT_FOUND");
  if (!Number.isSafeInteger(revision) || version.revision !== revision)
    taxonomyError("STALE_REVISION");
  if (version.state === "archived" || (draftOnly && version.state !== "draft"))
    taxonomyError("IMMUTABLE_TAXONOMY");
  return version;
}
/** Reject invalid taxonomy pagination sizes. */
function page(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 100)
    taxonomyError("INVALID_PAGE_SIZE");
}
/** Project entry fields into a stable, bounded audit snapshot. */
function entryValue(row: TaxonomyEntry) {
  // Explicit projection prevents database metadata or caller extras entering snapshots.
  return {
    kind: row.kind,
    key: row.key,
    label: row.label,
    archived: row.archived,
    ...("levels" in row ? { levels: [...row.levels].sort() } : {}),
    ...("subjectKey" in row ? { subjectKey: row.subjectKey } : {}),
    ...(row.kind === "concept" ? { subtopicKey: row.subtopicKey } : {}),
  };
}

/** Create a unique admin-authored draft taxonomy and its audit event. */
export const createDraft = mutation({
  args: { taxonomyId: v.string() },
  returns: v.id("taxonomyVersions"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    identifier(args.taxonomyId);
    if (
      await ctx.db
        .query("taxonomyVersions")
        .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", args.taxonomyId))
        .unique()
    )
      taxonomyError("DUPLICATE_IDENTITY");
    const now = Date.now();
    const id = await ctx.db.insert("taxonomyVersions", {
      taxonomyId: args.taxonomyId,
      state: "draft",
      revision: 1,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await appendAdminAudit(ctx, {
      entityType: "taxonomy_version",
      entityId: id,
      action: "create",
      before: null,
      after: { taxonomyId: args.taxonomyId, state: "draft", revision: 1 },
    });
    return id;
  },
});
/** Validate and save a draft entry with atomic revision and audit updates. */
export const upsertEntry = mutation({
  args: { ...expected, entry: taxonomyEntry },
  returns: v.number(),
  handler: async (ctx, args) => {
    const version = await editable(
      ctx,
      args.taxonomyVersionId,
      args.expectedRevision,
    );
    const rows = await loadCatalog(ctx, version._id);
    const old = rows.find(
      (e) => e.kind === args.entry.kind && e.key === args.entry.key,
    );
    const candidates: TaxonomyEntry[] = rows.filter((e) => e !== old);
    candidates.push(args.entry);
    validateCatalog(candidates);
    if (
      old &&
      JSON.stringify(entryValue(old)) === JSON.stringify(entryValue(args.entry))
    )
      return version.revision;
    if (old)
      await ctx.db.replace("taxonomyEntries", old._id, {
        ...args.entry,
        taxonomyVersionId: version._id,
      });
    else
      await ctx.db.insert("taxonomyEntries", {
        ...args.entry,
        taxonomyVersionId: version._id,
      });
    await ctx.db.patch("taxonomyVersions", version._id, {
      revision: version.revision + 1,
      updatedAt: Date.now(),
    });
    await appendAdminAudit(ctx, {
      entityType: "taxonomy_entry",
      entityId: `${version.taxonomyId}:${args.entry.kind}:${args.entry.key}`,
      action: "upsert",
      before: old ? entryValue(old) : null,
      after: entryValue(args.entry),
    });
    return version.revision + 1;
  },
});
/** Archive a draft entry only when no active child depends on it. */
export const archiveEntry = mutation({
  args: { ...expected, kind: taxonomyKind, key: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const version = await editable(
      ctx,
      args.taxonomyVersionId,
      args.expectedRevision,
    );
    const rows = await loadCatalog(ctx, version._id);
    const old = rows.find((e) => e.kind === args.kind && e.key === args.key);
    if (!old) taxonomyError("UNKNOWN_TAXONOMY_ENTRY");
    if (old.archived) return version.revision;
    const changed = rows.map((e) =>
      e._id === old._id ? { ...e, archived: true } : e,
    );
    try {
      validateCatalog(changed);
    } catch {
      taxonomyError("REFERENCED_PARENT");
    }
    await ctx.db.patch("taxonomyEntries", old._id, { archived: true });
    await ctx.db.patch("taxonomyVersions", version._id, {
      revision: version.revision + 1,
      updatedAt: Date.now(),
    });
    await appendAdminAudit(ctx, {
      entityType: "taxonomy_entry",
      entityId: `${version.taxonomyId}:${old.kind}:${old.key}`,
      action: "archive",
      before: entryValue(old),
      after: entryValue({ ...old, archived: true }),
    });
    return version.revision + 1;
  },
});
/** Seal or archive a version with atomic validation, revision and audit updates. */
async function transition(
  ctx: MutationCtx,
  args: { taxonomyVersionId: Id<"taxonomyVersions">; expectedRevision: number },
  state: "sealed" | "archived",
) {
  const version = await editable(
    ctx,
    args.taxonomyVersionId,
    args.expectedRevision,
    state === "sealed",
  );
  if (state === "sealed") {
    const catalog = await loadCatalog(ctx, version._id);
    validateCatalog(catalog, true);
    if (version.taxonomyId === "cse-taxonomy-2027-v2") {
      const concepts = catalog.filter(
        (e) => e.kind === "concept" && !e.archived,
      );
      if (
        concepts.length !== v2Concepts.length ||
        v2Concepts.some(
          ([subject, subtopic, key]) =>
            !concepts.some(
              (e) =>
                e.kind === "concept" &&
                e.key === key &&
                e.subjectKey === subject &&
                e.subtopicKey === subtopic,
            ),
        )
      )
        taxonomyError("INCOMPLETE_CATALOG");
    }
  }
  await ctx.db.patch("taxonomyVersions", version._id, {
    state,
    revision: version.revision + 1,
    updatedAt: Date.now(),
  });
  await appendAdminAudit(ctx, {
    entityType: "taxonomy_version",
    entityId: version._id,
    action: state,
    before: { state: version.state, revision: version.revision },
    after: { state, revision: version.revision + 1 },
  });
  return version.revision + 1;
}
/** Freeze a complete draft catalog after checking its expected revision. */
export const sealVersion = mutation({
  args: expected,
  returns: v.number(),
  handler: (ctx, args) => transition(ctx, args, "sealed"),
});
/** Retire a catalog while preserving its entries and historical identity. */
export const archiveVersion = mutation({
  args: expected,
  returns: v.number(),
  handler: (ctx, args) => transition(ctx, args, "archived"),
});
/** Return an indexed admin-only page of catalog versions. */
export const listVersions = query({
  args: {
    state: v.optional(taxonomyState),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("taxonomyVersions")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    page(args.paginationOpts.numItems);
    return args.state
      ? await ctx.db
          .query("taxonomyVersions")
          .withIndex("by_state", (q) => q.eq("state", args.state!))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("taxonomyVersions")
          .withIndex("by_taxonomyId")
          .order("desc")
          .paginate(args.paginationOpts);
  },
});
/** Return an indexed admin-only page of entries for one catalog. */
export const listEntries = query({
  args: {
    taxonomyVersionId: v.id("taxonomyVersions"),
    kind: v.optional(taxonomyKind),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("taxonomyEntries")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    page(args.paginationOpts.numItems);
    return args.kind
      ? await ctx.db
          .query("taxonomyEntries")
          .withIndex("by_taxonomyVersionId_and_kind", (q) =>
            q
              .eq("taxonomyVersionId", args.taxonomyVersionId)
              .eq("kind", args.kind!),
          )
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("taxonomyEntries")
          .withIndex("by_taxonomyVersionId", (q) =>
            q.eq("taxonomyVersionId", args.taxonomyVersionId),
          )
          .paginate(args.paginationOpts);
  },
});
/** Resolve one exact taxonomy entry for authorized admin inspection. */
export const getEntry = query({
  args: {
    taxonomyVersionId: v.id("taxonomyVersions"),
    kind: taxonomyKind,
    key: v.string(),
  },
  returns: v.union(v.null(), schema.doc("taxonomyEntries")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    identifier(args.key);
    return await ctx.db
      .query("taxonomyEntries")
      .withIndex("by_taxonomyVersionId_and_kind_and_key", (q) =>
        q
          .eq("taxonomyVersionId", args.taxonomyVersionId)
          .eq("kind", args.kind)
          .eq("key", args.key),
      )
      .unique();
  },
});

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
import { examLevel } from "./lib/preparation";
import { canonical } from "./lib/questionContent";
import {
  blueprintConfiguration,
  blueprintConfigurationFormatVersion,
  blueprintContentHash,
  blueprintError,
  blueprintState,
  normalizeBlueprintConfiguration,
  validateBlueprintConfiguration,
  validateBlueprintIdentifier,
  type BlueprintConfiguration,
} from "./lib/blueprintValidation";
import {
  loadActiveBlueprint,
  loadSealedTaxonomy,
  verifyBlueprintContentHash,
} from "./lib/blueprints";

const expected = {
  blueprintVersionId: v.id("blueprintVersions"),
  expectedRevision: v.number(),
};

/** Load a mutable draft at its expected revision. */
async function editable(
  ctx: MutationCtx,
  args: {
    blueprintVersionId: Id<"blueprintVersions">;
    expectedRevision: number;
  },
) {
  await requireAdmin(ctx);
  const version = await ctx.db.get(
    "blueprintVersions",
    args.blueprintVersionId,
  );
  if (!version) blueprintError("BLUEPRINT_NOT_FOUND");
  if (
    !Number.isSafeInteger(args.expectedRevision) ||
    version.revision !== args.expectedRevision
  )
    blueprintError("STALE_REVISION");
  if (version.state !== "draft") blueprintError("IMMUTABLE_BLUEPRINT");
  return version;
}

/** Reject invalid blueprint pagination sizes. */
function page(size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 100)
    blueprintError("INVALID_PAGE_SIZE");
}

/** Create a unique admin-authored draft pinned to one sealed taxonomy. */
export const createDraft = mutation({
  args: {
    blueprintId: v.string(),
    level: examLevel,
    taxonomyVersionId: v.id("taxonomyVersions"),
  },
  returns: v.id("blueprintVersions"),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    validateBlueprintIdentifier(args.blueprintId);
    if (
      await ctx.db
        .query("blueprintVersions")
        .withIndex("by_blueprintId", (q) =>
          q.eq("blueprintId", args.blueprintId),
        )
        .unique()
    )
      blueprintError("DUPLICATE_IDENTITY");
    await loadSealedTaxonomy(ctx, args.taxonomyVersionId);
    const now = Date.now();
    const id = await ctx.db.insert("blueprintVersions", {
      blueprintId: args.blueprintId,
      level: args.level,
      state: "draft",
      revision: 1,
      taxonomyVersionId: args.taxonomyVersionId,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await appendAdminAudit(ctx, {
      entityType: "blueprint_version",
      entityId: id,
      action: "create",
      before: null,
      after: {
        blueprintId: args.blueprintId,
        level: args.level,
        state: "draft",
        revision: 1,
        taxonomyVersionId: args.taxonomyVersionId,
      },
    });
    return id;
  },
});

/** Validate and save a complete configuration on a draft version. */
export const saveConfiguration = mutation({
  args: { ...expected, configuration: blueprintConfiguration },
  returns: v.number(),
  handler: async (ctx, args) => {
    const version = await editable(ctx, args);
    const configuration = normalizeBlueprintConfiguration(args.configuration);
    const taxonomy = await loadSealedTaxonomy(ctx, version.taxonomyVersionId);
    validateBlueprintConfiguration(version.level, taxonomy.rows, configuration);
    const contentHash = await blueprintContentHash(
      blueprintConfigurationFormatVersion,
      version.level,
      version.taxonomyVersionId,
      configuration,
    );
    if (
      version.configuration &&
      version.configurationFormatVersion ===
        blueprintConfigurationFormatVersion &&
      version.contentHash === contentHash &&
      canonical(version.configuration) === canonical(configuration)
    )
      return version.revision;
    await ctx.db.patch("blueprintVersions", version._id, {
      configuration,
      contentHash,
      configurationFormatVersion: blueprintConfigurationFormatVersion,
      revision: version.revision + 1,
      updatedAt: Date.now(),
    });
    await appendAdminAudit(ctx, {
      entityType: "blueprint_version",
      entityId: version._id,
      action: "save",
      before: version.configuration
        ? {
            revision: version.revision,
            contentHash: version.contentHash ?? null,
            configurationFormatVersion:
              version.configurationFormatVersion ?? null,
            configuration: version.configuration,
          }
        : null,
      after: {
        revision: version.revision + 1,
        contentHash,
        configurationFormatVersion: blueprintConfigurationFormatVersion,
        configuration,
      },
    });
    return version.revision + 1;
  },
});

/** Freeze a valid draft and atomically point its level at the new version. */
export const activateVersion = mutation({
  args: expected,
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const version = await editable(ctx, args);
    if (
      !version.configuration ||
      !version.contentHash ||
      version.configurationFormatVersion === undefined
    )
      blueprintError("INCOMPLETE_BLUEPRINT");
    const configuration: BlueprintConfiguration = version.configuration;
    const storedHash = version.contentHash;
    const storedFormatVersion = version.configurationFormatVersion;
    const taxonomy = await loadSealedTaxonomy(ctx, version.taxonomyVersionId);
    validateBlueprintConfiguration(version.level, taxonomy.rows, configuration);
    await verifyBlueprintContentHash(
      storedFormatVersion,
      version.level,
      version.taxonomyVersionId,
      configuration,
      storedHash,
    );

    const now = Date.now();
    const previous = await ctx.db
      .query("activeBlueprints")
      .withIndex("by_level", (q) => q.eq("level", version.level))
      .unique();
    if (previous) {
      const superseded = await ctx.db.get(
        "blueprintVersions",
        previous.blueprintVersionId,
      );
      if (!superseded || superseded.state !== "active")
        blueprintError("ACTIVE_BLUEPRINT_INCONSISTENT");
      await ctx.db.patch("blueprintVersions", superseded._id, {
        state: "archived",
        revision: superseded.revision + 1,
        updatedAt: now,
        archivedAt: now,
      });
      await ctx.db.patch("activeBlueprints", previous._id, {
        blueprintVersionId: version._id,
        activatedBy: actor._id,
        activatedAt: now,
      });
      await appendAdminAudit(ctx, {
        entityType: "blueprint_version",
        entityId: superseded._id,
        action: "supersede",
        before: {
          state: "active",
          revision: superseded.revision,
        },
        after: {
          state: "archived",
          revision: superseded.revision + 1,
          supersededBy: version._id,
        },
      });
    } else {
      await ctx.db.insert("activeBlueprints", {
        level: version.level,
        blueprintVersionId: version._id,
        activatedBy: actor._id,
        activatedAt: now,
      });
    }
    await ctx.db.patch("blueprintVersions", version._id, {
      state: "active",
      revision: version.revision + 1,
      updatedAt: now,
      activatedBy: actor._id,
      activatedAt: now,
    });
    await appendAdminAudit(ctx, {
      entityType: "blueprint_version",
      entityId: version._id,
      action: "activate",
      before: {
        state: "draft",
        revision: version.revision,
        contentHash: storedHash,
        configurationFormatVersion: storedFormatVersion,
      },
      after: {
        state: "active",
        revision: version.revision + 1,
        configurationFormatVersion: storedFormatVersion,
        previousActiveVersionId: previous?.blueprintVersionId ?? null,
      },
    });
    return version.revision + 1;
  },
});

/** Retire an unused draft without creating an executable configuration. */
export const archiveDraft = mutation({
  args: expected,
  returns: v.number(),
  handler: async (ctx, args) => {
    const version = await editable(ctx, args);
    const now = Date.now();
    await ctx.db.patch("blueprintVersions", version._id, {
      state: "archived",
      revision: version.revision + 1,
      updatedAt: now,
      archivedAt: now,
    });
    await appendAdminAudit(ctx, {
      entityType: "blueprint_version",
      entityId: version._id,
      action: "archive",
      before: { state: "draft", revision: version.revision },
      after: { state: "archived", revision: version.revision + 1 },
    });
    return version.revision + 1;
  },
});

/** Return an indexed admin-only page of blueprint versions. */
export const listVersions = query({
  args: {
    level: v.optional(examLevel),
    state: v.optional(blueprintState),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("blueprintVersions")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    page(args.paginationOpts.numItems);
    const { level, state } = args;
    if (level && state)
      return await ctx.db
        .query("blueprintVersions")
        .withIndex("by_level_and_state_and_createdAt", (q) =>
          q.eq("level", level).eq("state", state),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    if (level)
      return await ctx.db
        .query("blueprintVersions")
        .withIndex("by_level_and_createdAt", (q) => q.eq("level", level))
        .order("desc")
        .paginate(args.paginationOpts);
    if (state)
      return await ctx.db
        .query("blueprintVersions")
        .withIndex("by_state_and_createdAt", (q) => q.eq("state", state))
        .order("desc")
        .paginate(args.paginationOpts);
    return await ctx.db
      .query("blueprintVersions")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Resolve one exact blueprint version for authorized admin inspection. */
export const getVersion = query({
  args: { blueprintVersionId: v.id("blueprintVersions") },
  returns: v.union(v.null(), schema.doc("blueprintVersions")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get("blueprintVersions", args.blueprintVersionId);
  },
});

/** Resolve the active blueprint serving one level, if any. */
export const getActive = query({
  args: { level: examLevel },
  returns: v.union(v.null(), schema.doc("blueprintVersions")),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const active = await loadActiveBlueprint(ctx, args.level);
    return active ? active.version : null;
  },
});

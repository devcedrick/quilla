import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { appendActorAudit } from "./audit";
import { loadCatalog, validateCatalog } from "./taxonomy";
import {
  blueprintConfigurationFormatVersion,
  blueprintContentHash,
  blueprintError,
  normalizeBlueprintConfiguration,
  validateBlueprintConfiguration,
  type BlueprintConfiguration,
  type BlueprintHashIdentity,
  type BlueprintLevel,
} from "./blueprintValidation";

type DatabaseReader = Pick<QueryCtx, "db">;

/** Load the exact sealed taxonomy a blueprint version will be pinned to. */
export async function loadSealedTaxonomy(
  ctx: DatabaseReader,
  taxonomyVersionId: Id<"taxonomyVersions">,
) {
  const version = await ctx.db.get("taxonomyVersions", taxonomyVersionId);
  if (!version || version.state !== "sealed")
    blueprintError("TAXONOMY_UNAVAILABLE");
  const rows = await loadCatalog(ctx, taxonomyVersionId);
  validateCatalog(rows, true);
  return { version, rows };
}

/** Load the current active blueprint and require its stored configuration. */
export async function loadActiveBlueprint(
  ctx: DatabaseReader,
  level: BlueprintLevel,
) {
  const pointers = await ctx.db
    .query("activeBlueprints")
    .withIndex("by_level", (q) => q.eq("level", level))
    .take(2);
  if (pointers.length > 1) blueprintError("ACTIVE_BLUEPRINT_INCONSISTENT");
  const pointer = pointers[0] ?? null;
  const activeVersions = await ctx.db
    .query("blueprintVersions")
    .withIndex("by_level_and_state_and_createdAt", (q) =>
      q.eq("level", level).eq("state", "active"),
    )
    .take(2);
  if (!pointer) {
    if (activeVersions.length > 0)
      blueprintError("ACTIVE_BLUEPRINT_INCONSISTENT");
    return null;
  }
  const version = activeVersions[0];
  if (
    activeVersions.length !== 1 ||
    !version ||
    version._id !== pointer.blueprintVersionId
  )
    blueprintError("ACTIVE_BLUEPRINT_INCONSISTENT");
  const configuration = version.configuration;
  const contentHash = version.contentHash;
  const configurationFormatVersion = version.configurationFormatVersion;
  if (
    !configuration ||
    !contentHash ||
    configurationFormatVersion === undefined
  )
    blueprintError("ACTIVE_BLUEPRINT_INCONSISTENT");
  return {
    pointer,
    version,
    configuration,
    contentHash,
    configurationFormatVersion,
  };
}

/** Recompute the configuration hash and compare it to the stored integrity value. */
export async function verifyBlueprintContentHash(
  formatVersion: number,
  level: BlueprintLevel,
  taxonomyVersionId: Id<"taxonomyVersions">,
  configuration: BlueprintConfiguration,
  contentHash: string,
  identity: BlueprintHashIdentity,
) {
  if (
    (await blueprintContentHash(
      formatVersion,
      level,
      taxonomyVersionId,
      configuration,
      identity,
    )) !== contentHash
  )
    blueprintError("CONTENT_HASH_MISMATCH");
}

/**
 * Normalize, validate and hash one configuration for its exact version.
 * The admin save path and the internal seed installer share this helper so
 * validation and hashing can never diverge between them.
 */
export async function prepareBlueprintConfiguration(
  ctx: DatabaseReader,
  version: Doc<"blueprintVersions">,
  configuration: BlueprintConfiguration,
) {
  const normalized = normalizeBlueprintConfiguration(configuration);
  const taxonomy = await loadSealedTaxonomy(ctx, version.taxonomyVersionId);
  validateBlueprintConfiguration(version.level, taxonomy.rows, normalized);
  const contentHash = await blueprintContentHash(
    blueprintConfigurationFormatVersion,
    version.level,
    version.taxonomyVersionId,
    normalized,
    {
      blueprintVersionId: version._id,
      blueprintId: version.blueprintId,
    },
  );
  return {
    configuration: normalized,
    contentHash,
    configurationFormatVersion: blueprintConfigurationFormatVersion,
  };
}

/**
 * Revalidate one stored configuration, freeze it active, and atomically move
 * the per-level pointer. A prior active version is archived with its
 * configuration and hash untouched; nothing is deleted.
 */
export async function activateBlueprintVersion(
  ctx: MutationCtx,
  version: Doc<"blueprintVersions">,
  actor: Doc<"users">,
) {
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
    {
      blueprintVersionId: version._id,
      blueprintId: version.blueprintId,
    },
  );

  const now = Date.now();
  const previous = await loadActiveBlueprint(ctx, version.level);
  if (previous) {
    const superseded = previous.version;
    await ctx.db.patch("blueprintVersions", superseded._id, {
      state: "archived",
      revision: superseded.revision + 1,
      updatedAt: now,
      archivedAt: now,
    });
    await ctx.db.patch("activeBlueprints", previous.pointer._id, {
      blueprintVersionId: version._id,
      activatedBy: actor._id,
      activatedAt: now,
    });
    await appendActorAudit(ctx, actor, {
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
  await appendActorAudit(ctx, actor, {
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
      previousActiveVersionId: previous?.version._id ?? null,
    },
  });
  return {
    revision: version.revision + 1,
    previousActiveVersionId: previous?.version._id ?? null,
  };
}

/**
 * Copy the active configuration into an immutable per-attempt snapshot.
 * #54 links this helper to a concrete attempt; #30 does not create one.
 */
export async function createBlueprintSnapshot(
  ctx: Pick<MutationCtx, "db">,
  level: BlueprintLevel,
) {
  const active = await loadActiveBlueprint(ctx, level);
  if (!active) blueprintError("BLUEPRINT_NOT_ACTIVE");
  await verifyBlueprintContentHash(
    active.configurationFormatVersion,
    level,
    active.version.taxonomyVersionId,
    active.configuration,
    active.contentHash,
    {
      blueprintVersionId: active.version._id,
      blueprintId: active.version.blueprintId,
    },
  );
  return await ctx.db.insert("blueprintSnapshots", {
    level,
    blueprintVersionId: active.version._id,
    blueprintId: active.version.blueprintId,
    taxonomyVersionId: active.version.taxonomyVersionId,
    configurationFormatVersion: active.configurationFormatVersion,
    configuration: active.configuration,
    contentHash: active.contentHash,
    createdAt: Date.now(),
  });
}

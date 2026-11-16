import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { loadCatalog, validateCatalog } from "./taxonomy";
import {
  blueprintContentHash,
  blueprintError,
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
  const pointer = await ctx.db
    .query("activeBlueprints")
    .withIndex("by_level", (q) => q.eq("level", level))
    .unique();
  if (!pointer) return null;
  const version = await ctx.db.get(
    "blueprintVersions",
    pointer.blueprintVersionId,
  );
  const configuration = version?.configuration;
  const contentHash = version?.contentHash;
  const configurationFormatVersion = version?.configurationFormatVersion;
  if (
    !version ||
    version.state !== "active" ||
    version.level !== level ||
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

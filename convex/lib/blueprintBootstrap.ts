import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { seedBlueprintPolicy } from "../../lib/question-import-contract.mjs";
import { initialV3Blueprints } from "./blueprintFixture";
import {
  blueprintContentHash,
  normalizeBlueprintConfiguration,
  validateBlueprintConfiguration,
  type BlueprintConfiguration,
  type BlueprintLevel,
} from "./blueprintValidation";
import { canonical, digest } from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";
import { loadCatalog, validateCatalog } from "./taxonomy";
import { initialV2Catalog } from "./taxonomyCatalog";
import { catalogMatchesFrozen } from "./taxonomyBootstrap";

export const systemBlueprintInstallerIdentifier =
  "system:seed-blueprint-installer";

export type SeedBlueprint = (typeof initialV3Blueprints)[number];
export type ExpectedSeedBlueprint = {
  blueprintId: string;
  level: BlueprintLevel;
};

type DatabaseReader = Pick<QueryCtx, "db">;

/** Read the two reviewed identities from the pinned contract. */
export function expectedSeedBlueprints(): ExpectedSeedBlueprint[] {
  return seedBlueprintPolicy.blueprints.map(
    (entry: { blueprintId: string; level: string }) => {
      if (entry.level !== "professional" && entry.level !== "subprofessional")
        fail("BLUEPRINT_FIXTURE_MISMATCH");
      return { blueprintId: entry.blueprintId, level: entry.level };
    },
  );
}

/** Return the canonical fixture digest without asserting it matches the pin. */
export async function seedBlueprintFixtureDigest() {
  return await digest(initialV3Blueprints);
}

/**
 * Require exactly the reviewed pair: exact identities, the pinned taxonomy and
 * canonical digest, and configurations that satisfy the shared validator
 * against the frozen catalog. Any drift fails before a database write.
 */
export async function assertSeedBlueprintFixtures(
  fixtures: readonly SeedBlueprint[] = initialV3Blueprints,
) {
  const expected = expectedSeedBlueprints();
  if (fixtures.length !== expected.length) fail("BLUEPRINT_FIXTURE_MISMATCH");
  const byId = new Map<string, SeedBlueprint>();
  for (const fixture of fixtures) {
    if (byId.has(fixture.blueprintId)) fail("BLUEPRINT_FIXTURE_MISMATCH");
    byId.set(fixture.blueprintId, fixture);
  }
  for (const entry of expected) {
    const fixture = byId.get(entry.blueprintId);
    if (
      !fixture ||
      fixture.level !== entry.level ||
      fixture.taxonomyId !== seedBlueprintPolicy.taxonomyId
    )
      fail("BLUEPRINT_FIXTURE_MISMATCH");
    try {
      validateBlueprintConfiguration(
        entry.level,
        initialV2Catalog,
        normalizeBlueprintConfiguration(fixture.configuration),
      );
    } catch {
      // Never echo validator details or candidate content.
      fail("BLUEPRINT_FIXTURE_MISMATCH");
    }
  }
  if ((await digest(fixtures)) !== seedBlueprintPolicy.digest)
    fail("BLUEPRINT_FIXTURE_MISMATCH");
  return fixtures;
}

/** Load the one exact sealed v2 taxonomy the blueprints must pin. */
export async function loadExactSeedTaxonomy(ctx: DatabaseReader) {
  const versions = await ctx.db
    .query("taxonomyVersions")
    .withIndex("by_taxonomyId", (q) =>
      q.eq("taxonomyId", seedBlueprintPolicy.taxonomyId),
    )
    .take(2);
  if (versions.length !== 1) fail("BLUEPRINT_TAXONOMY_MISMATCH");
  const version = versions[0];
  if (!version || version.state !== "sealed")
    fail("BLUEPRINT_TAXONOMY_MISMATCH");
  let rows;
  try {
    rows = await loadCatalog(ctx, version._id);
    validateCatalog(rows, true);
  } catch {
    fail("BLUEPRINT_TAXONOMY_MISMATCH");
  }
  if (!catalogMatchesFrozen(rows)) fail("BLUEPRINT_TAXONOMY_MISMATCH");
  return { version, rows };
}

/** Project one configuration into the bounded evidence shape. */
export function blueprintCounts(configuration: BlueprintConfiguration) {
  return {
    scoredItems: configuration.scoredItems,
    durationMinutes: configuration.durationMinutes,
    passingScore: configuration.passingScore,
    cells: configuration.cells.length,
    languages: configuration.languages.length,
    concepts: configuration.concepts.length,
  };
}

/** Compare normalized configurations without trusting collection order. */
export function configurationMatchesFixture(
  configuration: BlueprintConfiguration,
  fixture: BlueprintConfiguration,
) {
  try {
    return (
      canonical(normalizeBlueprintConfiguration(configuration)) ===
      canonical(normalizeBlueprintConfiguration(fixture))
    );
  } catch {
    return false;
  }
}

/** Recompute one stored version's integrity hash without throwing. */
export async function blueprintHashMatches(version: Doc<"blueprintVersions">) {
  const { configuration, contentHash, configurationFormatVersion } = version;
  if (
    !configuration ||
    !contentHash ||
    configurationFormatVersion === undefined
  )
    return false;
  try {
    return (
      (await blueprintContentHash(
        configurationFormatVersion,
        version.level,
        version.taxonomyVersionId,
        configuration,
        {
          blueprintVersionId: version._id,
          blueprintId: version.blueprintId,
        },
      )) === contentHash
    );
  } catch {
    return false;
  }
}

/** Load one level's pointers and active versions without throwing. */
export async function loadLevelPointers(
  ctx: DatabaseReader,
  level: BlueprintLevel,
) {
  const pointers = await ctx.db
    .query("activeBlueprints")
    .withIndex("by_level", (q) => q.eq("level", level))
    .take(2);
  const activeVersions = await ctx.db
    .query("blueprintVersions")
    .withIndex("by_level_and_state_and_createdAt", (q) =>
      q.eq("level", level).eq("state", "active"),
    )
    .take(2);
  return { pointers, activeVersions };
}

/**
 * Require at most one pointer that resolves to the single active version.
 * When an expected version is supplied, that version must be the one pointed to.
 */
export function pointersConsistent(
  pointers: Doc<"activeBlueprints">[],
  activeVersions: Doc<"blueprintVersions">[],
  expectedVersionId?: Id<"blueprintVersions">,
) {
  if (pointers.length > 1) return false;
  const pointer = pointers[0];
  if (!pointer)
    return expectedVersionId === undefined && activeVersions.length === 0;
  return (
    activeVersions.length === 1 &&
    activeVersions[0]._id === pointer.blueprintVersionId &&
    (expectedVersionId === undefined ||
      pointer.blueprintVersionId === expectedVersionId)
  );
}

/** Load any installer identity without creating it. */
export async function loadBlueprintInstaller(ctx: DatabaseReader) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", systemBlueprintInstallerIdentifier),
    )
    .take(2);
  if (users.length !== 1) return null;
  const user = users[0];
  return user.role === "system" && user.status === "active" ? user : null;
}

/** Load one expected version and its level's pointer state. */
export async function inspectExpectedLevel(
  ctx: DatabaseReader,
  expected: ExpectedSeedBlueprint,
) {
  const versions = await ctx.db
    .query("blueprintVersions")
    .withIndex("by_blueprintId", (q) =>
      q.eq("blueprintId", expected.blueprintId),
    )
    .take(2);
  const level = await loadLevelPointers(ctx, expected.level);
  return { expected, versions, ...level };
}

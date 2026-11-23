import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { appendSystemAudit } from "./lib/audit";
import { examLevel } from "./lib/preparation";
import {
  blueprintConfigurationFormatVersion,
  blueprintState,
} from "./lib/blueprintValidation";
import {
  activateBlueprintVersion,
  prepareBlueprintConfiguration,
} from "./lib/blueprints";
import { initialV3Blueprints } from "./lib/blueprintFixture";
import {
  assertSeedBlueprintFixtures,
  blueprintCounts,
  blueprintHashMatches,
  configurationMatchesFixture,
  expectedSeedBlueprints,
  inspectExpectedLevel,
  loadBlueprintInstaller,
  loadExactSeedTaxonomy,
  pointersConsistent,
  seedBlueprintFixtureDigest,
  systemBlueprintInstallerIdentifier,
  type SeedBlueprint,
} from "./lib/blueprintBootstrap";
import type { BlueprintConfiguration } from "./lib/blueprintValidation";
import {
  ensureSystemUser,
  requireBootstrapTarget,
  requireKnownBootstrapTarget,
} from "./lib/seedBootstrapProtocol";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
import { loadCatalog } from "./lib/taxonomy";
import { catalogMatchesFrozen } from "./lib/taxonomyBootstrap";
import { seedBlueprintPolicy } from "../lib/question-import-contract.mjs";

const configurationCounts = v.object({
  scoredItems: v.number(),
  durationMinutes: v.number(),
  passingScore: v.number(),
  cells: v.number(),
  languages: v.number(),
  concepts: v.number(),
});

const installedLevel = v.object({
  blueprintId: v.string(),
  level: examLevel,
  blueprintVersionId: v.id("blueprintVersions"),
  revision: v.number(),
  state: v.literal("active"),
  configurationHash: v.string(),
  counts: configurationCounts,
  supersededVersionId: v.union(v.id("blueprintVersions"), v.null()),
});

const installResult = v.object({
  target: v.string(),
  created: v.boolean(),
  fixtureDigest: v.string(),
  taxonomyVersionId: v.id("taxonomyVersions"),
  levels: v.array(installedLevel),
});

const levelVerify = v.object({
  level: examLevel,
  expectedBlueprintId: v.string(),
  present: v.boolean(),
  versionIds: v.array(v.id("blueprintVersions")),
  duplicateVersions: v.boolean(),
  state: v.union(blueprintState, v.null()),
  revision: v.union(v.number(), v.null()),
  active: v.boolean(),
  sealed: v.boolean(),
  configurationFormatVersion: v.union(v.number(), v.null()),
  contentHash: v.union(v.string(), v.null()),
  hashMatches: v.boolean(),
  configurationMatches: v.boolean(),
  taxonomyMatches: v.boolean(),
  counts: v.union(configurationCounts, v.null()),
  expectedCounts: v.union(configurationCounts, v.null()),
  pointerVersionId: v.union(v.id("blueprintVersions"), v.null()),
  pointerConsistent: v.boolean(),
  systemAttributed: v.boolean(),
  matchesExpected: v.boolean(),
});

const verifyResult = v.object({
  target: v.string(),
  taxonomyId: v.string(),
  taxonomyVersionId: v.union(v.id("taxonomyVersions"), v.null()),
  taxonomySealed: v.boolean(),
  taxonomyMatchesExpected: v.boolean(),
  expectedFixtureDigest: v.string(),
  deployedFixtureDigest: v.string(),
  fixtureDigestMatches: v.boolean(),
  levels: v.array(levelVerify),
  matchesExpected: v.boolean(),
});

/** Reject a fixture digest that differs from the reviewed frozen value. */
function requireFixtureDigest(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value) || value !== seedBlueprintPolicy.digest)
    fail("BLUEPRINT_FIXTURE_MISMATCH");
}

/** Read counts without throwing on malformed stored or fixture content. */
function safeCounts(configuration?: BlueprintConfiguration) {
  if (!configuration) return null;
  try {
    return blueprintCounts(configuration);
  } catch {
    return null;
  }
}

/**
 * Install and activate both approved v3 blueprints atomically. Internal
 * deploy-key access plus the target registry, the bootstrap window, the pinned
 * fixture digest, and the exact sealed taxonomy are the complete authorization
 * boundary; no client-supplied actor establishes identity.
 */
export const install = internalMutation({
  args: { target: v.string(), fixtureDigest: v.string() },
  returns: installResult,
  handler: async (ctx, args) => {
    requireBootstrapTarget(args.target);
    requireFixtureDigest(args.fixtureDigest);
    await assertSeedBlueprintFixtures();
    const taxonomy = await loadExactSeedTaxonomy(ctx);
    const expected = expectedSeedBlueprints();
    const fixtures = new Map<string, SeedBlueprint>(
      initialV3Blueprints.map((fixture) => [fixture.blueprintId, fixture]),
    );

    const states = [];
    for (const entry of expected)
      states.push(await inspectExpectedLevel(ctx, entry));
    for (const state of states) {
      if (!pointersConsistent(state.pointers, state.activeVersions))
        fail("ACTIVE_BLUEPRINT_INCONSISTENT");
    }

    const present = states.map((state) => state.versions.length > 0);
    if (present.some(Boolean) && !present.every(Boolean))
      fail("BLUEPRINT_VERSION_CONFLICT");

    if (present.every(Boolean)) {
      // A rerun is a no-op only when both exact versions were created and
      // activated by the non-login installer, use the current format, and
      // still hash-verify.
      if (states.some((state) => state.versions.length > 1))
        fail("BLUEPRINT_VERSION_CONFLICT");
      const installer = await loadBlueprintInstaller(ctx);
      if (!installer) fail("BLUEPRINT_VERSION_CONFLICT");
      const levels = [];
      for (const state of states) {
        const version = state.versions[0];
        const fixture = fixtures.get(state.expected.blueprintId);
        if (
          !version ||
          !fixture ||
          version.level !== state.expected.level ||
          version.state !== "active" ||
          version.createdBy !== installer._id ||
          version.activatedBy !== installer._id ||
          version.taxonomyVersionId !== taxonomy.version._id ||
          !version.configuration ||
          !version.contentHash ||
          version.configurationFormatVersion !==
            blueprintConfigurationFormatVersion ||
          !pointersConsistent(
            state.pointers,
            state.activeVersions,
            version._id,
          ) ||
          !configurationMatchesFixture(
            version.configuration,
            fixture.configuration,
          ) ||
          !(await blueprintHashMatches(version))
        )
          fail("BLUEPRINT_VERSION_CONFLICT");
        levels.push({
          blueprintId: version.blueprintId,
          level: version.level,
          blueprintVersionId: version._id,
          revision: version.revision,
          state: "active" as const,
          configurationHash: version.contentHash,
          counts: blueprintCounts(version.configuration),
          supersededVersionId: null,
        });
      }
      return {
        target: args.target,
        created: false,
        fixtureDigest: seedBlueprintPolicy.digest,
        taxonomyVersionId: taxonomy.version._id,
        levels,
      };
    }

    // Any predecessor must be complete because activation archives it and
    // moves the pointer only after revalidating the stored configuration.
    for (const state of states) {
      const active = state.activeVersions[0];
      if (
        active &&
        (!active.configuration ||
          !active.contentHash ||
          active.configurationFormatVersion === undefined)
      )
        fail("ACTIVE_BLUEPRINT_INCONSISTENT");
    }

    // Every guard above fails closed before this point, so a rejected request
    // creates neither the installer identity nor a partial blueprint.
    const actor = await ensureSystemUser(
      ctx,
      systemBlueprintInstallerIdentifier,
    );
    const levels = [];
    for (const entry of expected) {
      const fixture = fixtures.get(entry.blueprintId);
      if (!fixture) fail("BLUEPRINT_FIXTURE_MISMATCH");
      const now = Date.now();
      const blueprintVersionId = await ctx.db.insert("blueprintVersions", {
        blueprintId: fixture.blueprintId,
        level: fixture.level,
        state: "draft",
        revision: 1,
        taxonomyVersionId: taxonomy.version._id,
        createdBy: actor._id,
        createdAt: now,
        updatedAt: now,
      });
      const draft = await ctx.db.get("blueprintVersions", blueprintVersionId);
      if (!draft) fail("BLUEPRINT_VERSION_CONFLICT");
      const prepared = await prepareBlueprintConfiguration(
        ctx,
        draft,
        fixture.configuration,
      );
      await ctx.db.patch("blueprintVersions", blueprintVersionId, {
        ...prepared,
        revision: 2,
        updatedAt: Date.now(),
      });
      const counts = blueprintCounts(prepared.configuration);
      await appendSystemAudit(ctx, actor._id, {
        entityType: "blueprint_version",
        entityId: blueprintVersionId,
        action: "seed_install",
        before: null,
        after: {
          blueprintId: fixture.blueprintId,
          level: fixture.level,
          taxonomyVersionId: taxonomy.version._id,
          configurationHash: prepared.contentHash,
          counts,
        },
      });
      const saved = await ctx.db.get("blueprintVersions", blueprintVersionId);
      if (!saved) fail("BLUEPRINT_VERSION_CONFLICT");
      const activation = await activateBlueprintVersion(ctx, saved, actor);
      levels.push({
        blueprintId: fixture.blueprintId,
        level: fixture.level,
        blueprintVersionId,
        revision: activation.revision,
        state: "active" as const,
        configurationHash: prepared.contentHash,
        counts,
        supersededVersionId: activation.previousActiveVersionId,
      });
    }
    return {
      target: args.target,
      created: true,
      fixtureDigest: seedBlueprintPolicy.digest,
      taxonomyVersionId: taxonomy.version._id,
      levels,
    };
  },
});

/**
 * Read-only installation evidence. Only the registry guard is used, so
 * verification remains available after the bootstrap window closes. Malformed
 * stored state is reported as a mismatch rather than thrown.
 */
export const verify = internalQuery({
  args: { target: v.string() },
  returns: verifyResult,
  handler: async (ctx, { target }) => {
    requireKnownBootstrapTarget(target);
    const deployedFixtureDigest = await seedBlueprintFixtureDigest();
    const fixtureDigestMatches =
      deployedFixtureDigest === seedBlueprintPolicy.digest;

    const taxonomyVersions = await ctx.db
      .query("taxonomyVersions")
      .withIndex("by_taxonomyId", (q) =>
        q.eq("taxonomyId", seedBlueprintPolicy.taxonomyId),
      )
      .take(2);
    const taxonomyVersion =
      taxonomyVersions.length === 1 ? taxonomyVersions[0] : null;
    const taxonomySealed = taxonomyVersion?.state === "sealed";
    let taxonomyMatchesExpected = false;
    if (taxonomyVersion && taxonomySealed) {
      try {
        taxonomyMatchesExpected = catalogMatchesFrozen(
          await loadCatalog(ctx, taxonomyVersion._id),
        );
      } catch {
        taxonomyMatchesExpected = false;
      }
    }

    const installer = await loadBlueprintInstaller(ctx);
    const fixtures = new Map<string, SeedBlueprint>(
      initialV3Blueprints.map((fixture) => [fixture.blueprintId, fixture]),
    );
    const levels = [];
    for (const expected of expectedSeedBlueprints()) {
      const state = await inspectExpectedLevel(ctx, expected);
      const version = state.versions[0] ?? null;
      const fixture = fixtures.get(expected.blueprintId);
      const pointerVersionId =
        state.pointers.length === 1
          ? state.pointers[0].blueprintVersionId
          : null;
      const pointerConsistent = pointersConsistent(
        state.pointers,
        state.activeVersions,
        version?._id,
      );
      const hashMatches = version ? await blueprintHashMatches(version) : false;
      const configurationMatches = Boolean(
        version?.configuration &&
        fixture &&
        configurationMatchesFixture(
          version.configuration,
          fixture.configuration,
        ),
      );
      const taxonomyMatches = Boolean(
        version &&
        taxonomyVersion &&
        taxonomyMatchesExpected &&
        version.taxonomyVersionId === taxonomyVersion._id,
      );
      const systemAttributed = Boolean(
        version &&
        installer &&
        version.createdBy === installer._id &&
        version.activatedBy === installer._id,
      );
      const active = version?.state === "active";
      const sealed = active && hashMatches;
      levels.push({
        level: expected.level,
        expectedBlueprintId: expected.blueprintId,
        present: version !== null,
        versionIds: state.versions.map((candidate) => candidate._id),
        duplicateVersions: state.versions.length > 1,
        state: version?.state ?? null,
        revision: version?.revision ?? null,
        active,
        sealed,
        configurationFormatVersion: version?.configurationFormatVersion ?? null,
        contentHash: version?.contentHash ?? null,
        hashMatches,
        configurationMatches,
        taxonomyMatches,
        counts: safeCounts(version?.configuration),
        expectedCounts: safeCounts(fixture?.configuration),
        pointerVersionId,
        pointerConsistent,
        systemAttributed,
        matchesExpected:
          fixtureDigestMatches &&
          taxonomyMatches &&
          state.versions.length === 1 &&
          active &&
          hashMatches &&
          configurationMatches &&
          pointerConsistent &&
          systemAttributed &&
          version?.configurationFormatVersion ===
            blueprintConfigurationFormatVersion &&
          version?.level === expected.level,
      });
    }

    return {
      target,
      taxonomyId: seedBlueprintPolicy.taxonomyId,
      taxonomyVersionId: taxonomyVersion?._id ?? null,
      taxonomySealed,
      taxonomyMatchesExpected,
      expectedFixtureDigest: seedBlueprintPolicy.digest,
      deployedFixtureDigest,
      fixtureDigestMatches,
      levels,
      matchesExpected:
        fixtureDigestMatches &&
        taxonomyMatchesExpected &&
        levels.every((level) => level.matchesExpected),
    };
  },
});

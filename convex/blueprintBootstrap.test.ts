// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as blueprintBootstrap from "./blueprintBootstrap";
import {
  importDigest,
  seedBlueprintPolicy,
  seedTaxonomyPolicy,
} from "../lib/question-import-contract.mjs";
import {
  blueprintContentHash,
  normalizeBlueprintConfiguration,
  type BlueprintLevel,
} from "./lib/blueprintValidation";
import { initialV3Blueprints } from "./lib/blueprintFixture";
import {
  assertSeedBlueprintFixtures,
  blueprintHashMatches,
  systemBlueprintInstallerIdentifier,
} from "./lib/blueprintBootstrap";
import { digest } from "./lib/questionContent";
import { initialV2Catalog } from "./lib/taxonomyCatalog";

vi.mock("../lib/question-import-contract.mjs", async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    approvedImportTargets: {
      fixture: "https://fixture.convex.cloud",
    },
  };
});

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const createTest = () => convexTest(schema, modules);

const expectedCounts: Record<
  string,
  {
    scoredItems: number;
    durationMinutes: number;
    passingScore: number;
    cells: number;
    languages: number;
    concepts: number;
  }
> = {
  "cse-professional-2027-v3": {
    scoredItems: 150,
    durationMinutes: 168,
    passingScore: 120,
    cells: 15,
    languages: 5,
    concepts: 9,
  },
  "cse-subprofessional-2027-v3": {
    scoredItems: 145,
    durationMinutes: 141,
    passingScore: 116,
    cells: 12,
    languages: 5,
    concepts: 10,
  },
};

function fixture(blueprintId: string) {
  const found = initialV3Blueprints.find(
    (candidate) => candidate.blueprintId === blueprintId,
  );
  if (!found) throw new Error(`missing fixture ${blueprintId}`);
  return found;
}

function installTaxonomy(t: ReturnType<typeof createTest>) {
  return t.mutation(internal.taxonomyBootstrap.install, {
    target: "fixture",
    catalogDigest: seedTaxonomyPolicy.digest,
  });
}

function install(
  t: ReturnType<typeof createTest>,
  overrides: Record<string, unknown> = {},
) {
  return t.mutation(internal.blueprintBootstrap.install, {
    target: "fixture",
    fixtureDigest: seedBlueprintPolicy.digest,
    ...overrides,
  });
}

function verify(t: ReturnType<typeof createTest>) {
  return t.query(internal.blueprintBootstrap.verify, { target: "fixture" });
}

async function addAdmin(t: ReturnType<typeof createTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "https://test|admin",
      role: "admin",
      status: "active",
    }),
  );
}

async function addInstaller(t: ReturnType<typeof createTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: systemBlueprintInstallerIdentifier,
      role: "system",
      status: "active",
    }),
  );
}

async function installerUser(t: ReturnType<typeof createTest>) {
  return await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", systemBlueprintInstallerIdentifier),
      )
      .unique(),
  );
}

/**
 * Bound every fixture-table count. Taking the expected maximum plus one keeps
 * unexpected writes detectable without loading an unbounded table.
 */
async function counts(t: ReturnType<typeof createTest>) {
  return await t.run(async (ctx) => ({
    users: (await ctx.db.query("users").take(4)).length,
    versions: (await ctx.db.query("blueprintVersions").take(5)).length,
    pointers: (await ctx.db.query("activeBlueprints").take(3)).length,
    audits: (await ctx.db.query("auditEvents").take(9)).length,
    snapshots: (await ctx.db.query("blueprintSnapshots").take(1)).length,
    questions: (await ctx.db.query("questions").take(1)).length,
    questionVersions: (await ctx.db.query("questionVersions").take(1)).length,
    references: (await ctx.db.query("questionReferenceVersions").take(1))
      .length,
    assets: (await ctx.db.query("questionAssets").take(1)).length,
  }));
}

/** Insert a complete active version and its per-level pointer. */
async function addActiveVersion(
  t: ReturnType<typeof createTest>,
  options: {
    blueprintId: string;
    level: BlueprintLevel;
    taxonomyVersionId: Awaited<
      ReturnType<typeof installTaxonomy>
    >["taxonomyVersionId"];
    userId: Awaited<ReturnType<typeof addAdmin>>;
    configuration?: (typeof initialV3Blueprints)[number]["configuration"];
  },
) {
  const configuration = normalizeBlueprintConfiguration(
    options.configuration ??
      fixture(
        options.level === "professional"
          ? "cse-professional-2027-v3"
          : "cse-subprofessional-2027-v3",
      ).configuration,
  );
  return await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("blueprintVersions", {
      blueprintId: options.blueprintId,
      level: options.level,
      state: "draft",
      revision: 1,
      taxonomyVersionId: options.taxonomyVersionId,
      createdBy: options.userId,
      createdAt: now,
      updatedAt: now,
    });
    const hash = await blueprintContentHash(
      2,
      options.level,
      options.taxonomyVersionId,
      configuration,
      {
        blueprintVersionId: id,
        blueprintId: options.blueprintId,
      },
    );
    await ctx.db.patch("blueprintVersions", id, {
      configuration,
      contentHash: hash,
      configurationFormatVersion: 2,
      state: "active",
      revision: 3,
      updatedAt: now,
      activatedBy: options.userId,
      activatedAt: now,
    });
    await ctx.db.insert("activeBlueprints", {
      level: options.level,
      blueprintVersionId: id,
      activatedBy: options.userId,
      activatedAt: now,
    });
    return { id, hash, configuration };
  });
}

async function blueprintAudits(
  t: ReturnType<typeof createTest>,
  entityId: string,
) {
  return await t.run((ctx) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_entityType_and_entityId_and_occurredAt", (q) =>
        q.eq("entityType", "blueprint_version").eq("entityId", entityId),
      )
      .take(10),
  );
}

beforeEach(() => {
  vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
});

describe("frozen v3 blueprint fixture", () => {
  it("pins the reviewed digest, identities, and configuration counts", async () => {
    expect(seedBlueprintPolicy).toMatchObject({
      taxonomyId: "cse-taxonomy-2027-v2",
      digest:
        "c75b6540dd31a929a810078b2cab54b7f5cff327daacc8c31d58a2022eb4ce69",
    });
    expect(seedBlueprintPolicy.blueprints).toEqual([
      {
        blueprintId: "cse-professional-2027-v3",
        level: "professional",
      },
      {
        blueprintId: "cse-subprofessional-2027-v3",
        level: "subprofessional",
      },
    ]);
    expect(await digest(initialV3Blueprints)).toBe(seedBlueprintPolicy.digest);
    expect(await importDigest(initialV3Blueprints)).toBe(
      seedBlueprintPolicy.digest,
    );
    for (const candidate of initialV3Blueprints) {
      expect(candidate.taxonomyId).toBe("cse-taxonomy-2027-v2");
      expect({
        scoredItems: candidate.configuration.scoredItems,
        durationMinutes: candidate.configuration.durationMinutes,
        passingScore: candidate.configuration.passingScore,
        cells: candidate.configuration.cells.length,
        languages: candidate.configuration.languages.length,
        concepts: candidate.configuration.concepts.length,
      }).toEqual(expectedCounts[candidate.blueprintId]);
    }
    await expect(assertSeedBlueprintFixtures()).resolves.toBe(
      initialV3Blueprints,
    );
  });

  it("rejects any fixture drift before installation", async () => {
    const [professional] = initialV3Blueprints;
    const candidates = [
      initialV3Blueprints.slice(1),
      [...initialV3Blueprints, professional],
      [professional, professional],
      [
        {
          ...professional,
          level: "subprofessional" as BlueprintLevel,
        },
        initialV3Blueprints[1],
      ],
      [
        {
          ...professional,
          taxonomyId: "cse-taxonomy-2027-v1",
        },
        initialV3Blueprints[1],
      ],
      [
        {
          ...professional,
          configuration: {
            ...professional.configuration,
            scoredItems: professional.configuration.scoredItems + 1,
          },
        },
        initialV3Blueprints[1],
      ],
    ];
    for (const candidate of candidates)
      await expect(assertSeedBlueprintFixtures(candidate)).rejects.toThrow(
        "BLUEPRINT_FIXTURE_MISMATCH",
      );
  });
});

describe("guarded v3 blueprint installation", () => {
  it("installs and activates both levels atomically", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    const result = await install(t);
    expect(result).toMatchObject({
      target: "fixture",
      created: true,
      fixtureDigest: seedBlueprintPolicy.digest,
      taxonomyVersionId: taxonomy.taxonomyVersionId,
    });
    expect(result.levels).toHaveLength(2);
    const installer = await installerUser(t);
    for (const level of result.levels) {
      expect(level).toMatchObject({
        revision: 3,
        state: "active",
        supersededVersionId: null,
        counts: expectedCounts[level.blueprintId],
      });
      expect(level.configurationHash).toMatch(/^[a-f0-9]{64}$/);
      const version = await t.run((ctx) =>
        ctx.db.get("blueprintVersions", level.blueprintVersionId),
      );
      expect(version).toMatchObject({
        blueprintId: level.blueprintId,
        level: level.level,
        state: "active",
        revision: 3,
        taxonomyVersionId: taxonomy.taxonomyVersionId,
        configurationFormatVersion: 2,
      });
      expect(await blueprintHashMatches(version!)).toBe(true);
      const pointer = await t.run((ctx) =>
        ctx.db
          .query("activeBlueprints")
          .withIndex("by_level", (q) => q.eq("level", level.level))
          .unique(),
      );
      expect(pointer).toMatchObject({
        blueprintVersionId: level.blueprintVersionId,
      });
      const audits = await blueprintAudits(t, level.blueprintVersionId);
      expect(audits.map((event) => event.action).sort()).toEqual([
        "activate",
        "seed_install",
      ]);
      expect(audits.every((event) => event.actorId === installer!._id)).toBe(
        true,
      );
      expect(
        audits.every((event) => typeof event.occurredAt === "number"),
      ).toBe(true);
      const seed = audits.find((event) => event.action === "seed_install")!;
      expect(JSON.parse(seed.afterJson!)).toEqual({
        blueprintId: level.blueprintId,
        level: level.level,
        taxonomyVersionId: taxonomy.taxonomyVersionId,
        configurationHash: level.configurationHash,
        counts: expectedCounts[level.blueprintId],
      });
      expect(JSON.parse(seed.afterJson!)).not.toHaveProperty("configuration");
      const activation = audits.find((event) => event.action === "activate")!;
      expect(JSON.parse(activation.afterJson!)).toEqual({
        state: "active",
        revision: 3,
        level: level.level,
        configurationFormatVersion: 2,
        previousActiveVersionId: null,
      });
    }
    expect(await installerUser(t)).toMatchObject({
      tokenIdentifier: systemBlueprintInstallerIdentifier,
      role: "system",
      status: "active",
    });
    expect(await counts(t)).toMatchObject({
      versions: 2,
      pointers: 2,
      audits: 6,
      snapshots: 0,
      questions: 0,
      questionVersions: 0,
      references: 0,
      assets: 0,
    });
  });

  it("archives prior active versions without changing their configuration", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    const admin = await addAdmin(t);
    const priorProfessional = await addActiveVersion(t, {
      blueprintId: "cse-professional-2026-v2",
      level: "professional",
      taxonomyVersionId: taxonomy.taxonomyVersionId,
      userId: admin,
    });
    const priorSubprofessional = await addActiveVersion(t, {
      blueprintId: "cse-subprofessional-2026-v2",
      level: "subprofessional",
      taxonomyVersionId: taxonomy.taxonomyVersionId,
      userId: admin,
    });

    const result = await install(t);
    const installer = await installerUser(t);
    expect(result.levels.map((level) => level.supersededVersionId)).toEqual([
      priorProfessional.id,
      priorSubprofessional.id,
    ]);
    for (const [prior, blueprintId] of [
      [priorProfessional, "cse-professional-2027-v3"],
      [priorSubprofessional, "cse-subprofessional-2027-v3"],
    ] as const) {
      const version = await t.run((ctx) =>
        ctx.db.get("blueprintVersions", prior.id),
      );
      expect(version).toMatchObject({
        state: "archived",
        revision: 4,
        contentHash: prior.hash,
        configuration: prior.configuration,
        configurationFormatVersion: 2,
      });
      expect(version!.archivedAt).toBeTypeOf("number");
      const audits = await blueprintAudits(t, prior.id);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "supersede",
        actorId: installer!._id,
      });
      expect(JSON.parse(audits[0].afterJson!)).toMatchObject({
        state: "archived",
        revision: 4,
      });
      const replacement = result.levels.find(
        (level) => level.blueprintId === blueprintId,
      )!;
      expect(replacement.revision).toBe(3);
    }
    expect(await counts(t)).toMatchObject({
      versions: 4,
      pointers: 2,
      questions: 0,
      snapshots: 0,
    });
  });

  it("is an exact no-op on rerun without new users, versions, or audits", async () => {
    const t = createTest();
    await installTaxonomy(t);
    const first = await install(t);
    const before = await counts(t);
    const timestamps = await t.run(async (ctx) => ({
      versions: await ctx.db.query("blueprintVersions").collect(),
      pointers: await ctx.db.query("activeBlueprints").collect(),
    }));
    const second = await install(t);
    expect(second).toEqual({ ...first, created: false });
    expect(await counts(t)).toEqual(before);
    expect(
      await t.run(async (ctx) => ({
        versions: await ctx.db.query("blueprintVersions").collect(),
        pointers: await ctx.db.query("activeBlueprints").collect(),
      })),
    ).toEqual(timestamps);
  });

  it("writes no question, reference, asset, taxonomy, or snapshot records", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    const taxonomyEntriesBefore = await t.run((ctx) =>
      ctx.db.query("taxonomyEntries").collect(),
    );
    await install(t);
    expect(
      await t.run((ctx) => ctx.db.query("taxonomyEntries").collect()),
    ).toEqual(taxonomyEntriesBefore);
    expect(
      await t.run((ctx) =>
        ctx.db.get("taxonomyVersions", taxonomy.taxonomyVersionId),
      ),
    ).toMatchObject({ state: "sealed", revision: 2 });
    expect(await counts(t)).toMatchObject({
      snapshots: 0,
      questions: 0,
      questionVersions: 0,
      references: 0,
      assets: 0,
    });
  });
});

describe("installation guards", () => {
  it("fails closed on target, window, URL, and fixture digest guards", async () => {
    const cases = [
      [{ target: "prod" }, "BOOTSTRAP_TARGET_DISABLED"],
      [{ fixtureDigest: "f".repeat(64) }, "BLUEPRINT_FIXTURE_MISMATCH"],
      [{ fixtureDigest: "not-a-digest" }, "BLUEPRINT_FIXTURE_MISMATCH"],
    ] as const;
    for (const [overrides, code] of cases) {
      const t = createTest();
      await expect(install(t, overrides)).rejects.toThrow(code);
      expect(await counts(t)).toMatchObject({
        users: 0,
        versions: 0,
        pointers: 0,
        audits: 0,
      });
    }

    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const closed = createTest();
    await expect(install(closed)).rejects.toThrow("BOOTSTRAP_TARGET_DISABLED");
    expect(await counts(closed)).toMatchObject({ users: 0, versions: 0 });

    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud/");
    const wrongUrl = createTest();
    await expect(install(wrongUrl)).rejects.toThrow(
      "BOOTSTRAP_TARGET_DISABLED",
    );
    expect(await counts(wrongUrl)).toMatchObject({ users: 0, versions: 0 });
    vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
  });

  it("requires the exact sealed taxonomy before writing", async () => {
    const missing = createTest();
    await expect(install(missing)).rejects.toThrow(
      "BLUEPRINT_TAXONOMY_MISMATCH",
    );
    expect(await counts(missing)).toMatchObject({ users: 0, versions: 0 });

    const draft = createTest();
    const admin = await addAdmin(draft);
    await draft.run((ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "draft",
        revision: 1,
        createdBy: admin,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(install(draft)).rejects.toThrow("BLUEPRINT_TAXONOMY_MISMATCH");
    expect(await installerUser(draft)).toBeNull();

    const archived = createTest();
    const owner = await addAdmin(archived);
    await archived.run((ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "archived",
        revision: 3,
        createdBy: owner,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(install(archived)).rejects.toThrow(
      "BLUEPRINT_TAXONOMY_MISMATCH",
    );

    const mismatched = createTest();
    const seeder = await addAdmin(mismatched);
    const versionId = await mismatched.run((ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "sealed",
        revision: 2,
        createdBy: seeder,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await mismatched.run(async (ctx) => {
      for (const entry of initialV2Catalog.slice(1))
        await ctx.db.insert("taxonomyEntries", {
          ...entry,
          taxonomyVersionId: versionId,
        });
    });
    await expect(install(mismatched)).rejects.toThrow(
      "BLUEPRINT_TAXONOMY_MISMATCH",
    );
    expect(await installerUser(mismatched)).toBeNull();

    const duplicate = createTest();
    await installTaxonomy(duplicate);
    const duplicateOwner = await addAdmin(duplicate);
    await duplicate.run((ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "sealed",
        revision: 2,
        createdBy: duplicateOwner,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(install(duplicate)).rejects.toThrow(
      "BLUEPRINT_TAXONOMY_MISMATCH",
    );
  });

  it("rejects partial, draft, archived, duplicate, and unattributed versions", async () => {
    for (const state of ["draft", "archived"] as const) {
      const t = createTest();
      const taxonomy = await installTaxonomy(t);
      const installer = await addInstaller(t);
      await t.run(async (ctx) => {
        for (const candidate of initialV3Blueprints)
          await ctx.db.insert("blueprintVersions", {
            blueprintId: candidate.blueprintId,
            level: candidate.level,
            state,
            revision: 1,
            taxonomyVersionId: taxonomy.taxonomyVersionId,
            createdBy: installer,
            createdAt: 0,
            updatedAt: 0,
          });
      });
      const before = await counts(t);
      await expect(install(t)).rejects.toThrow("BLUEPRINT_VERSION_CONFLICT");
      expect(await counts(t)).toEqual(before);
    }

    const partial = createTest();
    const partialTaxonomy = await installTaxonomy(partial);
    const partialAdmin = await addAdmin(partial);
    await addActiveVersion(partial, {
      blueprintId: "cse-professional-2027-v3",
      level: "professional",
      taxonomyVersionId: partialTaxonomy.taxonomyVersionId,
      userId: partialAdmin,
    });
    const partialBefore = await counts(partial);
    await expect(install(partial)).rejects.toThrow(
      "BLUEPRINT_VERSION_CONFLICT",
    );
    expect(await counts(partial)).toEqual(partialBefore);

    const duplicate = createTest();
    const duplicateTaxonomy = await installTaxonomy(duplicate);
    const duplicateAdmin = await addAdmin(duplicate);
    await duplicate.run(async (ctx) => {
      for (const [index, candidate] of initialV3Blueprints.entries())
        await ctx.db.insert("blueprintVersions", {
          blueprintId: candidate.blueprintId,
          level: candidate.level,
          state: "draft",
          revision: 1,
          taxonomyVersionId: duplicateTaxonomy.taxonomyVersionId,
          createdBy: duplicateAdmin,
          createdAt: index,
          updatedAt: index,
        });
      const [professional] = initialV3Blueprints;
      await ctx.db.insert("blueprintVersions", {
        blueprintId: professional.blueprintId,
        level: professional.level,
        state: "draft",
        revision: 1,
        taxonomyVersionId: duplicateTaxonomy.taxonomyVersionId,
        createdBy: duplicateAdmin,
        createdAt: 2,
        updatedAt: 2,
      });
    });
    const duplicateBefore = await counts(duplicate);
    await expect(install(duplicate)).rejects.toThrow(
      "BLUEPRINT_VERSION_CONFLICT",
    );
    expect(await counts(duplicate)).toEqual(duplicateBefore);
  });

  it("rejects unattributed active versions that otherwise look installed", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    await addInstaller(t);
    const admin = await addAdmin(t);
    await addActiveVersion(t, {
      blueprintId: "cse-professional-2027-v3",
      level: "professional",
      taxonomyVersionId: taxonomy.taxonomyVersionId,
      userId: admin,
    });
    await addActiveVersion(t, {
      blueprintId: "cse-subprofessional-2027-v3",
      level: "subprofessional",
      taxonomyVersionId: taxonomy.taxonomyVersionId,
      userId: admin,
    });
    const before = await counts(t);
    await expect(install(t)).rejects.toThrow("BLUEPRINT_VERSION_CONFLICT");
    expect(await counts(t)).toEqual(before);
  });

  it("rejects rerun versions whose configuration or hash no longer matches", async () => {
    const configuration = createTest();
    await installTaxonomy(configuration);
    const configurationInstall = await install(configuration);
    const professional = configurationInstall.levels[0];
    const stored = await configuration.run((ctx) =>
      ctx.db.get("blueprintVersions", professional.blueprintVersionId),
    );
    const foreign = normalizeBlueprintConfiguration(
      fixture("cse-subprofessional-2027-v3").configuration,
    );
    const foreignHash = await blueprintContentHash(
      2,
      stored!.level,
      stored!.taxonomyVersionId,
      foreign,
      {
        blueprintVersionId: stored!._id,
        blueprintId: stored!.blueprintId,
      },
    );
    await configuration.run((ctx) =>
      ctx.db.patch("blueprintVersions", professional.blueprintVersionId, {
        configuration: foreign,
        contentHash: foreignHash,
      }),
    );
    const configurationBefore = await counts(configuration);
    await expect(install(configuration)).rejects.toThrow(
      "BLUEPRINT_VERSION_CONFLICT",
    );
    expect(await counts(configuration)).toEqual(configurationBefore);

    const hash = createTest();
    await installTaxonomy(hash);
    const hashInstall = await install(hash);
    await hash.run((ctx) =>
      ctx.db.patch(
        "blueprintVersions",
        hashInstall.levels[0].blueprintVersionId,
        { contentHash: "f".repeat(64) },
      ),
    );
    const hashBefore = await counts(hash);
    await expect(install(hash)).rejects.toThrow("BLUEPRINT_VERSION_CONFLICT");
    expect(await counts(hash)).toEqual(hashBefore);
  });

  it("rejects pointer anomalies before any write", async () => {
    const orphan = createTest();
    const taxonomy = await installTaxonomy(orphan);
    const admin = await addAdmin(orphan);
    await orphan.run(async (ctx) => {
      const now = Date.now();
      const versionId = await ctx.db.insert("blueprintVersions", {
        blueprintId: "cse-professional-2026-v2",
        level: "professional",
        state: "active",
        revision: 3,
        taxonomyVersionId: taxonomy.taxonomyVersionId,
        configuration: fixture("cse-professional-2027-v3").configuration,
        contentHash: "a".repeat(64),
        configurationFormatVersion: 2,
        createdBy: admin,
        createdAt: now,
        updatedAt: now,
        activatedBy: admin,
        activatedAt: now,
      });
      expect(versionId).toBeDefined();
    });
    const orphanBefore = await counts(orphan);
    await expect(install(orphan)).rejects.toThrow(
      "ACTIVE_BLUEPRINT_INCONSISTENT",
    );
    expect(await counts(orphan)).toEqual(orphanBefore);

    const duplicatePointer = createTest();
    const duplicateTaxonomy = await installTaxonomy(duplicatePointer);
    const duplicateAdmin = await addAdmin(duplicatePointer);
    const prior = await addActiveVersion(duplicatePointer, {
      blueprintId: "cse-professional-2026-v2",
      level: "professional",
      taxonomyVersionId: duplicateTaxonomy.taxonomyVersionId,
      userId: duplicateAdmin,
    });
    await duplicatePointer.run((ctx) =>
      ctx.db.insert("activeBlueprints", {
        level: "professional",
        blueprintVersionId: prior.id,
        activatedBy: duplicateAdmin,
        activatedAt: 0,
      }),
    );
    const pointerBefore = await counts(duplicatePointer);
    await expect(install(duplicatePointer)).rejects.toThrow(
      "ACTIVE_BLUEPRINT_INCONSISTENT",
    );
    expect(await counts(duplicatePointer)).toEqual(pointerBefore);
  });
});

describe("read-only blueprint verification", () => {
  it("reports absence without the bootstrap window and writes nothing", async () => {
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const t = createTest();
    const report = await verify(t);
    expect(report).toMatchObject({
      target: "fixture",
      taxonomyId: "cse-taxonomy-2027-v2",
      taxonomyVersionId: null,
      taxonomySealed: false,
      taxonomyMatchesExpected: false,
      expectedFixtureDigest: seedBlueprintPolicy.digest,
      deployedFixtureDigest: seedBlueprintPolicy.digest,
      fixtureDigestMatches: true,
      matchesExpected: false,
    });
    expect(report.levels).toHaveLength(2);
    for (const level of report.levels) {
      expect(level).toMatchObject({
        present: false,
        versionIds: [],
        duplicateVersions: false,
        state: null,
        revision: null,
        active: false,
        sealed: false,
        hashMatches: false,
        configurationMatches: false,
        taxonomyMatches: false,
        counts: null,
        pointerVersionId: null,
        pointerConsistent: true,
        systemAttributed: false,
        matchesExpected: false,
      });
      expect(level.expectedCounts).toEqual(
        expectedCounts[level.expectedBlueprintId],
      );
    }
    expect(await counts(t)).toMatchObject({
      users: 0,
      versions: 0,
      pointers: 0,
      audits: 0,
    });
  });

  it("reports the installed versions with hashes, counts, and pointer state", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    const installed = await install(t);
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const report = await verify(t);
    expect(report).toMatchObject({
      target: "fixture",
      taxonomyVersionId: taxonomy.taxonomyVersionId,
      taxonomySealed: true,
      taxonomyMatchesExpected: true,
      expectedFixtureDigest: seedBlueprintPolicy.digest,
      deployedFixtureDigest: seedBlueprintPolicy.digest,
      fixtureDigestMatches: true,
      matchesExpected: true,
    });
    expect(report.levels).toHaveLength(2);
    for (const level of report.levels) {
      const installedLevel = installed.levels.find(
        (candidate) => candidate.blueprintId === level.expectedBlueprintId,
      )!;
      expect(level).toMatchObject({
        present: true,
        versionIds: [installedLevel.blueprintVersionId],
        duplicateVersions: false,
        state: "active",
        revision: installedLevel.revision,
        active: true,
        sealed: true,
        configurationFormatVersion: 2,
        contentHash: installedLevel.configurationHash,
        hashMatches: true,
        configurationMatches: true,
        taxonomyMatches: true,
        counts: expectedCounts[level.expectedBlueprintId],
        expectedCounts: expectedCounts[level.expectedBlueprintId],
        pointerVersionId: installedLevel.blueprintVersionId,
        pointerConsistent: true,
        systemAttributed: true,
        matchesExpected: true,
      });
    }
  });

  it("reports tampered or malformed stored state without throwing", async () => {
    const t = createTest();
    await installTaxonomy(t);
    const installed = await install(t);
    const professional = installed.levels[0];

    const tamper = async (patch: Record<string, unknown>) => {
      await t.run((ctx) =>
        ctx.db.patch(
          "blueprintVersions",
          professional.blueprintVersionId,
          patch,
        ),
      );
      const report = await verify(t);
      expect(report.matchesExpected).toBe(false);
      return report.levels[0];
    };

    let level = await tamper({ contentHash: "f".repeat(64) });
    expect(level).toMatchObject({
      hashMatches: false,
      sealed: false,
      matchesExpected: false,
    });

    level = await tamper({ state: "archived" });
    expect(level).toMatchObject({ active: false, matchesExpected: false });

    const installer = await installerUser(t);
    await t.run((ctx) =>
      ctx.db.insert("blueprintVersions", {
        blueprintId: "cse-professional-2027-v3",
        level: "professional",
        state: "draft",
        revision: 1,
        taxonomyVersionId: installed.taxonomyVersionId,
        createdBy: installer!._id,
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    level = (await verify(t)).levels[0];
    expect(level).toMatchObject({
      duplicateVersions: true,
      matchesExpected: false,
    });
  });

  it("requires the current configuration format for rerun and verification", async () => {
    const t = createTest();
    await installTaxonomy(t);
    const installed = await install(t);
    const professional = installed.levels[0];
    const version = await t.run((ctx) =>
      ctx.db.get("blueprintVersions", professional.blueprintVersionId),
    );
    const legacyHash = await blueprintContentHash(
      1,
      version!.level,
      version!.taxonomyVersionId,
      version!.configuration!,
      {
        blueprintVersionId: version!._id,
        blueprintId: version!.blueprintId,
      },
    );
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", professional.blueprintVersionId, {
        configurationFormatVersion: 1,
        contentHash: legacyHash,
      }),
    );
    const level = (await verify(t)).levels[0];
    expect(level).toMatchObject({
      configurationFormatVersion: 1,
      hashMatches: true,
      active: true,
      sealed: true,
      matchesExpected: false,
    });
    const before = await counts(t);
    await expect(install(t)).rejects.toThrow("BLUEPRINT_VERSION_CONFLICT");
    expect(await counts(t)).toEqual(before);
  });

  it("reports a missing pointer for a present draft or archived version", async () => {
    const t = createTest();
    await installTaxonomy(t);
    const installed = await install(t);
    await t.run(async (ctx) => {
      const pointer = await ctx.db
        .query("activeBlueprints")
        .withIndex("by_level", (q) => q.eq("level", "professional"))
        .unique();
      await ctx.db.delete("activeBlueprints", pointer!._id);
    });
    for (const state of ["draft", "archived"] as const) {
      await t.run((ctx) =>
        ctx.db.patch(
          "blueprintVersions",
          installed.levels[0].blueprintVersionId,
          { state },
        ),
      );
      expect((await verify(t)).levels[0]).toMatchObject({
        present: true,
        state,
        pointerVersionId: null,
        pointerConsistent: false,
        matchesExpected: false,
      });
    }
  });

  it("reports missing or duplicate pointers", async () => {
    const t = createTest();
    await installTaxonomy(t);
    const installed = await install(t);
    const installer = await installerUser(t);
    const pointer = await t.run((ctx) =>
      ctx.db
        .query("activeBlueprints")
        .withIndex("by_level", (q) => q.eq("level", "professional"))
        .unique(),
    );
    await t.run((ctx) => ctx.db.delete("activeBlueprints", pointer!._id));
    let level = (await verify(t)).levels[0];
    expect(level).toMatchObject({
      pointerVersionId: null,
      pointerConsistent: false,
      matchesExpected: false,
    });

    await t.run((ctx) =>
      ctx.db.insert("activeBlueprints", {
        level: "professional",
        blueprintVersionId: installed.levels[0].blueprintVersionId,
        activatedBy: installer!._id,
        activatedAt: 0,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("activeBlueprints", {
        level: "professional",
        blueprintVersionId: installed.levels[0].blueprintVersionId,
        activatedBy: installer!._id,
        activatedAt: 0,
      }),
    );
    level = (await verify(t)).levels[0];
    expect(level).toMatchObject({
      pointerConsistent: false,
      matchesExpected: false,
    });
  });

  it("reports a foreign active version alongside the expected pointer", async () => {
    const t = createTest();
    const taxonomy = await installTaxonomy(t);
    const installed = await install(t);
    const installer = await installerUser(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("blueprintVersions", {
        blueprintId: "cse-professional-2026-v2",
        level: "professional",
        state: "active",
        revision: 3,
        taxonomyVersionId: taxonomy.taxonomyVersionId,
        createdBy: installer!._id,
        createdAt: now,
        updatedAt: now,
        activatedBy: installer!._id,
        activatedAt: now,
      });
    });
    const level = (await verify(t)).levels[0];
    expect(level).toMatchObject({
      versionIds: [installed.levels[0].blueprintVersionId],
      pointerVersionId: installed.levels[0].blueprintVersionId,
      pointerConsistent: false,
      matchesExpected: false,
    });
  });

  it("rejects an unregistered verification target", async () => {
    const t = createTest();
    await expect(
      t.query(internal.blueprintBootstrap.verify, { target: "production" }),
    ).rejects.toThrow("BOOTSTRAP_TARGET_DISABLED");
  });
});

describe("installer identity and exposure", () => {
  it("keeps the installer non-login and accepts no actor argument", async () => {
    const t = createTest();
    await installTaxonomy(t);
    await install(t);
    const systemIdentity = t.withIdentity({
      issuer: "https://test",
      subject: "blueprint-system",
    });
    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "https://test|blueprint-system",
        role: "system",
        status: "active",
      }),
    );
    await expect(
      systemIdentity.query(api.users.currentAccess),
    ).resolves.toEqual({ status: "suspended" });
    await expect(
      systemIdentity.mutation(api.users.ensureCurrentUser),
    ).rejects.toThrow("ACCOUNT_SUSPENDED");
    const args = JSON.parse(
      (
        blueprintBootstrap.install as unknown as { exportArgs(): string }
      ).exportArgs(),
    );
    expect(Object.keys(args.value).sort()).toEqual(["fixtureDigest", "target"]);
    expect(
      JSON.stringify(
        (
          blueprintBootstrap.install as unknown as { exportArgs(): string }
        ).exportArgs(),
      ),
    ).not.toContain("actor");
  });

  it("exposes only internal functions", () => {
    const installFunction = blueprintBootstrap.install as unknown as Record<
      string,
      unknown
    >;
    const verifyFunction = blueprintBootstrap.verify as unknown as Record<
      string,
      unknown
    >;
    expect(installFunction.isInternal).toBe(true);
    expect(installFunction.isMutation).toBe(true);
    expect(installFunction.isPublic).toBeUndefined();
    expect(verifyFunction.isInternal).toBe(true);
    expect(verifyFunction.isQuery).toBe(true);
    expect(verifyFunction.isPublic).toBeUndefined();
  });
});

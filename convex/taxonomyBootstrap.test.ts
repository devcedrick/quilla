// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import * as taxonomyBootstrap from "./taxonomyBootstrap";
import * as referenceData from "./referenceData";
import * as usersModule from "./users";
import {
  importDigest,
  seedTaxonomyPolicy,
} from "../lib/question-import-contract.mjs";
import { digest } from "./lib/questionContent";
import { validateCatalog } from "./lib/taxonomy";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import {
  assertSeedTaxonomyCatalog,
  catalogMatchesFrozen,
  systemTaxonomyInstallerIdentifier,
  taxonomyCounts,
} from "./lib/taxonomyBootstrap";

vi.mock("../lib/question-import-contract.mjs", async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    approvedImportTargets: {
      fixture: "https://fixture.convex.cloud",
    },
  };
});

const { api, internal, createTest } = defineTestApp({ schema }).defineModules({
  taxonomyBootstrap,
  referenceData,
  users: usersModule,
});

const expectedCounts = {
  level: 2,
  difficulty: 3,
  language: 2,
  subject: 5,
  subtopic: 9,
  concept: 12,
  total: 33,
};

function install(
  t: ReturnType<typeof createTest>,
  overrides: Record<string, unknown> = {},
) {
  return t.mutation(internal.taxonomyBootstrap.install, {
    target: "fixture",
    catalogDigest: seedTaxonomyPolicy.digest,
    ...overrides,
  });
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

async function installerUser(t: ReturnType<typeof createTest>) {
  return await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", systemTaxonomyInstallerIdentifier),
      )
      .unique(),
  );
}

async function catalogRows(
  t: ReturnType<typeof createTest>,
  taxonomyVersionId: Awaited<ReturnType<typeof install>>["taxonomyVersionId"],
) {
  return await t.run((ctx) =>
    ctx.db
      .query("taxonomyEntries")
      .withIndex("by_taxonomyVersionId", (q) =>
        q.eq("taxonomyVersionId", taxonomyVersionId),
      )
      .take(129),
  );
}

beforeEach(() => {
  vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
});

describe("frozen taxonomy catalog", () => {
  it("pins the reviewed digest and exact counts", async () => {
    expect(seedTaxonomyPolicy).toMatchObject({
      taxonomyId: "cse-taxonomy-2027-v2",
      expectedEntries: 33,
      digest:
        "95a53420395e5df7408fbaa159fb441330f9d851daa121d6b4b847be6bcff76f",
    });
    expect(seedTaxonomyPolicy.expectedCounts).toEqual({
      level: 2,
      difficulty: 3,
      language: 2,
      subject: 5,
      subtopic: 9,
      concept: 12,
    });
    expect(await digest(initialV2Catalog)).toBe(seedTaxonomyPolicy.digest);
    expect(await importDigest(initialV2Catalog)).toBe(
      seedTaxonomyPolicy.digest,
    );
    expect(taxonomyCounts(initialV2Catalog)).toEqual(expectedCounts);
    await expect(assertSeedTaxonomyCatalog(initialV2Catalog)).resolves.toEqual(
      expectedCounts,
    );
  });

  it("rejects a tampered catalog before any write", async () => {
    const tampered = [
      { ...initialV2Catalog[0], label: "Changed label" },
      ...initialV2Catalog.slice(1),
    ];
    for (const candidate of [
      [...initialV2Catalog, initialV2Catalog[0]],
      initialV2Catalog.slice(1),
      tampered,
      [
        ...initialV2Catalog,
        {
          kind: "level" as const,
          key: "extra_level",
          label: "extra level",
          archived: false,
        },
      ],
    ])
      await expect(assertSeedTaxonomyCatalog(candidate)).rejects.toThrow(
        "TAXONOMY_CATALOG_MISMATCH",
      );
    await expect(
      assertSeedTaxonomyCatalog(initialV2Catalog, "cse-taxonomy-2027-v1"),
    ).rejects.toThrow("TAXONOMY_CATALOG_MISMATCH");
  });

  it("compares stored rows without depending on insertion order", async () => {
    const forward = initialV2Catalog;
    const reversed = [...initialV2Catalog].reverse();
    expect(catalogMatchesFrozen(forward)).toBe(true);
    expect(catalogMatchesFrozen(reversed)).toBe(true);
    expect(catalogMatchesFrozen(forward.slice(1))).toBe(false);
    expect(catalogMatchesFrozen([...forward, forward[0]])).toBe(false);
    expect(
      catalogMatchesFrozen([
        { ...forward[0], label: "changed" },
        ...forward.slice(1),
      ]),
    ).toBe(false);
  });
});

describe("sealed taxonomy installation", () => {
  it("installs and seals the exact catalog in one bounded mutation", async () => {
    const t = createTest();
    const result = await install(t);
    expect(result).toEqual({
      taxonomyVersionId: expect.any(String),
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 2,
      created: true,
      counts: expectedCounts,
      digest: seedTaxonomyPolicy.digest,
    });
    const version = await t.run((ctx) =>
      ctx.db.get("taxonomyVersions", result.taxonomyVersionId),
    );
    expect(version).toMatchObject({
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 2,
    });
    const rows = await catalogRows(t, result.taxonomyVersionId);
    expect(rows).toHaveLength(33);
    expect(rows.filter((entry) => entry.archived)).toHaveLength(0);
    validateCatalog(rows, true);
    expect(catalogMatchesFrozen(rows)).toBe(true);
  });

  it("attributes both events to the non-login installer", async () => {
    const t = createTest();
    const result = await install(t);
    const installer = await installerUser(t);
    expect(installer).toMatchObject({
      tokenIdentifier: systemTaxonomyInstallerIdentifier,
      role: "system",
      status: "active",
    });
    const audits = await t.run((ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_occurredAt", (q) =>
          q
            .eq("entityType", "taxonomy_version")
            .eq("entityId", result.taxonomyVersionId),
        )
        .take(10),
    );
    expect(audits.map((event) => event.action).sort()).toEqual([
      "sealed",
      "seed_install",
    ]);
    expect(audits.every((event) => event.actorId === installer!._id)).toBe(
      true,
    );
    const installed = audits.find((event) => event.action === "seed_install")!;
    expect(JSON.parse(installed.afterJson!)).toMatchObject({
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "draft",
      revision: 1,
      digest: seedTaxonomyPolicy.digest,
      counts: expectedCounts,
    });
    const sealed = audits.find((event) => event.action === "sealed")!;
    expect(JSON.parse(sealed.beforeJson!)).toEqual({
      state: "draft",
      revision: 1,
    });
    expect(JSON.parse(sealed.afterJson!)).toMatchObject({
      state: "sealed",
      revision: 2,
      digest: seedTaxonomyPolicy.digest,
      counts: expectedCounts,
    });
    expect(installed.beforeJson).toBeNull();
    expect(sealed.afterJson).not.toContain("question");
  });

  it("is a no-op when the exact sealed catalog already exists", async () => {
    const t = createTest();
    const first = await install(t);
    const second = await install(t);
    expect(second).toEqual({ ...first, created: false });
    expect(await catalogRows(t, first.taxonomyVersionId)).toHaveLength(33);
    expect(
      await t.run((ctx) => ctx.db.query("taxonomyVersions").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) => ctx.db.query("taxonomyEntries").collect()),
    ).toHaveLength(33);
    expect(
      await t.run((ctx) => ctx.db.query("auditEvents").collect()),
    ).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      1,
    );
  });

  it("writes only taxonomy, audit, and installer records", async () => {
    const t = createTest();
    await install(t);
    const untouched = await t.run(async (ctx) => ({
      questions: await ctx.db.query("questions").collect(),
      versions: await ctx.db.query("questionVersions").collect(),
      references: await ctx.db.query("questionReferenceVersions").collect(),
      assets: await ctx.db.query("questionAssets").collect(),
      imports: await ctx.db.query("questionImportRuns").collect(),
    }));
    expect(untouched).toEqual({
      questions: [],
      versions: [],
      references: [],
      assets: [],
      imports: [],
    });
  });

  it("fails closed on target, window, URL, and digest guards", async () => {
    for (const [overrides, code] of [
      [{ target: "prod" }, "BOOTSTRAP_TARGET_DISABLED"],
      [{ catalogDigest: "f".repeat(64) }, "TAXONOMY_CATALOG_MISMATCH"],
      [{ catalogDigest: "not-a-digest" }, "TAXONOMY_CATALOG_MISMATCH"],
    ] as const) {
      const t = createTest();
      await expect(install(t, overrides)).rejects.toThrow(code);
      expect(
        await t.run((ctx) => ctx.db.query("users").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("taxonomyEntries").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("taxonomyVersions").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("auditEvents").collect()),
      ).toHaveLength(0);
    }

    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const closed = createTest();
    await expect(install(closed)).rejects.toThrow("BOOTSTRAP_TARGET_DISABLED");

    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud/");
    const wrongUrl = createTest();
    await expect(install(wrongUrl)).rejects.toThrow(
      "BOOTSTRAP_TARGET_DISABLED",
    );
    vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
  });

  it("refuses a draft or mismatched existing taxonomy version", async () => {
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
    await expect(install(draft)).rejects.toThrow("TAXONOMY_VERSION_CONFLICT");
    expect(await installerUser(draft)).toBeNull();
    expect(
      await draft.run((ctx) => ctx.db.query("taxonomyEntries").collect()),
    ).toHaveLength(0);

    const mismatched = createTest();
    const owner = await addAdmin(mismatched);
    const versionId = await mismatched.run((ctx) =>
      ctx.db.insert("taxonomyVersions", {
        taxonomyId: "cse-taxonomy-2027-v2",
        state: "sealed",
        revision: 2,
        createdBy: owner,
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
      "TAXONOMY_VERSION_CONFLICT",
    );
    expect(await installerUser(mismatched)).toBeNull();
  });

  it("keeps system identities non-login and accepts no actor argument", async () => {
    const t = createTest();
    await install(t);
    const systemIdentity = t.withIdentity({
      issuer: "https://test",
      subject: "taxonomy-system",
    });
    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "https://test|taxonomy-system",
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
        taxonomyBootstrap.install as unknown as { exportArgs(): string }
      ).exportArgs(),
    );
    expect(Object.keys(args.value).sort()).toEqual(["catalogDigest", "target"]);
    expect(
      JSON.stringify(
        (
          taxonomyBootstrap.install as unknown as { exportArgs(): string }
        ).exportArgs(),
      ),
    ).not.toContain("actor");
  });

  it("exposes only internal functions", () => {
    const install = taxonomyBootstrap.install as unknown as Record<
      string,
      unknown
    >;
    const verify = taxonomyBootstrap.verify as unknown as Record<
      string,
      unknown
    >;
    expect(install.isInternal).toBe(true);
    expect(install.isMutation).toBe(true);
    expect(install.isPublic).toBeUndefined();
    expect(verify.isInternal).toBe(true);
    expect(verify.isQuery).toBe(true);
    expect(verify.isPublic).toBeUndefined();
  });
});

describe("read-only taxonomy verification", () => {
  it("reports absence without the bootstrap window and writes nothing", async () => {
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const t = createTest();
    await expect(
      t.query(internal.taxonomyBootstrap.verify, { target: "fixture" }),
    ).resolves.toEqual({
      present: false,
      target: "fixture",
      taxonomyId: "cse-taxonomy-2027-v2",
      expectedDigest: seedTaxonomyPolicy.digest,
      expectedCounts,
    });
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      0,
    );
    expect(
      await t.run((ctx) => ctx.db.query("taxonomyVersions").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query("auditEvents").collect()),
    ).toHaveLength(0);
  });

  it("reports the installed version and exact expected content", async () => {
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const t = createTest();
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
    const installed = await install(t);
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    const report = await t.query(internal.taxonomyBootstrap.verify, {
      target: "fixture",
    });
    expect(report).toMatchObject({
      present: true,
      target: "fixture",
      taxonomyVersionId: installed.taxonomyVersionId,
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 2,
      sealed: true,
      archivedEntries: 0,
      counts: expectedCounts,
      matchesExpected: true,
      expectedDigest: seedTaxonomyPolicy.digest,
      expectedCounts,
    });
  });

  it("reports an archived entry as not matching expected content", async () => {
    const t = createTest();
    const installed = await install(t);
    const [first] = await catalogRows(t, installed.taxonomyVersionId);
    await t.run((ctx) =>
      ctx.db.patch("taxonomyEntries", first._id, { archived: true }),
    );
    const report = await t.query(internal.taxonomyBootstrap.verify, {
      target: "fixture",
    });
    expect(report).toMatchObject({
      present: true,
      sealed: true,
      archivedEntries: 1,
      matchesExpected: false,
    });
  });

  it("rejects an unregistered verification target", async () => {
    const t = createTest();
    await expect(
      t.query(internal.taxonomyBootstrap.verify, { target: "production" }),
    ).rejects.toThrow("BOOTSTRAP_TARGET_DISABLED");
  });
});

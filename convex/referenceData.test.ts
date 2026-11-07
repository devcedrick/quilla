// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { describe, expect, it } from "vitest";
import * as referenceData from "./referenceData";
import schema from "./schema";
import { validateCatalog, validateTaxonomySelection } from "./lib/taxonomy";
import { initialV2Catalog, v2Concepts } from "./lib/taxonomyCatalog";
import { seedPolicy } from "../scripts/question-bank-policy.mjs";
const { api, createTest } = defineTestApp({ schema }).defineModules({
  referenceData,
});
const opts = { numItems: 100, cursor: null };
async function setup() {
  const t = createTest();
  await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "https://test|admin",
      role: "admin",
      status: "active",
    }),
  );
  const admin = t.withIdentity({ issuer: "https://test", subject: "admin" });
  const id = await admin.mutation(api.referenceData.createDraft, {
    taxonomyId: "cse-taxonomy-2027-v2",
  });
  let revision = 1;
  for (const entry of initialV2Catalog)
    revision = await admin.mutation(api.referenceData.upsertEntry, {
      taxonomyVersionId: id,
      expectedRevision: revision,
      entry,
    });
  return { t, admin, id, revision };
}
const selection = {
  taxonomyId: "cse-taxonomy-2027-v2",
  subjectKey: "numerical_ability",
  subtopicKey: "numerical_reasoning",
  conceptKey: "data_sufficiency",
  level: "professional",
  language: "english",
  difficulty: "hard",
};
describe("taxonomy", () => {
  it("matches the approved v2 concept relationships", () => {
    const actual = v2Concepts.map((r) => r.join(":"));
    const expected = Object.entries(seedPolicy.concepts).flatMap(
      ([subject, pairs]) =>
        (typeof pairs[0] === "string" ? [pairs] : pairs).map((pair) =>
          [subject, ...pair].join(":"),
        ),
    );
    expect(actual.sort()).toEqual(expected.sort());
    expect(actual).toHaveLength(12);
    expect(() => validateCatalog(initialV2Catalog, true)).not.toThrow();
  });
  it("supports draft edits, no-ops, exact lookup, sealing and historical archival", async () => {
    const { t, admin, id, revision } = await setup();
    const before = (await t.run((ctx) => ctx.db.query("auditEvents").take(128)))
      .length;
    expect(
      await admin.mutation(api.referenceData.upsertEntry, {
        taxonomyVersionId: id,
        expectedRevision: revision,
        entry: initialV2Catalog[0],
      }),
    ).toBe(revision);
    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(128))).length,
    ).toBe(before);
    await expect(
      admin.run((ctx) => validateTaxonomySelection(ctx, selection)),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
    const next = await admin.mutation(api.referenceData.sealVersion, {
      taxonomyVersionId: id,
      expectedRevision: revision,
    });
    expect(
      await admin.run((ctx) => validateTaxonomySelection(ctx, selection)),
    ).toBe(id);
    await expect(
      admin.run((ctx) =>
        validateTaxonomySelection(ctx, {
          ...selection,
          subtopicKey: "reading",
        }),
      ),
    ).rejects.toMatchObject({ data: { code: "INVALID_TAXONOMY_PATH" } });
    await expect(
      admin.mutation(api.referenceData.upsertEntry, {
        taxonomyVersionId: id,
        expectedRevision: next,
        entry: initialV2Catalog[0],
      }),
    ).rejects.toMatchObject({ data: { code: "IMMUTABLE_TAXONOMY" } });
    await admin.mutation(api.referenceData.archiveVersion, {
      taxonomyVersionId: id,
      expectedRevision: next,
    });
    await expect(
      admin.run((ctx) => validateTaxonomySelection(ctx, selection)),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
    expect(
      await admin.query(api.referenceData.getEntry, {
        taxonomyVersionId: id,
        kind: "concept",
        key: "data_sufficiency",
      }),
    ).toMatchObject({ subjectKey: "numerical_ability" });
    expect(
      (
        await admin.query(api.referenceData.listVersions, {
          state: "archived",
          paginationOpts: opts,
        })
      ).page,
    ).toHaveLength(1);
  });
  it("rejects stale edits, referenced parents and duplicate versions without partial writes", async () => {
    const { t, admin, id, revision } = await setup();
    await expect(
      admin.mutation(api.referenceData.createDraft, {
        taxonomyId: selection.taxonomyId,
      }),
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_IDENTITY" } });
    await expect(
      admin.mutation(api.referenceData.sealVersion, {
        taxonomyVersionId: id,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ data: { code: "STALE_REVISION" } });
    await expect(
      admin.mutation(api.referenceData.archiveEntry, {
        taxonomyVersionId: id,
        expectedRevision: revision,
        kind: "subject",
        key: "numerical_ability",
      }),
    ).rejects.toMatchObject({ data: { code: "REFERENCED_PARENT" } });
    expect(
      (await t.run((ctx) => ctx.db.get("taxonomyVersions", id)))?.revision,
    ).toBe(revision);
    const first = await admin.query(api.referenceData.listEntries, {
      taxonomyVersionId: id,
      kind: "concept",
      paginationOpts: { numItems: 1, cursor: null },
    });
    const second = await admin.query(api.referenceData.listEntries, {
      taxonomyVersionId: id,
      kind: "concept",
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    });
    expect(first.page[0]._id).not.toBe(second.page[0]._id);
    await expect(
      admin.query(api.referenceData.listEntries, {
        taxonomyVersionId: id,
        paginationOpts: { numItems: 101, cursor: null },
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_PAGE_SIZE" } });
  });
  it("denies every endpoint for anonymous, missing, nonadmin and suspended profiles", async () => {
    const { t, id, revision } = await setup();
    for (const [subject, role, status] of [
      ["user", "user", "active"],
      ["suspended", "admin", "suspended"],
    ] as const)
      await t.run((ctx) =>
        ctx.db.insert("users", {
          tokenIdentifier: `https://test|${subject}`,
          role,
          status,
        }),
      );
    for (const client of [
      t,
      ...["missing", "user", "suspended"].map((subject) =>
        t.withIdentity({ issuer: "https://test", subject }),
      ),
    ]) {
      const args = { taxonomyVersionId: id, expectedRevision: revision };
      for (const op of [
        () =>
          client.mutation(api.referenceData.createDraft, {
            taxonomyId: "denied",
          }),
        () =>
          client.mutation(api.referenceData.upsertEntry, {
            ...args,
            entry: initialV2Catalog[0],
          }),
        () =>
          client.mutation(api.referenceData.archiveEntry, {
            ...args,
            kind: "level",
            key: "professional",
          }),
        () => client.mutation(api.referenceData.sealVersion, args),
        () => client.mutation(api.referenceData.archiveVersion, args),
        () =>
          client.query(api.referenceData.listVersions, {
            paginationOpts: opts,
          }),
        () =>
          client.query(api.referenceData.listEntries, {
            taxonomyVersionId: id,
            paginationOpts: opts,
          }),
        () =>
          client.query(api.referenceData.getEntry, {
            taxonomyVersionId: id,
            kind: "level",
            key: "professional",
          }),
      ])
        await expect(op()).rejects.toThrow();
    }
  });
  it("rejects invalid hierarchies and bounds", () => {
    expect(() =>
      validateCatalog([...initialV2Catalog, initialV2Catalog[0]]),
    ).toThrow();
    expect(() =>
      validateCatalog(
        initialV2Catalog.map((e) =>
          e.kind === "subject" && e.key === "clerical_ability"
            ? { ...e, levels: ["professional"] }
            : e,
        ),
      ),
    ).toThrow();
    expect(() =>
      validateCatalog(
        initialV2Catalog.map((e) =>
          e.kind === "concept" ? { ...e, subtopicKey: "missing" } : e,
        ),
      ),
    ).toThrow();
    expect(() =>
      validateCatalog([
        { kind: "level", key: "professional", label: "", archived: false },
      ]),
    ).toThrow();
    expect(() =>
      validateCatalog(Array.from({ length: 129 }, () => initialV2Catalog[0])),
    ).toThrow();
    expect(() => validateCatalog([], true)).toThrow();
    expect(() =>
      validateCatalog(
        initialV2Catalog.map((e) =>
          e.kind === "concept"
            ? { ...e, levels: ["professional", "professional"] }
            : e,
        ),
      ),
    ).toThrow();
    expect(() =>
      validateCatalog(
        initialV2Catalog.map((e) =>
          e.kind === "subtopic" ? { ...e, subjectKey: "absent" } : e,
        ),
      ),
    ).toThrow();
    expect(() =>
      validateCatalog([
        { kind: "level", key: "Bad Key", label: "invalid", archived: false },
      ]),
    ).toThrow();
    expect(() =>
      validateCatalog([
        {
          kind: "level",
          key: "professional",
          label: "x".repeat(201),
          archived: false,
        },
      ]),
    ).toThrow();
  });
  it("edits and archives draft leaves without modifying a different version", async () => {
    const { admin, id, revision } = await setup();
    const leaf = initialV2Catalog.find(
      (e) => e.kind === "concept" && e.key === "data_sufficiency",
    )!;
    const next = await admin.mutation(api.referenceData.upsertEntry, {
      taxonomyVersionId: id,
      expectedRevision: revision,
      entry: { ...leaf, label: "Data Sufficiency" },
    });
    await admin.mutation(api.referenceData.archiveEntry, {
      taxonomyVersionId: id,
      expectedRevision: next,
      kind: "concept",
      key: leaf.key,
    });
    await expect(
      admin.mutation(api.referenceData.sealVersion, {
        taxonomyVersionId: id,
        expectedRevision: next + 1,
      }),
    ).rejects.toMatchObject({ data: { code: "INCOMPLETE_CATALOG" } });
    expect(
      await admin.query(api.referenceData.getEntry, {
        taxonomyVersionId: id,
        kind: "concept",
        key: leaf.key,
      }),
    ).toMatchObject({ label: "Data Sufficiency", archived: true });
    const other = await admin.mutation(api.referenceData.createDraft, {
      taxonomyId: "next-taxonomy",
    });
    expect(
      await admin.query(api.referenceData.getEntry, {
        taxonomyVersionId: other,
        kind: "concept",
        key: leaf.key,
      }),
    ).toBeNull();
    await expect(
      admin.mutation(api.referenceData.sealVersion, {
        taxonomyVersionId: other,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ data: { code: "INCOMPLETE_CATALOG" } });
  });
  it("serializes competing revisions and rolls back domain and audit writes together", async () => {
    const { t, admin, id, revision } = await setup();
    const args = { taxonomyVersionId: id, expectedRevision: revision };
    const decisions = await Promise.allSettled([
      admin.mutation(api.referenceData.sealVersion, args),
      admin.mutation(api.referenceData.archiveVersion, args),
    ]);
    expect(decisions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((r) => r.status === "rejected")).toHaveLength(1);
    const state = await t.run((ctx) => ctx.db.get("taxonomyVersions", id));
    const count = (await t.run((ctx) => ctx.db.query("auditEvents").take(128)))
      .length;
    await expect(
      admin.mutation(async (ctx) => {
        await ctx.runMutation(api.referenceData.createDraft, {
          taxonomyId: "rolled-back",
        });
        throw new Error("domain failure");
      }),
    ).rejects.toThrow("domain failure");
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("taxonomyVersions")
          .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", "rolled-back"))
          .unique(),
      ),
    ).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(128))).length,
    ).toBe(count);
    expect(
      (await t.run((ctx) => ctx.db.get("taxonomyVersions", id)))?.revision,
    ).toBe(state?.revision);
  });
});

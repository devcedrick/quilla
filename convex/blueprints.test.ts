// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import * as blueprints from "./blueprints";
import schema from "./schema";
import { initialV3Blueprints } from "./lib/blueprintFixture";
import {
  blueprintContentHash,
  normalizeBlueprintConfiguration,
  type BlueprintLevel,
} from "./lib/blueprintValidation";
import { createBlueprintSnapshot } from "./lib/blueprints";
import { initialV2Catalog } from "./lib/taxonomyCatalog";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const opts = { numItems: 100, cursor: null };

async function setup() {
  const t = convexTest(schema, modules);
  const identity = { issuer: "https://test", subject: "admin" };
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: "https://test|admin",
      role: "admin",
      status: "active",
    }),
  );
  return { t, admin: t.withIdentity(identity), adminId };
}

type Setup = Awaited<ReturnType<typeof setup>>;
type Actor = Setup["admin"];

function fixture(level: BlueprintLevel) {
  const blueprint = initialV3Blueprints.find(
    (candidate) => candidate.level === level,
  );
  if (!blueprint) throw new Error(`Missing ${level} blueprint fixture`);
  return blueprint;
}

/** Create, populate and seal the approved v2 taxonomy. */
async function sealedTaxonomy(admin: Actor) {
  const id = await admin.mutation(api.referenceData.createDraft, {
    taxonomyId: fixture("professional").taxonomyId,
  });
  let revision = 1;
  for (const entry of initialV2Catalog)
    revision = await admin.mutation(api.referenceData.upsertEntry, {
      taxonomyVersionId: id,
      expectedRevision: revision,
      entry,
    });
  revision = await admin.mutation(api.referenceData.sealVersion, {
    taxonomyVersionId: id,
    expectedRevision: revision,
  });
  return { id, revision };
}

async function createDraft(
  admin: Actor,
  level: BlueprintLevel,
  taxonomyVersionId: Id<"taxonomyVersions">,
  blueprintId = fixture(level).blueprintId,
) {
  return await admin.mutation(api.blueprints.createDraft, {
    blueprintId,
    level,
    taxonomyVersionId,
  });
}

async function saveDraft(
  admin: Actor,
  level: BlueprintLevel,
  taxonomyVersionId: Id<"taxonomyVersions">,
  blueprintId?: string,
  configuration = fixture(level).configuration,
) {
  const id = await createDraft(admin, level, taxonomyVersionId, blueprintId);
  const revision = await admin.mutation(api.blueprints.saveConfiguration, {
    blueprintVersionId: id,
    expectedRevision: 1,
    configuration,
  });
  return { id, revision };
}

async function activate(
  admin: Actor,
  id: Id<"blueprintVersions">,
  expectedRevision: number,
) {
  return await admin.mutation(api.blueprints.activateVersion, {
    blueprintVersionId: id,
    expectedRevision,
  });
}

async function auditEvents(t: Setup["t"], entityId: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_entityType_and_entityId_and_occurredAt", (q) =>
        q.eq("entityType", "blueprint_version").eq("entityId", entityId),
      )
      .collect(),
  );
}

describe("blueprints", () => {
  it("creates, validates, activates and audits an approved blueprint", async () => {
    const { t, admin, adminId } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const { id, revision } = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
    );
    const activeRevision = await activate(admin, id, revision);
    expect(activeRevision).toBe(revision + 1);

    const normalized = normalizeBlueprintConfiguration(
      fixture("professional").configuration,
    );
    const version = await admin.query(api.blueprints.getVersion, {
      blueprintVersionId: id,
    });
    expect(version).toMatchObject({
      blueprintId: "cse-professional-2027-v3",
      level: "professional",
      state: "active",
      revision: activeRevision,
      taxonomyVersionId: taxonomy.id,
      createdBy: adminId,
      activatedBy: adminId,
    });
    expect(version!.configuration).toEqual(normalized);
    expect(version!.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(version!.configurationFormatVersion).toBe(2);

    expect(
      await admin.query(api.blueprints.getActive, {
        level: "professional",
      }),
    ).toMatchObject({ _id: id, state: "active" });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "subprofessional",
      }),
    ).toBeNull();

    const events = await auditEvents(t, id);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.action).sort()).toEqual([
      "activate",
      "create",
      "save",
    ]);
    expect(events.every((event) => event.actorId === adminId)).toBe(true);
    const save = events.find((event) => event.action === "save")!;
    expect(JSON.parse(save.afterJson!)).toEqual({
      revision: 2,
      contentHash: version!.contentHash,
      configurationFormatVersion: 2,
      configuration: normalized,
    });
    const activation = events.find((event) => event.action === "activate")!;
    expect(JSON.parse(activation.afterJson!)).toEqual({
      state: "active",
      revision: activeRevision,
      level: "professional",
      configurationFormatVersion: 2,
      previousActiveVersionId: null,
    });

    await expect(
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: activeRevision,
        configuration: normalized,
      }),
    ).rejects.toMatchObject({ data: { code: "IMMUTABLE_BLUEPRINT" } });
    await expect(
      admin.mutation(api.blueprints.archiveDraft, {
        blueprintVersionId: id,
        expectedRevision: activeRevision,
      }),
    ).rejects.toMatchObject({ data: { code: "IMMUTABLE_BLUEPRINT" } });
  });

  it("uses the persisted format version for activation and snapshots", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const { id, revision } = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
    );
    const storedFormatVersion = 1;
    const storedHash = await blueprintContentHash(
      storedFormatVersion,
      "professional",
      taxonomy.id,
      fixture("professional").configuration,
      {
        blueprintVersionId: id,
        blueprintId: fixture("professional").blueprintId,
      },
    );
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", id, {
        configurationFormatVersion: storedFormatVersion,
        contentHash: storedHash,
      }),
    );

    const activeRevision = await activate(admin, id, revision);
    expect(activeRevision).toBe(revision + 1);
    const snapshotId = await t.run((ctx) =>
      createBlueprintSnapshot(ctx, "professional"),
    );
    expect(
      await t.run((ctx) => ctx.db.get("blueprintSnapshots", snapshotId)),
    ).toMatchObject({
      blueprintVersionId: id,
      configurationFormatVersion: storedFormatVersion,
      contentHash: storedHash,
    });

    const activation = (await auditEvents(t, id)).find(
      (event) => event.action === "activate",
    )!;
    expect(JSON.parse(activation.beforeJson!)).toEqual({
      state: "draft",
      revision,
      contentHash: storedHash,
      configurationFormatVersion: storedFormatVersion,
    });
    expect(JSON.parse(activation.afterJson!)).toEqual({
      state: "active",
      revision: activeRevision,
      level: "professional",
      configurationFormatVersion: storedFormatVersion,
      previousActiveVersionId: null,
    });
  });

  it("requires a persisted format version before activation", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const { id, revision } = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
    );
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", id, {
        configurationFormatVersion: undefined,
      }),
    );
    await expect(activate(admin, id, revision)).rejects.toMatchObject({
      data: { code: "INCOMPLETE_BLUEPRINT" },
    });
  });

  it("rejects unsupported stored configuration formats", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const { id, revision } = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
    );
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", id, {
        configurationFormatVersion: 99,
      }),
    );
    await expect(activate(admin, id, revision)).rejects.toMatchObject({
      data: { code: "UNSUPPORTED_FORMAT_VERSION" },
    });
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: id,
      }),
    ).toMatchObject({ state: "draft", revision });
    expect(
      await admin.query(api.blueprints.getActive, { level: "professional" }),
    ).toBeNull();
  });

  it("treats an unchanged normalized save as a no-op", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const { id, revision } = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
    );
    const before = await t.run((ctx) => ctx.db.get("blueprintVersions", id));
    const saveEventsBefore = (await auditEvents(t, id)).filter(
      (event) => event.action === "save",
    );
    expect(saveEventsBefore).toHaveLength(1);

    const reordered = structuredClone(fixture("professional").configuration);
    reordered.cells.reverse();
    reordered.languages.reverse();
    reordered.concepts.reverse();
    expect(
      await admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: revision,
        configuration: reordered,
      }),
    ).toBe(revision);

    expect(await t.run((ctx) => ctx.db.get("blueprintVersions", id))).toEqual(
      before,
    );
    expect(
      (await auditEvents(t, id)).filter((event) => event.action === "save"),
    ).toHaveLength(1);
  });

  it("binds snapshots to the exact blueprint identity", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const active = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, active.id, active.revision);
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", active.id, {
        blueprintId: "cse-professional-2028-v4",
      }),
    );
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({ data: { code: "CONTENT_HASH_MISMATCH" } });
  });

  it("supersedes the prior active version and never mutates snapshots", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const first = await saveDraft(admin, "professional", taxonomy.id);
    const firstRevision = await activate(admin, first.id, first.revision);
    const firstSnapshot = await t.run((ctx) =>
      createBlueprintSnapshot(ctx, "professional"),
    );
    const firstRow = await t.run((ctx) =>
      ctx.db.get("blueprintSnapshots", firstSnapshot),
    );
    expect(firstRow).toMatchObject({
      level: "professional",
      blueprintVersionId: first.id,
      blueprintId: "cse-professional-2027-v3",
      taxonomyVersionId: taxonomy.id,
      configurationFormatVersion: 2,
    });
    expect(firstRow!.configuration).toEqual(
      normalizeBlueprintConfiguration(fixture("professional").configuration),
    );
    const tampered = structuredClone(
      normalizeBlueprintConfiguration(fixture("professional").configuration),
    );
    tampered.concepts = tampered.concepts.map((concept) => ({
      ...concept,
      minimum: 3,
    }));
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", first.id, {
        configuration: tampered,
      }),
    );
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({ data: { code: "CONTENT_HASH_MISMATCH" } });
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", first.id, {
        configuration: firstRow!.configuration,
      }),
    );

    const changed = structuredClone(fixture("professional").configuration);
    changed.concepts = changed.concepts.map((concept) => ({
      ...concept,
      minimum: 2,
    }));
    const secondId = await createDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    const secondRevision = await admin.mutation(
      api.blueprints.saveConfiguration,
      {
        blueprintVersionId: secondId,
        expectedRevision: 1,
        configuration: changed,
      },
    );
    const secondActive = await activate(admin, secondId, secondRevision);

    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: first.id,
      }),
    ).toMatchObject({
      state: "archived",
      revision: firstRevision + 1,
    });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "professional",
      }),
    ).toMatchObject({ _id: secondId, state: "active" });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "subprofessional",
      }),
    ).toBeNull();

    expect(
      await t.run((ctx) => ctx.db.get("blueprintSnapshots", firstSnapshot)),
    ).toEqual(firstRow);
    const secondSnapshot = await t.run((ctx) =>
      createBlueprintSnapshot(ctx, "professional"),
    );
    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(
      await t.run((ctx) => ctx.db.get("blueprintSnapshots", secondSnapshot)),
    ).toMatchObject({
      blueprintVersionId: secondId,
      blueprintId: "cse-professional-2028-v4",
    });
    expect(
      (await t.run((ctx) =>
        ctx.db.get("blueprintSnapshots", secondSnapshot),
      ))!.configuration.concepts.every((concept) => concept.minimum === 2),
    ).toBe(true);

    const events = await auditEvents(t, first.id);
    const supersede = events.find((event) => event.action === "supersede")!;
    expect(JSON.parse(supersede.afterJson!)).toEqual({
      state: "archived",
      revision: firstRevision + 1,
      supersededBy: secondId,
    });
    expect(secondActive).toBe(secondRevision + 1);
  });

  it("rejects invalid, stale, tampered and incomplete activations atomically", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const id = await createDraft(admin, "professional", taxonomy.id);

    await expect(activate(admin, id, 1)).rejects.toMatchObject({
      data: { code: "INCOMPLETE_BLUEPRINT" },
    });

    const invalid = structuredClone(fixture("professional").configuration);
    invalid.scoredItems = 149;
    await expect(
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: 1,
        configuration: invalid,
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_SCORED_ITEMS" } });
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: id,
      }),
    ).toMatchObject({ revision: 1 });
    expect(
      (await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: id,
      }))!.configuration,
    ).toBeUndefined();

    const revision = await admin.mutation(api.blueprints.saveConfiguration, {
      blueprintVersionId: id,
      expectedRevision: 1,
      configuration: fixture("professional").configuration,
    });
    await expect(
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: 1,
        configuration: fixture("professional").configuration,
      }),
    ).rejects.toMatchObject({ data: { code: "STALE_REVISION" } });
    await expect(activate(admin, id, 1)).rejects.toMatchObject({
      data: { code: "STALE_REVISION" },
    });

    const tampered = structuredClone(fixture("professional").configuration);
    tampered.concepts = tampered.concepts.map((concept) => ({
      ...concept,
      minimum: 3,
    }));
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", id, {
        configuration: tampered,
      }),
    );
    await expect(activate(admin, id, revision)).rejects.toMatchObject({
      data: { code: "CONTENT_HASH_MISMATCH" },
    });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "professional",
      }),
    ).toBeNull();
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: id,
      }),
    ).toMatchObject({ state: "draft", revision });
    expect(await auditEvents(t, id)).toHaveLength(2);

    await expect(
      createDraft(admin, "professional", taxonomy.id),
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_IDENTITY" } });
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({ data: { code: "BLUEPRINT_NOT_ACTIVE" } });

    const draftTaxonomy = await admin.mutation(api.referenceData.createDraft, {
      taxonomyId: "cse-taxonomy-2027-v3",
    });
    await expect(
      createDraft(
        admin,
        "professional",
        draftTaxonomy,
        "cse-professional-2028-v4",
      ),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });

    const archived = await admin.mutation(api.blueprints.archiveDraft, {
      blueprintVersionId: id,
      expectedRevision: revision,
    });
    expect(archived).toBe(revision + 1);
    await expect(activate(admin, id, archived)).rejects.toMatchObject({
      data: { code: "IMMUTABLE_BLUEPRINT" },
    });
    await expect(
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: archived,
        configuration: fixture("professional").configuration,
      }),
    ).rejects.toMatchObject({ data: { code: "IMMUTABLE_BLUEPRINT" } });
    expect(
      (await auditEvents(t, id)).map((event) => event.action).sort(),
    ).toEqual(["archive", "create", "save"]);
  });

  it("serializes competing revisions and rolls back domain and audit writes together", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const id = await createDraft(admin, "professional", taxonomy.id);
    const changed = structuredClone(fixture("professional").configuration);
    changed.concepts = changed.concepts.map((concept) => ({
      ...concept,
      minimum: 2,
    }));
    const decisions = await Promise.allSettled([
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: 1,
        configuration: fixture("professional").configuration,
      }),
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: id,
        expectedRevision: 1,
        configuration: changed,
      }),
    ]);
    expect(
      decisions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      decisions.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      decisions.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { data: { code: "STALE_REVISION" } } });
    const revision = (await admin.query(api.blueprints.getVersion, {
      blueprintVersionId: id,
    }))!.revision;
    expect(revision).toBe(2);
    expect(
      (await auditEvents(t, id)).filter((event) => event.action === "save"),
    ).toHaveLength(1);

    const before = (await t.run((ctx) => ctx.db.query("auditEvents").take(128)))
      .length;
    await expect(
      admin.mutation(async (ctx) => {
        await ctx.runMutation(api.blueprints.saveConfiguration, {
          blueprintVersionId: id,
          expectedRevision: revision,
          configuration: {
            ...changed,
            concepts: changed.concepts.map((concept) => ({
              ...concept,
              minimum: 3,
            })),
          },
        });
        throw new Error("domain failure");
      }),
    ).rejects.toThrow("domain failure");
    expect(
      (await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: id,
      }))!.revision,
    ).toBe(revision);
    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(128))).length,
    ).toBe(before);
  });

  it("keeps exactly one active pointer when two versions activate concurrently", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const first = await saveDraft(admin, "professional", taxonomy.id);
    const second = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    const decisions = await Promise.allSettled([
      activate(admin, first.id, first.revision),
      activate(admin, second.id, second.revision),
    ]);
    expect(decisions.some((decision) => decision.status === "fulfilled")).toBe(
      true,
    );

    const pointers = await t.run((ctx) =>
      ctx.db
        .query("activeBlueprints")
        .withIndex("by_level", (q) => q.eq("level", "professional"))
        .collect(),
    );
    const active = await t.run((ctx) =>
      ctx.db
        .query("blueprintVersions")
        .withIndex("by_level_and_state_and_createdAt", (q) =>
          q.eq("level", "professional").eq("state", "active"),
        )
        .collect(),
    );
    expect(pointers).toHaveLength(1);
    expect(active).toHaveLength(1);
    expect(active[0]._id).toBe(pointers[0].blueprintVersionId);
    expect(
      await admin.query(api.blueprints.getActive, { level: "professional" }),
    ).toMatchObject({ _id: active[0]._id });
  });

  it("rejects an active pointer that resolves to another level", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const professional = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, professional.id, professional.revision);
    const subprofessional = await saveDraft(
      admin,
      "subprofessional",
      taxonomy.id,
    );
    await activate(admin, subprofessional.id, subprofessional.revision);
    await t.run(async (ctx) => {
      const pointer = await ctx.db
        .query("activeBlueprints")
        .withIndex("by_level", (q) => q.eq("level", "professional"))
        .unique();
      if (!pointer) throw new Error("Missing professional pointer");
      await ctx.db.patch("activeBlueprints", pointer._id, {
        blueprintVersionId: subprofessional.id,
      });
    });

    await expect(
      admin.query(api.blueprints.getActive, { level: "professional" }),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });

    const replacement = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await expect(
      activate(admin, replacement.id, replacement.revision),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: replacement.id,
      }),
    ).toMatchObject({ state: "draft", revision: replacement.revision });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "subprofessional",
      }),
    ).toMatchObject({ _id: subprofessional.id, state: "active" });
  });

  it("rejects duplicate active pointers without a raw index error", async () => {
    const { admin, t, adminId } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const active = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, active.id, active.revision);
    await t.run((ctx) =>
      ctx.db.insert("activeBlueprints", {
        level: "professional",
        blueprintVersionId: active.id,
        activatedBy: adminId,
        activatedAt: Date.now(),
      }),
    );

    await expect(
      admin.query(api.blueprints.getActive, { level: "professional" }),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });

    const replacement = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await expect(
      activate(admin, replacement.id, replacement.revision),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("activeBlueprints")
          .withIndex("by_level", (q) => q.eq("level", "professional"))
          .take(2),
      ),
    ).toHaveLength(2);
  });

  it("rejects extra active versions alongside an active pointer", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const active = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, active.id, active.revision);
    const extra = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await t.run((ctx) =>
      ctx.db.patch("blueprintVersions", extra.id, { state: "active" }),
    );

    await expect(
      admin.query(api.blueprints.getActive, { level: "professional" }),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });

    const replacement = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v5",
    );
    await expect(
      activate(admin, replacement.id, replacement.revision),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: replacement.id,
      }),
    ).toMatchObject({ state: "draft", revision: replacement.revision });

    const activeVersions = await t.run((ctx) =>
      ctx.db
        .query("blueprintVersions")
        .withIndex("by_level_and_state_and_createdAt", (q) =>
          q.eq("level", "professional").eq("state", "active"),
        )
        .collect(),
    );
    expect(activeVersions).toHaveLength(2);
    expect(new Set(activeVersions.map((version) => version._id))).toEqual(
      new Set([active.id, extra.id]),
    );
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("activeBlueprints")
          .withIndex("by_level", (q) => q.eq("level", "professional"))
          .collect(),
      ),
    ).toMatchObject([{ blueprintVersionId: active.id }]);
    expect(
      await t.run((ctx) => ctx.db.query("blueprintSnapshots").collect()),
    ).toHaveLength(0);
  });

  it("rejects orphaned active versions when the pointer is missing", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const active = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, active.id, active.revision);
    await t.run(async (ctx) => {
      const pointer = await ctx.db
        .query("activeBlueprints")
        .withIndex("by_level", (q) => q.eq("level", "professional"))
        .unique();
      if (!pointer) throw new Error("Missing professional pointer");
      await ctx.db.delete("activeBlueprints", pointer._id);
    });

    await expect(
      admin.query(api.blueprints.getActive, { level: "professional" }),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });

    const replacement = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await expect(
      activate(admin, replacement.id, replacement.revision),
    ).rejects.toMatchObject({
      data: { code: "ACTIVE_BLUEPRINT_INCONSISTENT" },
    });
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: replacement.id,
      }),
    ).toMatchObject({ state: "draft", revision: replacement.revision });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("activeBlueprints")
          .withIndex("by_level", (q) => q.eq("level", "professional"))
          .collect(),
      ),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("blueprintVersions")
          .withIndex("by_level_and_state_and_createdAt", (q) =>
            q.eq("level", "professional").eq("state", "active"),
          )
          .collect(),
      ),
    ).toHaveLength(1);
  });

  it("rejects duplicate draft identities without a raw index error", async () => {
    const { admin, t, adminId } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    await t.run(async (ctx) => {
      for (let index = 0; index < 2; index += 1)
        await ctx.db.insert("blueprintVersions", {
          blueprintId: "duplicate-draft",
          level: "professional",
          state: "draft",
          revision: 1,
          taxonomyVersionId: taxonomy.id,
          createdBy: adminId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    });
    await expect(
      createDraft(admin, "professional", taxonomy.id, "duplicate-draft"),
    ).rejects.toMatchObject({ data: { code: "DUPLICATE_IDENTITY" } });
  });

  it("rejects concurrent duplicate drafts", async () => {
    const { admin } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const decisions = await Promise.allSettled([
      createDraft(admin, "professional", taxonomy.id),
      createDraft(admin, "professional", taxonomy.id),
    ]);
    expect(
      decisions.filter((decision) => decision.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      decisions.find((decision) => decision.status === "rejected"),
    ).toMatchObject({ reason: { data: { code: "DUPLICATE_IDENTITY" } } });
  });

  it("keeps active snapshots usable after taxonomy archival but blocks new use", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const active = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, active.id, active.revision);
    const pending = await saveDraft(
      admin,
      "subprofessional",
      taxonomy.id,
      "cse-subprofessional-2028-v4",
    );

    await admin.mutation(api.referenceData.archiveVersion, {
      taxonomyVersionId: taxonomy.id,
      expectedRevision: taxonomy.revision,
    });

    await expect(
      t.run((ctx) => createBlueprintSnapshot(ctx, "professional")),
    ).resolves.toBeDefined();
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "professional",
      }),
    ).toMatchObject({ _id: active.id, state: "active" });
    await expect(
      admin.mutation(api.blueprints.saveConfiguration, {
        blueprintVersionId: pending.id,
        expectedRevision: pending.revision,
        configuration: fixture("subprofessional").configuration,
      }),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
    await expect(
      activate(admin, pending.id, pending.revision),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
    await expect(
      createDraft(
        admin,
        "subprofessional",
        taxonomy.id,
        "cse-subprofessional-2029-v5",
      ),
    ).rejects.toMatchObject({ data: { code: "TAXONOMY_UNAVAILABLE" } });
  });

  it("keeps active pointers independent per level", async () => {
    const { admin } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const professional = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, professional.id, professional.revision);
    const subprofessional = await saveDraft(
      admin,
      "subprofessional",
      taxonomy.id,
    );
    await activate(admin, subprofessional.id, subprofessional.revision);

    const professionalReplacement = await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await activate(
      admin,
      professionalReplacement.id,
      professionalReplacement.revision,
    );

    expect(
      await admin.query(api.blueprints.getActive, {
        level: "professional",
      }),
    ).toMatchObject({
      _id: professionalReplacement.id,
      state: "active",
    });
    expect(
      await admin.query(api.blueprints.getActive, {
        level: "subprofessional",
      }),
    ).toMatchObject({ _id: subprofessional.id, state: "active" });
  });

  it("enforces authorization on every public endpoint", async () => {
    const { admin, t } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const draft = await createDraft(admin, "professional", taxonomy.id);
    const pending = await createDraft(admin, "subprofessional", taxonomy.id);
    const unsaved = await createDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    const before = (await t.run((ctx) => ctx.db.query("auditEvents").take(128)))
      .length;

    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "https://test|learner",
        role: "user",
        status: "active",
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "https://test|suspended",
        role: "admin",
        status: "suspended",
      }),
    );
    const actors = [
      {
        actor: t,
        code: "UNAUTHENTICATED",
      },
      {
        actor: t.withIdentity({
          issuer: "https://test",
          subject: "missing",
        }),
        code: "PROFILE_REQUIRED",
      },
      {
        actor: t.withIdentity({
          issuer: "https://test",
          subject: "learner",
        }),
        code: "FORBIDDEN",
      },
      {
        actor: t.withIdentity({
          issuer: "https://test",
          subject: "suspended",
        }),
        code: "ACCOUNT_SUSPENDED",
      },
    ];
    const operations: Array<(actor: Actor) => Promise<unknown>> = [
      (actor) =>
        actor.mutation(api.blueprints.createDraft, {
          blueprintId: "cse-professional-2029-v5",
          level: "professional",
          taxonomyVersionId: taxonomy.id,
        }),
      (actor) =>
        actor.mutation(api.blueprints.saveConfiguration, {
          blueprintVersionId: unsaved,
          expectedRevision: 1,
          configuration: fixture("professional").configuration,
        }),
      (actor) =>
        actor.mutation(api.blueprints.activateVersion, {
          blueprintVersionId: draft,
          expectedRevision: 1,
        }),
      (actor) =>
        actor.mutation(api.blueprints.archiveDraft, {
          blueprintVersionId: pending,
          expectedRevision: 1,
        }),
      (actor) =>
        actor.query(api.blueprints.listVersions, {
          paginationOpts: opts,
        }),
      (actor) =>
        actor.query(api.blueprints.getVersion, {
          blueprintVersionId: draft,
        }),
      (actor) =>
        actor.query(api.blueprints.getActive, {
          level: "professional",
        }),
    ];
    for (const { actor, code } of actors)
      for (const operation of operations)
        await expect(operation(actor)).rejects.toMatchObject({
          data: { code },
        });

    expect(
      (await t.run((ctx) => ctx.db.query("auditEvents").take(128))).length,
    ).toBe(before);
    expect(
      await admin.query(api.blueprints.getVersion, {
        blueprintVersionId: unsaved,
      }),
    ).toMatchObject({ revision: 1 });
  });

  it("lists versions with level and state filters and bounded pages", async () => {
    const { admin } = await setup();
    const taxonomy = await sealedTaxonomy(admin);
    const first = await saveDraft(admin, "professional", taxonomy.id);
    await activate(admin, first.id, first.revision);
    await saveDraft(
      admin,
      "professional",
      taxonomy.id,
      "cse-professional-2028-v4",
    );
    await createDraft(admin, "subprofessional", taxonomy.id);

    const all = await admin.query(api.blueprints.listVersions, {
      paginationOpts: opts,
    });
    expect(all.page).toHaveLength(3);
    expect(
      (
        await admin.query(api.blueprints.listVersions, {
          level: "professional",
          paginationOpts: opts,
        })
      ).page,
    ).toHaveLength(2);
    expect(
      (
        await admin.query(api.blueprints.listVersions, {
          state: "active",
          paginationOpts: opts,
        })
      ).page,
    ).toHaveLength(1);
    const activeProfessional = await admin.query(api.blueprints.listVersions, {
      level: "professional",
      state: "active",
      paginationOpts: opts,
    });
    expect(activeProfessional.page).toHaveLength(1);
    expect(activeProfessional.page[0]._id).toBe(first.id);

    for (const numItems of [0, 101, 1.5])
      await expect(
        admin.query(api.blueprints.listVersions, {
          paginationOpts: { numItems, cursor: null },
        }),
      ).rejects.toMatchObject({ data: { code: "INVALID_PAGE_SIZE" } });
  });

  it("exposes no snapshot mutation endpoint", () => {
    expect(Object.keys(blueprints).sort()).toEqual([
      "activateVersion",
      "archiveDraft",
      "createDraft",
      "getActive",
      "getVersion",
      "listVersions",
      "saveConfiguration",
    ]);
  });
});

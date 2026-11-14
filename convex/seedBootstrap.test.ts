// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import * as seedBootstrap from "./seedBootstrap";
import * as questionImports from "./questionImports";
import * as questionAssets from "./questionAssets";
import * as usersModule from "./users";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import type { Id } from "./_generated/dataModel";
import { bootstrapFixturePlan } from "./lib/seedBootstrapFixture";
import {
  systemApproverIdentifier,
  systemImporterIdentifier,
} from "./lib/seedBootstrapProtocol";
import { loadPublishedQuestion } from "./lib/questionServing";
import { importQuestionDraft } from "./lib/questionImports";
import { resolveQuestion } from "./lib/questionImportState";

vi.mock("../lib/question-import-contract.mjs", async (original) => {
  const real = await original<Record<string, unknown>>();
  const fixture = await import("./lib/seedBootstrapFixture");
  const plan = await fixture.bootstrapFixturePlan();
  return {
    ...real,
    approvedImportTargets: {
      fixture: "https://fixture.convex.cloud",
    },
    bootstrapPlanChecksum: plan.planChecksum,
    bootstrapInventoryChecksum: plan.inventoryHash,
    seedBootstrapPolicy: fixture.bootstrapFixturePolicy,
  };
});

const { api, internal, createTest } = defineTestApp({ schema }).defineModules({
  seedBootstrap,
  questionImports,
  questionAssets,
  users: usersModule,
});
const plan = await bootstrapFixturePlan();
const systemToken = "system:seed-bootstrap-importer";

async function setup() {
  const t = createTest();
  await t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      tokenIdentifier: "https://test|admin",
      role: "admin",
      status: "active",
    });
    const taxonomy = await ctx.db.insert("taxonomyVersions", {
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 1,
      createdBy: admin,
      createdAt: 0,
      updatedAt: 0,
    });
    for (const entry of initialV2Catalog)
      await ctx.db.insert("taxonomyEntries", {
        ...entry,
        taxonomyVersionId: taxonomy,
      });
  });
  return {
    t,
    admin: t.withIdentity({ issuer: "https://test", subject: "admin" }),
  };
}

async function begin(
  t: Awaited<ReturnType<typeof setup>>["t"],
  overrides: Record<string, unknown> = {},
) {
  return t.mutation(internal.seedBootstrap.begin, {
    target: "fixture",
    planChecksum: plan.planChecksum,
    inventoryHash: plan.inventoryHash,
    manifests: plan.manifests,
    ...overrides,
  });
}

async function start(t: Awaited<ReturnType<typeof setup>>["t"]) {
  const created = await begin(t);
  const access = {
    runId: created.runId,
    generation: created.generation,
    target: "fixture",
  };
  await t.mutation(internal.seedBootstrap.stage, {
    ...access,
    entries: plan.descriptors,
  });
  return access;
}

async function uploadAsset(
  t: Awaited<ReturnType<typeof setup>>["t"],
  access: {
    runId: Awaited<ReturnType<typeof start>>["runId"];
    generation: number;
    target: string;
  },
) {
  const asset = plan.records[0];
  const reserved = await t.mutation(internal.seedBootstrap.applyBatch, {
    ...access,
    records: [asset],
  });
  if (reserved.uploadOrdinal !== 0) return reserved;
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob([plan.pngBytes], { type: "image/png" })),
  );
  await t.mutation(internal.seedBootstrap.completeAsset, {
    ...access,
    ordinal: 0,
    storageId,
    expectedRevision: reserved.uploadRevision!,
  });
  return t.mutation(internal.seedBootstrap.applyBatch, {
    ...access,
    records: [asset],
  });
}

beforeEach(() => {
  vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "true");
  vi.stubEnv("QUESTION_BANK_IMPORT_ENABLED", "true");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
});

describe("one-time bootstrap authorization", () => {
  it("requires the exact reviewed plan and an enabled window", async () => {
    const { t } = await setup();
    await expect(begin(t, { planChecksum: "f".repeat(64) })).rejects.toThrow(
      "BOOTSTRAP_PLAN_MISMATCH",
    );
    await expect(
      begin(t, {
        manifests: [{ ...plan.manifests[0], questions: 1 }, plan.manifests[1]],
      }),
    ).rejects.toThrow("BOOTSTRAP_POLICY_MISMATCH");
    vi.stubEnv("SEED_BOOTSTRAP_ENABLED", "false");
    await expect(begin(t)).rejects.toThrow("BOOTSTRAP_TARGET_DISABLED");
  });

  it("creates two distinct non-login system actors", async () => {
    const { t } = await setup();
    const { runId } = await begin(t);
    const run = await t.run((ctx) => ctx.db.get("questionImportRuns", runId));
    expect(run).toMatchObject({ mode: "bootstrap" });
    const importer = await t.run((ctx) => ctx.db.get("users", run!.ownerId));
    const approver = await t.run((ctx) =>
      ctx.db.get("users", run!.approverId!),
    );
    expect(importer).toMatchObject({
      tokenIdentifier: systemImporterIdentifier,
      role: "system",
      status: "active",
    });
    expect(approver).toMatchObject({
      tokenIdentifier: systemApproverIdentifier,
      role: "system",
      status: "active",
    });
    expect(importer!._id).not.toBe(approver!._id);
  });

  it("rejects a login identity that belongs to a system actor", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        tokenIdentifier: "https://test|system-fixture",
        role: "system",
        status: "active",
      });
    });
    const system = t.withIdentity({
      issuer: "https://test",
      subject: "system-fixture",
    });
    await expect(system.query(api.users.currentAccess)).resolves.toEqual({
      status: "suspended",
    });
    await expect(system.mutation(api.users.ensureCurrentUser)).rejects.toThrow(
      "ACCOUNT_SUSPENDED",
    );
  });

  it("refuses to reuse a non-system account for the importer identity", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        tokenIdentifier: systemToken,
        role: "user",
        status: "active",
      });
    });
    await expect(begin(t)).rejects.toThrow("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
  });

  it("keeps bootstrap runs out of the public admin import path", async () => {
    const { t, admin } = await setup();
    const access = await start(t);
    await expect(
      admin.mutation(api.questionImports.renew, access),
    ).rejects.toThrow("IMPORT_RUN_FORBIDDEN");
  });
});

describe("bootstrap publication", () => {
  it("publishes questions as batches land and completes the run", async () => {
    const { t } = await setup();
    const access = await start(t);
    await uploadAsset(t, access);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: plan.records.slice(1, 3),
    });
    const visible = await t.run(async (ctx) => {
      const entry = await ctx.db
        .query("questionImportEntries")
        .withIndex("by_runId_and_ordinal", (query) =>
          query.eq("runId", access.runId).eq("ordinal", 2),
        )
        .unique();
      return loadPublishedQuestion(
        ctx,
        entry!.resultId as Id<"questionVersions">,
      );
    });
    expect(visible).toMatchObject({
      questionVersionId: expect.any(String),
      stem: "What is two plus three?",
    });
    expect(visible).not.toHaveProperty("correctChoiceId");
    expect(visible).not.toHaveProperty("explanation");
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: plan.records.slice(3),
    });
    const state = await t.run(async (ctx) => {
      const run = await ctx.db.get("questionImportRuns", access.runId);
      const questions = await ctx.db.query("questions").collect();
      const versions = await ctx.db.query("questionVersions").collect();
      const reviews = await ctx.db.query("questionReviews").collect();
      const entries = await ctx.db.query("questionImportEntries").collect();
      const audits = await ctx.db.query("auditEvents").collect();
      return { run, questions, versions, reviews, entries, audits };
    });
    expect(state.run).toMatchObject({
      state: "complete",
      processed: plan.descriptors.length,
      staged: plan.descriptors.length,
      leaseUntil: 0,
    });
    expect(state.versions).toHaveLength(4);
    expect(
      state.versions.every((version) => version.state === "published"),
    ).toBe(true);
    expect(state.reviews).toHaveLength(4);
    expect(
      state.reviews.every(
        (review) =>
          review.kind === "bootstrap_acceptance" &&
          review.importRunId === access.runId &&
          review.planChecksum === plan.planChecksum,
      ),
    ).toBe(true);
    const reviewerIds = new Set(
      state.reviews.map((review) => review.reviewerId),
    );
    expect(reviewerIds).toEqual(new Set([state.run!.approverId!]));
    expect(reviewerIds.has(state.run!.ownerId)).toBe(false);
    // Each acceptance names the version it approved instead of implying the
    // whole inventory had already been processed at that point.
    for (const review of state.reviews) {
      if (review.kind !== "bootstrap_acceptance")
        throw new Error("unexpected review kind");
      const version = state.versions.find(
        (item) => item._id === review.questionVersionId,
      );
      if (!version) throw new Error("review version missing");
      const evidence = review.assessment.map((item) => item.evidence).join(" ");
      expect(evidence).toContain(String(review.questionVersionId));
      expect(evidence).toContain(version.contentHash);
      expect(evidence).toContain(plan.planChecksum);
      expect(evidence).not.toContain("processed the pinned");
    }
    expect(
      state.questions.every(
        (question) => question.contributorId === state.run!.ownerId,
      ),
    ).toBe(true);
    expect(
      state.versions.every(
        (version) =>
          version.creatorId === state.run!.ownerId &&
          version.bootstrapRunId === access.runId,
      ),
    ).toBe(true);
    expect(state.entries.every((entry) => entry.state === "done")).toBe(true);
    const actions = new Set(state.audits.map((audit) => audit.action));
    expect(actions).toContain("bootstrap_submit");
    expect(actions).toContain("bootstrap_accept");
    expect(actions).toContain("bootstrap_publish");
    expect(actions).toContain("bootstrap_complete");
  });

  it("is idempotent after completion", async () => {
    const { t } = await setup();
    const access = await start(t);
    await uploadAsset(t, access);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: plan.records.slice(1),
    });
    const second = await begin(t);
    expect(second).toEqual({ runId: access.runId, generation: 1 });
  });

  it("treats an identical asset completion as idempotent", async () => {
    const { t } = await setup();
    const access = await start(t);
    const reserved = await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: [plan.records[0]],
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([plan.pngBytes], { type: "image/png" })),
    );
    const completion = {
      ...access,
      ordinal: 0,
      storageId,
      expectedRevision: reserved.uploadRevision!,
    };
    await t.mutation(internal.seedBootstrap.completeAsset, completion);
    await expect(
      t.mutation(internal.seedBootstrap.completeAsset, completion),
    ).resolves.toBeNull();
    await expect(
      t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).resolves.not.toBeNull();
  });

  it("verifies a direct upload and binds the storage object", async () => {
    const { t } = await setup();
    const access = await start(t);
    const reserved = await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: [plan.records[0]],
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([plan.pngBytes], { type: "image/png" })),
    );
    await expect(
      t.action(internal.seedBootstrap.verifyAsset, {
        ...access,
        ordinal: 0,
        storageId,
      }),
    ).resolves.toBeNull();
    const asset = await t.run((ctx) => ctx.db.query("questionAssets").first());
    expect(asset).toMatchObject({
      state: "verified",
      storageId,
      revision: reserved.uploadRevision! + 1,
    });
    await expect(
      t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).resolves.not.toBeNull();
  });

  it("replays a verified upload after a lost completion response", async () => {
    const { t } = await setup();
    const access = await start(t);
    const reserved = await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: [plan.records[0]],
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([plan.pngBytes], { type: "image/png" })),
    );
    const verify = {
      ...access,
      ordinal: 0,
      storageId,
    };
    await t.mutation(internal.seedBootstrap.completeAsset, {
      ...verify,
      expectedRevision: reserved.uploadRevision!,
    });
    await expect(
      t.action(internal.seedBootstrap.verifyAsset, verify),
    ).resolves.toBeNull();
    await expect(
      t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).resolves.not.toBeNull();
  });

  it("deletes an unbound blob when upload verification fails", async () => {
    const { t } = await setup();
    const access = await start(t);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: [plan.records[0]],
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(
        new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }),
      ),
    );
    await expect(
      t.action(internal.seedBootstrap.verifyAsset, {
        ...access,
        ordinal: 0,
        storageId,
      }),
    ).rejects.toThrow("VALIDATION_FAILED");
    await expect(
      t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).resolves.toBeNull();
  });

  it("retains a bound blob when upload completion fails", async () => {
    const { t } = await setup();
    const access = await start(t);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: [plan.records[0]],
    });
    const pending = await t.run((ctx) =>
      ctx.db.query("questionAssets").first(),
    );
    const storageId = await t.run(async (ctx) => {
      const stored = await ctx.storage.store(
        new Blob([plan.pngBytes], { type: "image/webp" }),
      );
      const asset = pending!;
      await ctx.db.insert("questionAssets", {
        assetId: "bound-elsewhere",
        sha256: asset.sha256,
        mediaType: asset.mediaType,
        width: asset.width,
        height: asset.height,
        provenance: asset.provenance,
        uploaderId: asset.uploaderId,
        createdAt: asset.createdAt,
        storageId: stored,
        state: "verified",
        revision: asset.revision + 1,
      });
      return stored;
    });
    await expect(
      t.action(internal.seedBootstrap.verifyAsset, {
        ...access,
        ordinal: 0,
        storageId,
      }),
    ).rejects.toThrow("VALIDATION_FAILED");
    await expect(
      t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).resolves.not.toBeNull();
  });

  it("refuses a stale automatic pause", async () => {
    const { t } = await setup();
    const access = await start(t);
    await expect(
      t.mutation(internal.seedBootstrap.pause, {
        target: "fixture",
        runId: access.runId,
        code: "BOOTSTRAP_OPERATION_FAILED",
        generation: access.generation + 1,
      }),
    ).rejects.toThrow("BOOTSTRAP_LEASE_LOST");
    await expect(
      t.run((ctx) => ctx.db.get("questionImportRuns", access.runId)),
    ).resolves.toMatchObject({ state: "running", generation: 1 });
    await expect(
      t.mutation(internal.seedBootstrap.pause, {
        target: "fixture",
        runId: access.runId,
        code: "BOOTSTRAP_OPERATION_FAILED",
        generation: access.generation,
      }),
    ).resolves.toBeNull();
  });

  it("reports an operator pause instead of a lost lease", async () => {
    const { t } = await setup();
    const access = await start(t);
    await t.mutation(internal.seedBootstrap.pause, {
      target: "fixture",
      runId: access.runId,
      code: "BOOTSTRAP_OPERATION_FAILED",
    });
    await expect(
      t.mutation(internal.seedBootstrap.renew, access),
    ).rejects.toThrow("BOOTSTRAP_PAUSED");
    await expect(
      t.mutation(internal.seedBootstrap.applyBatch, {
        ...access,
        records: [plan.records[0]],
      }),
    ).rejects.toThrow("BOOTSTRAP_PAUSED");
  });

  it("refuses to adopt a draft created outside the bootstrap importer", async () => {
    const { t } = await setup();
    const access = await start(t);
    const source = plan.records[3].source;
    if (source.kind !== "question")
      throw new Error("fixture question record missing");
    await t.run(async (ctx) => {
      const admin = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", "https://test|admin"),
        )
        .unique();
      const resolved = await resolveQuestion(
        ctx,
        source.value,
        "cse-taxonomy-2027-v2",
      );
      await importQuestionDraft(ctx, resolved.input, resolved.hashes, {
        actor: admin!,
      });
    });
    await uploadAsset(t, access);
    await expect(
      t.mutation(internal.seedBootstrap.applyBatch, {
        ...access,
        records: plan.records.slice(1, 4),
      }),
    ).rejects.toThrow("CONTENT_CONFLICT");
  });

  it("flags an unadoptable identical draft during preflight", async () => {
    const { t } = await setup();
    const access = await start(t);
    const record = plan.records[3];
    const source = record.source;
    if (source.kind !== "question")
      throw new Error("fixture question record missing");
    await t.run(async (ctx) => {
      const admin = await ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", "https://test|admin"),
        )
        .unique();
      const resolved = await resolveQuestion(
        ctx,
        source.value,
        "cse-taxonomy-2027-v2",
      );
      await importQuestionDraft(ctx, resolved.input, resolved.hashes, {
        actor: admin!,
      });
    });
    const classifications = await t.query(internal.seedBootstrap.preflight, {
      ...access,
      records: [record],
    });
    expect(classifications).toEqual([
      {
        ordinal: record.descriptor.ordinal,
        status: "conflict",
        duplicateCandidates: 0,
      },
    ]);
  });

  it("does not reactivate a version archived outside the bootstrap rollback", async () => {
    const { t } = await setup();
    const access = await start(t);
    await uploadAsset(t, access);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: plan.records.slice(1),
    });
    const versionId = await t.run(async (ctx) => {
      const entry = await ctx.db
        .query("questionImportEntries")
        .withIndex("by_runId_and_ordinal", (q) =>
          q.eq("runId", access.runId).eq("ordinal", 3),
        )
        .unique();
      const version = await ctx.db.get(
        "questionVersions",
        entry!.resultId as Id<"questionVersions">,
      );
      await ctx.db.patch("questionVersions", version!._id, {
        state: "archived",
        workflowRevision: version!.workflowRevision + 1,
      });
      return version!._id;
    });
    await t.mutation(internal.seedBootstrap.rollbackBatch, {
      target: "fixture",
      runId: access.runId,
      reason: "rehearsal reset",
    });
    const retry = await begin(t);
    const retryAccess = {
      runId: retry.runId,
      generation: retry.generation,
      target: "fixture",
    };
    await t.mutation(internal.seedBootstrap.stage, {
      ...retryAccess,
      entries: plan.descriptors,
    });
    await uploadAsset(t, retryAccess);
    await expect(
      t.mutation(internal.seedBootstrap.applyBatch, {
        ...retryAccess,
        records: plan.records.slice(1),
      }),
    ).rejects.toThrow("CONTENT_CONFLICT");
    await expect(
      t.run((ctx) => ctx.db.get("questionVersions", versionId)),
    ).resolves.toMatchObject({ state: "archived" });
  });

  it("resumes the newest run when older attempts exceed the lookup bound", async () => {
    const { t } = await setup();
    // Seed the system actors, then replace the placeholder run with 20 older
    // rolled-back attempts so the resumable run is the newest insertion.
    const seed = await begin(t);
    const template = (await t.run((ctx) =>
      ctx.db.get("questionImportRuns", seed.runId),
    ))!;
    await t.run(async (ctx) => {
      await ctx.db.delete("questionImportRuns", seed.runId);
      for (let index = 0; index < 20; index++) {
        await ctx.db.insert("questionImportRuns", {
          target: template.target,
          targetUrl: template.targetUrl,
          mode: "bootstrap",
          ownerId: template.ownerId,
          approverId: template.approverId,
          planChecksum: template.planChecksum,
          inventoryHash: template.inventoryHash,
          chain: template.chain,
          manifests: template.manifests,
          stagedCounts: template.stagedCounts,
          expected: template.expected,
          staged: 0,
          processed: 0,
          rolledBack: 0,
          state: "rolled_back",
          generation: 1,
          leaseUntil: 0,
          createdAt: template.createdAt - 1000 - index,
          updatedAt: template.updatedAt - 1000 - index,
        });
      }
    });
    const access = await start(t);
    await t.mutation(internal.seedBootstrap.pause, {
      target: "fixture",
      runId: access.runId,
      code: "BOOTSTRAP_OPERATION_FAILED",
    });
    await expect(begin(t)).resolves.toEqual({
      runId: access.runId,
      generation: 2,
    });
  });

  it("refuses a competing begin and resumes a paused run with a new generation", async () => {
    const { t } = await setup();
    const access = await start(t);
    await expect(begin(t)).rejects.toThrow("BOOTSTRAP_BUSY");
    await t.mutation(internal.seedBootstrap.pause, {
      target: "fixture",
      runId: access.runId,
      code: "BOOTSTRAP_OPERATION_FAILED",
    });
    const resumed = await begin(t);
    expect(resumed).toEqual({ runId: access.runId, generation: 2 });
    await expect(
      t.mutation(internal.seedBootstrap.stage, {
        ...access,
        entries: [],
      }),
    ).rejects.toThrow("BOOTSTRAP_LEASE_LOST");
  });

  it("refuses to resume a paused run while another run holds the target lease", async () => {
    const { t } = await setup();
    const access = await start(t);
    await t.mutation(internal.seedBootstrap.pause, {
      target: "fixture",
      runId: access.runId,
      code: "BOOTSTRAP_OPERATION_FAILED",
    });
    const template = (await t.run((ctx) =>
      ctx.db.get("questionImportRuns", access.runId),
    ))!;
    // A competing worker on the same target is still inside its lease.
    await t.run(async (ctx) => {
      await ctx.db.insert("questionImportRuns", {
        target: template.target,
        targetUrl: template.targetUrl,
        mode: "bootstrap",
        ownerId: template.ownerId,
        approverId: template.approverId,
        planChecksum: template.planChecksum,
        inventoryHash: template.inventoryHash,
        chain: template.chain,
        manifests: template.manifests,
        stagedCounts: template.stagedCounts,
        expected: template.expected,
        staged: 0,
        processed: 0,
        rolledBack: 0,
        state: "preparing",
        generation: 1,
        leaseUntil: Date.now() + 60_000,
        createdAt: template.createdAt + 1,
        updatedAt: template.updatedAt,
      });
    });
    await expect(begin(t, { resumeRunId: access.runId })).rejects.toThrow(
      "BOOTSTRAP_BUSY",
    );
    // The rejected resume must not advance the paused run's generation.
    await expect(
      t.run((ctx) => ctx.db.get("questionImportRuns", access.runId)),
    ).resolves.toMatchObject({ state: "paused", generation: 1 });
  });

  it("stops on a deterministic source mismatch before writing content", async () => {
    const { t } = await setup();
    const access = await start(t);
    const original = plan.records[2];
    if (original.source.kind !== "question")
      throw new Error("fixture question record missing");
    const tampered = {
      descriptor: original.descriptor,
      source: {
        kind: "question" as const,
        value: { ...original.source.value, stem: "Tampered stem" },
      },
    };
    await expect(
      t.mutation(internal.seedBootstrap.applyBatch, {
        ...access,
        records: [tampered],
      }),
    ).rejects.toThrow("IMPORT_SOURCE_CHANGED");
    const classifications = await t.query(internal.seedBootstrap.preflight, {
      ...access,
      records: [tampered],
    });
    expect(classifications).toEqual([
      {
        ordinal: 2,
        status: "invalid",
        duplicateCandidates: 0,
        code: "IMPORT_SOURCE_CHANGED",
      },
    ]);
    const versions = await t.run((ctx) =>
      ctx.db.query("questionVersions").collect(),
    );
    expect(versions).toHaveLength(0);
  });

  it("rolls back published versions and allows a fresh retry", async () => {
    const { t } = await setup();
    const access = await start(t);
    await uploadAsset(t, access);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...access,
      records: plan.records.slice(1),
    });
    await t.mutation(internal.seedBootstrap.rollbackBatch, {
      target: "fixture",
      runId: access.runId,
      reason: "rehearsal reset",
    });
    const rolledBack = await t.run((ctx) =>
      ctx.db.get("questionImportRuns", access.runId),
    );
    expect(rolledBack).toMatchObject({
      state: "rolled_back",
      rolledBack: 4,
      rollbackReason: "rehearsal reset",
      leaseUntil: 0,
    });
    const versions = await t.run((ctx) =>
      ctx.db.query("questionVersions").collect(),
    );
    expect(versions.every((version) => version.state === "archived")).toBe(
      true,
    );

    const retry = await begin(t);
    expect(retry.runId).not.toBe(access.runId);
    const retryAccess = {
      runId: retry.runId,
      generation: retry.generation,
      target: "fixture",
    };
    await t.mutation(internal.seedBootstrap.stage, {
      ...retryAccess,
      entries: plan.descriptors,
    });
    await uploadAsset(t, retryAccess);
    await t.mutation(internal.seedBootstrap.applyBatch, {
      ...retryAccess,
      records: plan.records.slice(1),
    });
    const retried = await t.run(async (ctx) => {
      const run = await ctx.db.get("questionImportRuns", retry.runId);
      const published = await ctx.db
        .query("questionVersions")
        .withIndex("by_bootstrapRunId_and_state", (query) =>
          query.eq("bootstrapRunId", retry.runId).eq("state", "published"),
        )
        .collect();
      const reviews = await ctx.db
        .query("questionReviews")
        .withIndex("by_questionVersionId")
        .collect();
      return { run, published, reviews };
    });
    expect(retried.run).toMatchObject({
      state: "complete",
      rolledBack: 0,
    });
    expect(retried.published).toHaveLength(4);
    expect(
      retried.reviews.filter(
        (review) =>
          review.kind === "bootstrap_acceptance" &&
          review.importRunId === retry.runId,
      ),
    ).toHaveLength(4);
  });
});

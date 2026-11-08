// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { v } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import * as questionImports from "./questionImports";
import * as questionImportActions from "./questionImportActions";
import * as questionAssets from "./questionAssets";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import { digest } from "./lib/questionContent";
import type { SourceRecord, Descriptor } from "./lib/questionImportProtocol";
import { importChainStart } from "../lib/question-import-contract.mjs";

vi.mock("../lib/question-import-contract.mjs", async (original) => ({
  ...(await original<object>()),
  approvedImportTargets: {
    fixture: "https://fixture.convex.cloud",
    "fixture-alias": "https://fixture.convex.cloud",
  },
}));
const { api, createTest } = defineTestApp({ schema }).defineModules({
  questionImports,
  questionImportActions,
  questionAssets,
});
const provenance = {
  kind: "synthetic" as const,
  author: "fixture",
  assistance: "Synthetic tests only",
  sources: [],
};
const question: Extract<SourceRecord, { kind: "question" }> = {
  kind: "question",
  value: {
    questionId: "fixture-question",
    version: 4,
    family: 1,
    module: "shared-core",
    subjectId: "numerical_ability",
    subtopicId: "numerical_reasoning",
    conceptId: "numerical_reasoning",
    language: "english",
    difficulty: "easy",
    levelApplicability: ["professional", "subprofessional"],
    stem: "What is two plus three?",
    choices: [
      { choiceId: "a", text: "5" },
      { choiceId: "b", text: "6" },
    ],
    correctChoiceId: "a",
    explanation: "Two plus three equals five.",
    provenance,
  },
};
const reference: Extract<SourceRecord, { kind: "reference" }> = {
  kind: "reference",
  value: {
    referenceId: "fixture-reference",
    version: 3,
    family: 1,
    module: "shared-core",
    language: "english",
    title: "Practice facts",
    blocks: [
      { type: "text", text: "There are two red and three blue counters." },
    ],
    provenance,
  },
};
const png = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
).buffer;

/** Pin a deterministic synthetic inventory without using production content or credentials. */
async function plan(sources: SourceRecord[] = [question]) {
  const entries: Descriptor[] = [];
  let inventoryHash = importChainStart;
  for (const source of sources) {
    const d: Descriptor = {
      ordinal: entries.length,
      kind: source.kind,
      sourceId:
        source.kind === "asset"
          ? source.value.assetId
          : source.kind === "reference"
            ? source.value.referenceId
            : source.value.questionId,
      version: source.kind === "asset" ? 0 : source.value.version,
      family: 1,
      sourceChecksum: await digest(source.value),
    };
    entries.push(d);
    inventoryHash = await digest({ chain: inventoryHash, entry: d });
  }
  const manifests = [
    {
      corpusId: "synthetic-family",
      revision: 1,
      checksum: "a".repeat(64),
      family: 1,
      taxonomyId: "cse-taxonomy-2027-v2",
      blueprintIds: ["cse-professional-2027-v3", "cse-subprofessional-2027-v3"],
      questions: sources.filter((s) => s.kind === "question").length,
      references: sources.filter((s) => s.kind === "reference").length,
      assets: sources.filter((s) => s.kind === "asset").length,
    },
  ];
  return {
    manifests,
    inventoryHash,
    planChecksum: await digest({ manifests, inventoryHash }),
    entries,
    records: sources.map((source, i) => ({ source, descriptor: entries[i] })),
  };
}
/** Create isolated actors and an approved sealed taxonomy. */
async function setup() {
  const t = createTest();
  await t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      tokenIdentifier: "https://test|admin",
      role: "admin",
      status: "active",
    });
    for (const [name, role, status] of [
      ["other", "admin", "active"],
      ["user", "user", "active"],
      ["suspended", "admin", "suspended"],
    ] as const)
      await ctx.db.insert("users", {
        tokenIdentifier: `https://test|${name}`,
        role,
        status,
      });
    const id = await ctx.db.insert("taxonomyVersions", {
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
        taxonomyVersionId: id,
      });
  });
  const admin = t.withIdentity({ issuer: "https://test", subject: "admin" });
  return { t, admin };
}
/** Begin and stage a synthetic run using only its pinned checksum. */
async function start(
  admin: Awaited<ReturnType<typeof setup>>["admin"],
  p: Awaited<ReturnType<typeof plan>>,
) {
  const { manifests, inventoryHash, planChecksum } = p;
  const lease = await admin.mutation(api.questionImports.begin, {
    target: "fixture",
    manifests,
    inventoryHash,
    planChecksum,
  });
  const access = { ...lease, target: "fixture" };
  await admin.mutation(api.questionImports.stage, {
    ...access,
    entries: p.entries,
  });
  return access;
}
beforeEach(() => {
  vi.stubEnv("QUESTION_BANK_IMPORT_ENABLED", "true");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
});

describe("guarded question import", () => {
  it("detects existing content conflicts even when replacement dependencies are missing", async () => {
    const { admin } = await setup(),
      p = await plan([reference, question]),
      access = await start(admin, p);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: p.records,
    });
    const changedReference: SourceRecord = {
      kind: "reference",
      value: {
        ...reference.value,
        blocks: [
          {
            type: "image",
            assetId: "missing-image",
            caption: "Replacement",
            alt: "Replacement",
            description: "Replacement",
          },
        ],
      },
    };
    const changedQuestion: SourceRecord = {
      kind: "question",
      value: {
        ...question.value,
        reference: { referenceId: "missing-reference", referenceVersion: 9 },
      },
    };
    const changed = await plan([changedReference, changedQuestion]);
    const classifications = await admin.query(api.questionImports.preflight, {
      target: "fixture",
      manifest: p.manifests[0],
      records: changed.records,
    });
    expect(classifications.map((c) => c.status)).toEqual([
      "conflict",
      "conflict",
    ]);
  });
  it("resumes partially staged and processed plans without recreating records", async () => {
    const { t, admin } = await setup();
    const second: SourceRecord = {
      kind: "question",
      value: {
        ...question.value,
        questionId: "fixture-second",
        stem: "How much is three plus two?",
      },
    };
    const p = await plan([question, second]);
    const { manifests, inventoryHash, planChecksum } = p;
    const access = {
      ...(await admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      })),
      target: "fixture",
    };
    await admin.mutation(api.questionImports.stage, {
      ...access,
      entries: [p.entries[0]],
    });
    await admin.mutation(api.questionImports.stage, {
      ...access,
      entries: [p.entries[0]],
    });
    expect(
      (
        await admin.query(api.questionImports.status, {
          target: "fixture",
          runId: access.runId,
          after: -1,
        })
      ).run.staged,
    ).toBe(1);
    await admin.mutation(api.questionImports.stage, {
      ...access,
      entries: [p.entries[1]],
    });
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: [p.records[0]],
    });
    await admin.mutation(api.questionImports.interrupt, {
      ...access,
      code: "VALIDATION_FAILED",
    });
    const resumed = {
      ...(await admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
        resumeRunId: access.runId,
      })),
      target: "fixture",
    };
    await admin.mutation(api.questionImports.applyBatch, {
      ...resumed,
      records: p.records,
    });
    expect(
      (
        await admin.query(api.questionImports.status, {
          target: "fixture",
          runId: access.runId,
          after: -1,
        })
      ).run.state,
    ).toBe("complete");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("questions").collect()).toHaveLength(2);
      const events = await ctx.db.query("auditEvents").collect();
      expect(events.filter((e) => e.action === "import_draft")).toHaveLength(2);
    });
  });

  it("allows exactly one of two competing begin requests", async () => {
    const { admin } = await setup(),
      p = await plan();
    const { manifests, inventoryHash, planChecksum } = p;
    const results = await Promise.allSettled(
      [0, 1].map(() =>
        admin.mutation(api.questionImports.begin, {
          target: "fixture",
          manifests,
          inventoryHash,
          planChecksum,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await expect(
      admin.mutation(api.questionImports.begin, {
        target: "fixture-alias",
        manifests,
        inventoryHash,
        planChecksum,
      }),
    ).rejects.toThrow("IMPORT_BUSY");
  });

  it("preserves attribution and existing publication when explicit later versions are imported", async () => {
    const { t, admin } = await setup(),
      p = await plan(),
      access = await start(admin, p);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: p.records,
    });
    const original = await t.run(async (ctx) => {
      const q = (await ctx.db.query("questions").collect())[0],
        version = (await ctx.db.query("questionVersions").collect())[0];
      await ctx.db.patch("questionVersions", version._id, {
        state: "published",
      });
      return { q, version };
    });
    const next = await plan([
      {
        kind: "question",
        value: {
          ...question.value,
          version: 5,
          explanation: "An explicit new immutable version.",
        },
      },
    ]);
    const access2 = await start(admin, next);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access2,
      records: next.records,
    });
    await t.run(async (ctx) => {
      expect(
        (await ctx.db.get("questions", original.q._id))?.contributorId,
      ).toBe(original.q.contributorId);
      expect(
        (await ctx.db.get("questionVersions", original.version._id))?.state,
      ).toBe("published");
      const versions = await ctx.db.query("questionVersions").collect();
      expect(versions.find((x) => x.version === 5)?.state).toBe("draft");
    });
  });

  it("reports and blocks missing exact references before question creation", async () => {
    const { t, admin } = await setup();
    const source: SourceRecord = {
      kind: "question",
      value: {
        ...question.value,
        reference: { referenceId: "missing", referenceVersion: 99 },
      },
    };
    const p = await plan([source]);
    expect(
      (
        await admin.query(api.questionImports.preflight, {
          target: "fixture",
          manifest: p.manifests[0],
          records: p.records,
        })
      )[0].status,
    ).toBe("dependency_pending");
    const access = await start(admin, p);
    await expect(
      admin.mutation(api.questionImports.applyBatch, {
        ...access,
        records: p.records,
      }),
    ).rejects.toThrow("REFERENCE_NOT_FOUND");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("questionVersions").collect()).toHaveLength(0);
    });
  });

  it("compensates import image storage when the fenced completion rejects", async () => {
    const app = defineTestApp({ schema });
    const broken = app.defineModules({
      questionAssets,
      questionImportActions,
      questionImports: {
        ...questionImports,
        completeAsset: app.internalMutation({
          args: {
            runId: v.id("questionImportRuns"),
            target: v.string(),
            generation: v.number(),
            ordinal: v.number(),
            storageId: v.id("_storage"),
            expectedRevision: v.number(),
          },
          returns: v.null(),
          handler: async () => {
            throw new Error("IMPORT_LEASE_LOST");
          },
        }),
      },
    });
    const t = broken.createTest();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", png)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: "https://test|admin",
        role: "admin",
        status: "active",
      });
      const runId = await ctx.db.insert("questionImportRuns", {
        target: "fixture",
        targetUrl: "https://fixture.convex.cloud",
        ownerId,
        planChecksum: "a".repeat(64),
        inventoryHash: "b".repeat(64),
        chain: "b".repeat(64),
        manifests: [],
        stagedCounts: [],
        expected: 1,
        staged: 1,
        processed: 0,
        state: "running",
        generation: 1,
        leaseUntil: Date.now() + 300000,
        createdAt: 0,
        updatedAt: 0,
      });
      await ctx.db.insert("questionImportEntries", {
        runId,
        ordinal: 0,
        kind: "asset",
        sourceId: "chart",
        version: 0,
        family: 1,
        sourceChecksum: "c".repeat(64),
        state: "pending",
      });
      await ctx.db.insert("questionAssets", {
        assetId: "chart",
        sha256: hash,
        mediaType: "image/png",
        width: 1,
        height: 1,
        provenance,
        uploaderId: ownerId,
        createdAt: 0,
        state: "pending",
        revision: 1,
      });
    });
    const admin = t.withIdentity({ issuer: "https://test", subject: "admin" });
    const run = await t.run(
      async (ctx) => (await ctx.db.query("questionImportRuns").collect())[0],
    );
    await expect(
      admin.action(broken.api.questionImportActions.uploadAsset, {
        runId: run._id,
        target: "fixture",
        generation: 1,
        ordinal: 0,
        bytes: png,
      }),
    ).rejects.toThrow("IMPORT_LEASE_LOST");
    await t.run(async (ctx) => {
      expect(await ctx.db.system.query("_storage").take(10)).toHaveLength(0);
      expect((await ctx.db.query("questionAssets").collect())[0].state).toBe(
        "pending",
      );
    });
  });
  it("preflights without writes, preserves exact versions and retries completed plans without audit duplicates", async () => {
    const { t, admin } = await setup(),
      p = await plan();
    const preflight = await admin.query(api.questionImports.preflight, {
      target: "fixture",
      manifest: p.manifests[0],
      records: p.records,
    });
    expect(preflight).toEqual([
      { ordinal: 0, status: "new", duplicateCandidates: 0 },
    ]);
    await t.run(async (ctx) => {
      expect(await ctx.db.query("auditEvents").collect()).toHaveLength(0);
      expect(await ctx.db.query("questionImportRuns").collect()).toHaveLength(
        0,
      );
    });
    const access = await start(admin, p);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: p.records,
    });
    const status = await admin.query(api.questionImports.status, {
      target: "fixture",
      runId: access.runId,
      after: -1,
    });
    expect(status.run.state).toBe("complete");
    expect(status.entries[0].sourceChecksum).toBe(p.entries[0].sourceChecksum);
    expect(JSON.stringify(status)).not.toContain('"correctChoiceId"');
    const before = await t.run(async (ctx) => {
      const versions = await ctx.db.query("questionVersions").collect();
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(4);
      expect(versions[0].state).toBe("draft");
      return (await ctx.db.query("auditEvents").collect()).length;
    });
    const { manifests, inventoryHash, planChecksum } = p;
    expect(
      await admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      }),
    ).toEqual({ runId: access.runId, generation: access.generation });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("auditEvents").collect()).toHaveLength(before);
    });
  });

  it.each([null, "user", "suspended"])(
    "rejects every public endpoint for unauthorized actor %s",
    async (name) => {
      const { t, admin } = await setup(),
        p = await plan(),
        access = await start(admin, p);
      const client = name
        ? t.withIdentity({ issuer: "https://test", subject: name })
        : t;
      const { manifests, inventoryHash, planChecksum } = p;
      await expect(
        client.mutation(api.questionImports.begin, {
          target: "fixture",
          manifests,
          inventoryHash,
          planChecksum,
        }),
      ).rejects.toThrow();
      await expect(
        client.query(api.questionImports.preflight, {
          target: "fixture",
          manifest: manifests[0],
          records: p.records,
        }),
      ).rejects.toThrow();
      await expect(
        client.query(api.questionImports.status, {
          target: "fixture",
          runId: access.runId,
          after: -1,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.questionImports.stage, {
          ...access,
          entries: p.entries,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.questionImports.renew, access),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.questionImports.interrupt, {
          ...access,
          code: "VALIDATION_FAILED",
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.questionImports.applyBatch, {
          ...access,
          records: p.records,
        }),
      ).rejects.toThrow();
      await expect(
        client.action(api.questionImportActions.uploadAsset, {
          ...access,
          ordinal: 0,
          bytes: png,
        }),
      ).rejects.toThrow();
    },
  );

  it("refuses unapproved, disabled and mismatched targets before writes", async () => {
    const { t, admin } = await setup(),
      p = await plan();
    const { manifests, inventoryHash, planChecksum } = p;
    for (const target of ["prod", "https://fixture.convex.cloud"])
      await expect(
        admin.mutation(api.questionImports.begin, {
          target,
          manifests,
          inventoryHash,
          planChecksum,
        }),
      ).rejects.toThrow("IMPORT_TARGET_DISABLED");
    vi.stubEnv("QUESTION_BANK_IMPORT_ENABLED", "false");
    await expect(
      admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      }),
    ).rejects.toThrow("IMPORT_TARGET_DISABLED");
    vi.stubEnv("QUESTION_BANK_IMPORT_ENABLED", "true");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
    await expect(
      admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      }),
    ).rejects.toThrow("IMPORT_TARGET_DISABLED");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("questionImportRuns").collect()).toHaveLength(
        0,
      );
    });
  });

  it("rejects competing runs, wrong owners, stale generations and expired leases", async () => {
    const { t, admin } = await setup(),
      p = await plan(),
      access = await start(admin, p);
    const { manifests, inventoryHash, planChecksum } = p;
    await expect(
      admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      }),
    ).rejects.toThrow("IMPORT_BUSY");
    const other = t.withIdentity({ issuer: "https://test", subject: "other" });
    await expect(
      other.query(api.questionImports.status, {
        target: "fixture",
        runId: access.runId,
        after: -1,
      }),
    ).rejects.toThrow("IMPORT_RUN_FORBIDDEN");
    await expect(
      other.mutation(api.questionImports.applyBatch, {
        ...access,
        records: p.records,
      }),
    ).rejects.toThrow("IMPORT_RUN_FORBIDDEN");
    await t.run(async (ctx) =>
      ctx.db.patch("questionImportRuns", access.runId, { leaseUntil: 0 }),
    );
    await expect(
      admin.mutation(api.questionImports.applyBatch, {
        ...access,
        records: p.records,
      }),
    ).rejects.toThrow("IMPORT_LEASE_LOST");
    const resumed = await admin.mutation(api.questionImports.begin, {
      target: "fixture",
      manifests,
      inventoryHash,
      planChecksum,
      resumeRunId: access.runId,
    });
    expect(resumed.generation).toBe(access.generation + 1);
    await expect(
      admin.mutation(api.questionImports.renew, access),
    ).rejects.toThrow("IMPORT_LEASE_LOST");
    await admin.mutation(api.questionImports.applyBatch, {
      ...resumed,
      target: "fixture",
      records: p.records,
    });
  });

  it("rolls back a whole batch and its audit/checkpoints if a later question is invalid", async () => {
    const { t, admin } = await setup();
    const invalid: SourceRecord = {
      kind: "question",
      value: {
        ...question.value,
        questionId: "fixture-invalid",
        correctChoiceId: "missing",
      },
    };
    const p = await plan([question, invalid]),
      access = await start(admin, p);
    const before = await t.run(
      async (ctx) => (await ctx.db.query("auditEvents").collect()).length,
    );
    await expect(
      admin.mutation(api.questionImports.applyBatch, {
        ...access,
        records: p.records,
      }),
    ).rejects.toThrow("VALIDATION_FAILED");
    await t.run(async (ctx) => {
      expect(await ctx.db.query("questionVersions").collect()).toHaveLength(0);
      expect(await ctx.db.query("questions").collect()).toHaveLength(0);
      expect(await ctx.db.query("auditEvents").collect()).toHaveLength(before);
    });
    expect(
      (
        await admin.query(api.questionImports.status, {
          target: "fixture",
          runId: access.runId,
          after: -1,
        })
      ).run.processed,
    ).toBe(0);
    await admin.mutation(api.questionImports.interrupt, {
      ...access,
      code: "VALIDATION_FAILED",
    });
    const status = await admin.query(api.questionImports.status, {
      target: "fixture",
      runId: access.runId,
      after: -1,
    });
    expect(status.entries[0].failureCode).toBe("VALIDATION_FAILED");
    expect(status.run.leaseUntil).toBe(0);
  });

  it("pins the inventory and rejects changed payloads, missing entries and oversized batches", async () => {
    const { admin } = await setup(),
      p = await plan();
    const { manifests, inventoryHash, planChecksum } = p;
    const access = {
      ...(await admin.mutation(api.questionImports.begin, {
        target: "fixture",
        manifests,
        inventoryHash,
        planChecksum,
      })),
      target: "fixture",
    };
    await expect(
      admin.mutation(api.questionImports.stage, {
        ...access,
        entries: [{ ...p.entries[0], sourceChecksum: "b".repeat(64) }],
      }),
    ).rejects.toThrow("INVALID_IMPORT_PLAN");
    await expect(
      admin.mutation(api.questionImports.stage, {
        ...access,
        entries: [{ ...p.entries[0], ordinal: 1 }],
      }),
    ).rejects.toThrow("IMPORT_ORDER");
    await expect(
      admin.mutation(api.questionImports.stage, {
        ...access,
        entries: Array(11).fill(p.entries[0]),
      }),
    ).rejects.toThrow("IMPORT_BATCH_LIMIT");
    await admin.mutation(api.questionImports.stage, {
      ...access,
      entries: p.entries,
    });
    await expect(
      admin.mutation(api.questionImports.applyBatch, {
        ...access,
        records: [
          {
            ...p.records[0],
            source: {
              kind: "question",
              value: { ...question.value, explanation: "Changed" },
            },
          },
        ],
      }),
    ).rejects.toThrow("IMPORT_SOURCE_CHANGED");
  });

  it("imports protected image/reference/question dependencies and reconciles a lost upload response", async () => {
    const { t, admin } = await setup();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", png)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    const asset: SourceRecord = {
      kind: "asset",
      value: {
        assetId: "fixture-chart",
        path: "references/assets/chart.png",
        sha256: hash,
        mediaType: "image/png",
        width: 1,
        height: 1,
        provenance,
      },
    };
    const ref: Extract<SourceRecord, { kind: "reference" }> = {
      kind: "reference",
      value: {
        ...reference.value,
        blocks: [
          {
            type: "image",
            assetId: "fixture-chart",
            caption: "Chart",
            alt: "Counters",
            description: "Two red and three blue counters.",
          },
        ],
      },
    };
    const q: SourceRecord = {
      kind: "question",
      value: {
        ...question.value,
        reference: {
          referenceId: ref.value.referenceId,
          referenceVersion: ref.value.version,
        },
      },
    };
    const p = await plan([asset, ref, q]),
      access = await start(admin, p);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: [p.records[0]],
    });
    await expect(
      admin.action(api.questionImportActions.uploadAsset, {
        ...access,
        ordinal: 0,
        bytes: new Uint8Array([0]).buffer,
      }),
    ).rejects.toThrow();
    await admin.action(api.questionImportActions.uploadAsset, {
      ...access,
      ordinal: 0,
      bytes: png,
    });
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: [p.records[0]],
    });
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: p.records.slice(1),
    });
    expect(
      (
        await admin.query(api.questionImports.status, {
          target: "fixture",
          runId: access.runId,
          after: -1,
        })
      ).entries[0].outcome,
    ).toBe("created");
    await t.run(async (ctx) => {
      const assets = await ctx.db.query("questionAssets").collect(),
        refs = await ctx.db.query("questionReferenceVersions").collect(),
        qs = await ctx.db.query("questionVersions").collect();
      expect(assets).toHaveLength(1);
      expect(assets[0].sha256).toBe(hash);
      expect(refs[0].version).toBe(3);
      expect(qs[0].version).toBe(4);
      expect(qs[0].referenceVersionId).toBe(refs[0]._id);
      expect(qs[0].state).toBe("draft");
    });
  });

  it("reports conflicting exact versions and rejects forged approval, unknown taxonomy and invalid eligibility", async () => {
    const { admin } = await setup(),
      p = await plan(),
      access = await start(admin, p);
    await admin.mutation(api.questionImports.applyBatch, {
      ...access,
      records: p.records,
    });
    const changed = await plan([
      {
        kind: "question",
        value: { ...question.value, stem: "What is two times three?" },
      },
    ]);
    expect(
      (
        await admin.query(api.questionImports.preflight, {
          target: "fixture",
          manifest: p.manifests[0],
          records: changed.records,
        })
      )[0].status,
    ).toBe("conflict");
    const invalid = await plan([
      { kind: "question", value: { ...question.value, conceptId: "unknown" } },
    ]);
    expect(
      (
        await admin.query(api.questionImports.preflight, {
          target: "fixture",
          manifest: p.manifests[0],
          records: invalid.records,
        })
      )[0],
    ).toMatchObject({ status: "invalid", code: "UNKNOWN_TAXONOMY_ENTRY" });
    const wrongLevel = await plan([
      {
        kind: "question",
        value: { ...question.value, levelApplicability: ["professional"] },
      },
    ]);
    expect(
      (
        await admin.query(api.questionImports.preflight, {
          target: "fixture",
          manifest: p.manifests[0],
          records: wrongLevel.records,
        })
      )[0],
    ).toMatchObject({ status: "invalid", code: "VALIDATION_FAILED" });
    // Extra JSON fields fail the public argument validator before reaching domain code.
    await expect(
      admin.query(api.questionImports.preflight, {
        target: "fixture",
        manifest: p.manifests[0],
        records: [
          {
            ...p.records[0],
            source: {
              kind: "question",
              value: { ...question.value, approved: true },
            },
          },
        ],
      } as never),
    ).rejects.toThrow();
  });
});

// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import * as seedPublication from "./seedPublication";
import * as questions from "./questions";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import { digest, type QuestionContent } from "./lib/questionContent";
import { validateQuestion } from "./lib/questionContent";
import { loadPublishedQuestion } from "./lib/questionServing";
import { importChainStart } from "../lib/question-import-contract.mjs";

vi.mock("../lib/question-import-contract.mjs", async (original) => ({
  ...(await original<object>()),
  approvedImportTargets: { fixture: "https://fixture.convex.cloud" },
  seedPublicationPolicy: {
    families: 2,
    perFamilyQuestions: 2,
    expectedQuestions: 4,
    expectedReferences: 1,
    expectedAssets: 1,
  },
}));
const { api, createTest } = defineTestApp({ schema }).defineModules({
  seedPublication,
  questions,
});
const planChecksum = "e".repeat(64);
const inventoryHash = "f".repeat(64);
const provenance = {
  kind: "synthetic" as const,
  author: "fixture",
  assistance: "Synthetic rehearsal only",
  sources: [],
};
const referenceContent = {
  family: 1,
  module: "shared-core" as const,
  language: "english" as const,
  title: "Synthetic passage",
  provenance,
  blocks: [{ type: "text" as const, text: "A synthetic rehearsal passage." }],
};
const baseContent: QuestionContent = {
  family: 1,
  module: "shared-core",
  subjectId: "numerical_ability",
  subtopicId: "numerical_reasoning",
  conceptId: "numerical_reasoning",
  levelApplicability: ["professional", "subprofessional"],
  language: "english",
  difficulty: "easy",
  stem: "What is 2 + 3?",
  choices: [
    { choiceId: "a", text: "5" },
    { choiceId: "b", text: "6" },
  ],
  correctChoiceId: "a",
  explanation: "Two plus three is five.",
  provenance,
};
const questionContent = (index: number, family: number): QuestionContent => ({
  ...baseContent,
  family,
  stem: `Synthetic seed question ${index}: what is ${index} + 3?`,
  choices: [
    { choiceId: "a", text: `${index + 3}` },
    { choiceId: "b", text: "not-a-number" },
  ],
  explanation: `${index} plus three equals ${index + 3}.`,
});

/** Create the two-admin fixture, sealed taxonomy and a completed synthetic import. */
async function setup() {
  const t = createTest();
  const ids = await t.run(async (ctx) => {
    const users: Record<string, Id<"users">> = {};
    for (const [name, role, status] of [
      ["importer", "admin", "active"],
      ["approver", "admin", "active"],
      ["other", "admin", "active"],
      ["learner", "user", "active"],
      ["suspended", "admin", "suspended"],
    ] as const)
      users[name] = await ctx.db.insert("users", {
        tokenIdentifier: `https://test|${name}`,
        role,
        status,
      });
    const importerId = users.importer;
    const taxonomy = await ctx.db.insert("taxonomyVersions", {
      taxonomyId: "cse-taxonomy-2027-v2",
      state: "sealed",
      revision: 1,
      createdBy: importerId,
      createdAt: 0,
      updatedAt: 0,
    });
    for (const entry of initialV2Catalog)
      await ctx.db.insert("taxonomyEntries", {
        ...entry,
        taxonomyVersionId: taxonomy,
      });
    const referenceHash = await digest(referenceContent);
    const referenceVersionId = await ctx.db.insert(
      "questionReferenceVersions",
      {
        referenceId: "synthetic-reference",
        version: 1,
        content: referenceContent,
        contentHash: referenceHash,
        creatorId: importerId,
        createdAt: 0,
      },
    );
    const versions = [];
    for (let index = 1; index <= 4; index++) {
      const content = questionContent(index, index <= 2 ? 1 : 2);
      const hashes = await validateQuestion(
        ctx,
        content,
        taxonomy,
        index === 1 ? referenceVersionId : undefined,
      );
      const questionId = await ctx.db.insert("questions", {
        questionId: `synthetic-${index}`,
        contributorId: importerId,
        family: content.family,
        latestVersion: 1,
        revision: 1,
        createdAt: 0,
      });
      const questionVersionId = await ctx.db.insert("questionVersions", {
        questionId,
        version: 1,
        content,
        taxonomyVersionId: taxonomy,
        ...(index === 1 ? { referenceVersionId } : {}),
        ...hashes,
        creatorId: importerId,
        createdAt: 0,
        state: "draft",
        workflowRevision: 1,
      });
      versions.push({ questionId, questionVersionId });
    }
    const manifests = [
      {
        corpusId: "synthetic-family-1",
        revision: 1,
        checksum: "1".repeat(64),
        family: 1,
        taxonomyId: "cse-taxonomy-2027-v2",
        blueprintIds: [
          "cse-professional-2027-v3",
          "cse-subprofessional-2027-v3",
        ],
        questions: 2,
        references: 1,
        assets: 0,
      },
      {
        corpusId: "synthetic-family-2",
        revision: 1,
        checksum: "2".repeat(64),
        family: 2,
        taxonomyId: "cse-taxonomy-2027-v2",
        blueprintIds: [
          "cse-professional-2027-v3",
          "cse-subprofessional-2027-v3",
        ],
        questions: 2,
        references: 0,
        assets: 1,
      },
    ];
    const importRunId = await ctx.db.insert("questionImportRuns", {
      target: "fixture",
      targetUrl: "https://fixture.convex.cloud",
      ownerId: importerId,
      planChecksum,
      inventoryHash,
      chain: importChainStart,
      manifests,
      stagedCounts: [
        { family: 1, questions: 2, references: 1, assets: 0 },
        { family: 2, questions: 2, references: 0, assets: 1 },
      ],
      expected: 6,
      staged: 6,
      processed: 6,
      state: "complete",
      generation: 1,
      leaseUntil: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const entries = [
      {
        ordinal: 0,
        kind: "asset" as const,
        sourceId: "synthetic-image",
        version: 0,
        family: 2,
        sourceChecksum: "a".repeat(64),
        resultId: "unused-asset-result",
      },
      {
        ordinal: 1,
        kind: "reference" as const,
        sourceId: "synthetic-reference",
        version: 1,
        family: 1,
        sourceChecksum: "b".repeat(64),
        resultId: referenceVersionId,
      },
      ...versions.map((version, index) => ({
        ordinal: index + 2,
        kind: "question" as const,
        sourceId: `synthetic-${index + 1}`,
        version: 1,
        family: index < 2 ? 1 : 2,
        sourceChecksum: `${index + 3}`.repeat(64),
        resultId: version.questionVersionId,
      })),
    ];
    for (const entry of entries)
      await ctx.db.insert("questionImportEntries", {
        runId: importRunId,
        ...entry,
        state: "done",
      });
    return { taxonomy, importRunId, versions, referenceVersionId };
  });
  const client = (subject: string) =>
    t.withIdentity({ issuer: "https://test", subject });
  return {
    t,
    importer: client("importer"),
    approver: client("approver"),
    other: client("other"),
    client,
    ...ids,
  };
}
const stageItems = [
  { ordinal: 0, importOrdinal: 2 },
  { ordinal: 1, importOrdinal: 3 },
  { ordinal: 2, importOrdinal: 4 },
  { ordinal: 3, importOrdinal: 5 },
];
async function begin(
  importer: Awaited<ReturnType<typeof setup>>["importer"],
  importRunId: Awaited<ReturnType<typeof setup>>["importRunId"],
) {
  return importer.mutation(api.seedPublication.begin, {
    target: "fixture",
    importRunId,
    planChecksum,
    inventoryHash,
  });
}
async function stageThrough(
  importer: Awaited<ReturnType<typeof setup>>["importer"],
  runId: Awaited<ReturnType<typeof begin>>["runId"],
  generation: number,
) {
  await importer.mutation(api.seedPublication.stage, {
    runId,
    target: "fixture",
    generation,
    items: stageItems,
  });
}
async function submitAll(
  importer: Awaited<ReturnType<typeof setup>>["importer"],
  runId: Awaited<ReturnType<typeof begin>>["runId"],
  generation: number,
  versions: Awaited<ReturnType<typeof setup>>["versions"],
) {
  await importer.mutation(api.seedPublication.submit, {
    runId,
    target: "fixture",
    generation,
    questionVersionIds: versions.map((version) => version.questionVersionId),
  });
}
async function approveAll(
  approver: Awaited<ReturnType<typeof setup>>["approver"],
  runId: Awaited<ReturnType<typeof begin>>["runId"],
  generation: number,
  versions: Awaited<ReturnType<typeof setup>>["versions"],
) {
  await approver.mutation(api.seedPublication.approve, {
    runId,
    target: "fixture",
    generation,
    questionVersionIds: versions.map((version) => version.questionVersionId),
  });
}
async function publishAll(
  approver: Awaited<ReturnType<typeof setup>>["approver"],
  runId: Awaited<ReturnType<typeof begin>>["runId"],
  generation: number,
  versions: Awaited<ReturnType<typeof setup>>["versions"],
) {
  await approver.mutation(api.seedPublication.publish, {
    runId,
    target: "fixture",
    generation,
    questionVersionIds: versions.map((version) => version.questionVersionId),
  });
}
beforeEach(() => {
  vi.stubEnv("SEED_PUBLICATION_ENABLED", "true");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://fixture.convex.cloud");
  vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", planChecksum);
  vi.stubEnv("SEED_PUBLICATION_APPROVER", "https://test|approver");
});

describe("seed publication rehearsal", () => {
  it("stages, independently accepts and publishes the complete seed, then gates serving", async () => {
    const { t, importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await expect(
      importer.query(api.seedPublication.status, {
        target: "fixture",
        runId: lease.runId,
        after: -1,
      }),
    ).resolves.toMatchObject({ run: { state: "preparing", staged: 0 } });
    await stageThrough(importer, lease.runId, lease.generation);
    const staged = await importer.query(api.seedPublication.status, {
      target: "fixture",
      runId: lease.runId,
      after: -1,
    });
    expect(staged.run).toMatchObject({
      state: "running",
      staged: 4,
      expected: 4,
    });
    expect(staged.items.map((item) => item.ordinal)).toEqual([0, 1, 2, 3]);
    await expect(
      t.query((ctx) =>
        loadPublishedQuestion(ctx, versions[0].questionVersionId),
      ),
    ).rejects.toThrow();
    await submitAll(importer, lease.runId, lease.generation, versions);
    await approveAll(approver, lease.runId, lease.generation, versions);
    const accepted = await approver.query(api.seedPublication.status, {
      target: "fixture",
      runId: lease.runId,
      after: -1,
    });
    expect(accepted.run).toMatchObject({
      state: "running",
      submitted: 4,
      approved: 4,
      published: 0,
    });
    expect(accepted.items.every((item) => item.approvalId)).toBe(true);
    const reviews = await t.run((ctx) =>
      ctx.db.query("questionReviews").collect(),
    );
    expect(reviews).toHaveLength(4);
    expect(reviews[0]).toMatchObject({
      kind: "seed_acceptance",
      decision: "accept",
      rubric: "seed-bootstrap-v1",
      score: 5,
    });
    await expect(
      t.query((ctx) =>
        loadPublishedQuestion(ctx, versions[0].questionVersionId),
      ),
    ).rejects.toThrow();
    await publishAll(approver, lease.runId, lease.generation, versions);
    const complete = await approver.query(api.seedPublication.status, {
      target: "fixture",
      runId: lease.runId,
      after: -1,
    });
    expect(complete.run).toMatchObject({
      state: "complete",
      published: 4,
      leaseUntil: 0,
    });
    const served = await t.query((ctx) =>
      loadPublishedQuestion(ctx, versions[0].questionVersionId),
    );
    expect(served.stem).toContain("Synthetic seed question");
    expect(served).not.toHaveProperty("correctChoiceId");
    expect(served).not.toHaveProperty("explanation");
    for (const version of versions)
      expect(
        (
          await t.run((ctx) =>
            ctx.db.get("questionVersions", version.questionVersionId),
          )
        )?.state,
      ).toBe("published");
  });

  it("keeps ordinary lifecycle operations off pinned versions until the run completes", async () => {
    const { t, importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await stageThrough(importer, lease.runId, lease.generation);
    const version = versions[0].questionVersionId;
    await expect(
      importer.mutation(api.questions.submitForReview, {
        questionVersionId: version,
        expectedWorkflowRevision: 1,
      }),
    ).rejects.toMatchObject({ data: { code: "SEED_PUBLICATION_REQUIRED" } });
    await submitAll(importer, lease.runId, lease.generation, versions);
    await approveAll(approver, lease.runId, lease.generation, versions);
    await expect(
      importer.mutation(api.questions.reviewVersion, {
        questionVersionId: version,
        expectedWorkflowRevision: 3,
        decision: "approve",
        reason: "",
        assessment: Array.from({ length: 5 }, () => ({
          passed: true,
          evidence: "fixture",
        })),
        duplicateDisposition: "none_found",
        duplicateEvidence: "fixture",
      }),
    ).rejects.toMatchObject({ data: { code: "SEED_PUBLICATION_REQUIRED" } });
    await publishAll(approver, lease.runId, lease.generation, versions);
    await expect(
      importer.mutation(api.questions.archiveVersion, {
        questionVersionId: version,
        expectedWorkflowRevision: 4,
      }),
    ).resolves.toBe(5);
    expect(
      (await t.run((ctx) => ctx.db.get("questionVersions", version)))?.state,
    ).toBe("archived");
  });

  it("pauses, resumes without losing approved work, and rolls back by archiving only", async () => {
    const { t, importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await stageThrough(importer, lease.runId, lease.generation);
    await submitAll(importer, lease.runId, lease.generation, versions);
    await approveAll(approver, lease.runId, lease.generation, versions);
    await approver.mutation(api.seedPublication.pause, {
      target: "fixture",
      runId: lease.runId,
      code: "SEED_OPERATION_FAILED",
    });
    await expect(
      approver.mutation(api.seedPublication.publish, {
        runId: lease.runId,
        target: "fixture",
        generation: lease.generation,
        questionVersionIds: versions.map(
          (version) => version.questionVersionId,
        ),
      }),
    ).rejects.toThrow("SEED_LEASE_LOST");
    const resumed = await importer.mutation(api.seedPublication.begin, {
      target: "fixture",
      importRunId,
      planChecksum,
      inventoryHash,
      resumeRunId: lease.runId,
    });
    expect(resumed.generation).toBe(lease.generation + 1);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash,
        resumeRunId: lease.runId,
      }),
    ).rejects.toThrow("SEED_BUSY");
    await publishAll(approver, lease.runId, resumed.generation, versions);
    await expect(
      importer.mutation(api.seedPublication.rollbackBatch, {
        target: "fixture",
        runId: lease.runId,
        questionVersionIds: versions.map(
          (version) => version.questionVersionId,
        ),
        reason: "Rehearsal rollback",
      }),
    ).resolves.toBeNull();
    const rolled = await importer.query(api.seedPublication.status, {
      target: "fixture",
      runId: lease.runId,
      after: -1,
    });
    expect(rolled.run).toMatchObject({
      state: "rolled_back",
      rolledBack: 4,
      rollbackReason: "Rehearsal rollback",
    });
    for (const version of versions) {
      expect(
        (
          await t.run((ctx) =>
            ctx.db.get("questionVersions", version.questionVersionId),
          )
        )?.state,
      ).toBe("archived");
    }
    expect(
      await t.run((ctx) => ctx.db.query("questions").collect()),
    ).toHaveLength(4);
    await expect(
      t.query((ctx) =>
        loadPublishedQuestion(ctx, versions[0].questionVersionId),
      ),
    ).rejects.toThrow();
    await expect(
      importer.mutation(api.seedPublication.rollbackBatch, {
        target: "fixture",
        runId: lease.runId,
        questionVersionIds: versions.map(
          (version) => version.questionVersionId,
        ),
        reason: "Rehearsal rollback retry",
      }),
    ).resolves.toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("questionReviews").collect()),
    ).toHaveLength(4);
  });

  it("requires a completed import, the exact pinned plan and the frozen policy", async () => {
    const { t, importer, importRunId } = await setup();
    await t.run((ctx) =>
      ctx.db.patch("questionImportRuns", importRunId, { state: "running" }),
    );
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_IMPORT_REQUIRED",
    );
    await t.run((ctx) =>
      ctx.db.patch("questionImportRuns", importRunId, {
        state: "complete",
        processed: 5,
      }),
    );
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_POLICY_MISMATCH",
    );
    await t.run((ctx) =>
      ctx.db.patch("questionImportRuns", importRunId, { processed: 6 }),
    );
    vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", "0".repeat(64));
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_PLAN_MISMATCH",
    );
    vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", planChecksum);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash: "0".repeat(64),
      }),
    ).rejects.toThrow("SEED_IMPORT_MISMATCH");
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum: "0".repeat(64),
        inventoryHash,
      }),
    ).rejects.toThrow("SEED_PLAN_MISMATCH");
    expect(
      await t.run((ctx) => ctx.db.query("seedPublicationRuns").collect()),
    ).toHaveLength(0);
  });

  it("requires two distinct active admins and rechecks the nominated approver", async () => {
    const { importer, approver, importRunId, client } = await setup();
    vi.stubEnv("SEED_PUBLICATION_APPROVER", "https://test|importer");
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_APPROVER_MISMATCH",
    );
    vi.stubEnv("SEED_PUBLICATION_APPROVER", "https://test|suspended");
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_APPROVER_MISMATCH",
    );
    vi.stubEnv("SEED_PUBLICATION_APPROVER", "https://test|learner");
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_APPROVER_MISMATCH",
    );
    vi.stubEnv("SEED_PUBLICATION_APPROVER", "https://test|approver");
    const lease = await begin(importer, importRunId);
    const roles = [
      importer.mutation(api.seedPublication.approve, {
        ...lease,
        target: "fixture",
        questionVersionIds: [],
      }),
      approver.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: stageItems,
      }),
      client("other").mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: stageItems,
      }),
    ];
    for (const result of await Promise.allSettled(roles))
      expect(result.status).toBe("rejected");
  });

  it("fences nonparticipants, stale generations and expired leases", async () => {
    const { t, importer, importRunId, client } = await setup();
    const lease = await begin(importer, importRunId);
    for (const caller of [
      t,
      client("learner"),
      client("suspended"),
      client("other"),
    ]) {
      await expect(
        caller.query(api.seedPublication.status, {
          target: "fixture",
          runId: lease.runId,
          after: -1,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.seedPublication.stage, {
          ...lease,
          target: "fixture",
          items: stageItems,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.seedPublication.pause, {
          target: "fixture",
          runId: lease.runId,
        }),
      ).rejects.toThrow();
    }
    await expect(
      importer.mutation(api.seedPublication.stage, {
        runId: lease.runId,
        target: "fixture",
        generation: lease.generation + 1,
        items: stageItems,
      }),
    ).rejects.toThrow("SEED_LEASE_LOST");
    await t.run((ctx) =>
      ctx.db.patch("seedPublicationRuns", lease.runId, { leaseUntil: 0 }),
    );
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: stageItems,
      }),
    ).rejects.toThrow("SEED_LEASE_LOST");
  });

  it("rejects unapproved, disabled and mismatched seed targets before writes", async () => {
    const { t, importer, importRunId } = await setup();
    for (const target of ["prod", "https://fixture.convex.cloud"]) {
      await expect(
        importer.mutation(api.seedPublication.begin, {
          target,
          importRunId,
          planChecksum,
          inventoryHash,
        }),
      ).rejects.toThrow("SEED_TARGET_DISABLED");
    }
    vi.stubEnv("SEED_PUBLICATION_ENABLED", "false");
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_TARGET_DISABLED",
    );
    vi.stubEnv("SEED_PUBLICATION_ENABLED", "true");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://production.convex.cloud");
    await expect(begin(importer, importRunId)).rejects.toThrow(
      "SEED_TARGET_DISABLED",
    );
    expect(
      await t.run((ctx) => ctx.db.query("seedPublicationRuns").collect()),
    ).toHaveLength(0);
  });

  it("requires ordered staging and rejects changed, duplicate or non-draft pins", async () => {
    const { t, importer, importRunId } = await setup();
    const lease = await begin(importer, importRunId);
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: [{ ordinal: 1, importOrdinal: 2 }],
      }),
    ).rejects.toThrow("SEED_ORDER");
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: [{ ordinal: 0, importOrdinal: 0 }],
      }),
    ).rejects.toThrow("SEED_IMPORT_MISMATCH");
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: Array.from({ length: 51 }, (_, ordinal) => ({
          ordinal,
          importOrdinal: 2,
        })),
      }),
    ).rejects.toThrow("SEED_BATCH_LIMIT");
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: [
          { ordinal: 0, importOrdinal: 2 },
          { ordinal: 1, importOrdinal: 2 },
        ],
      }),
    ).rejects.toThrow("SEED_DUPLICATE_ITEM");
    await stageThrough(importer, lease.runId, lease.generation);
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: [{ ordinal: 0, importOrdinal: 3 }],
      }),
    ).rejects.toThrow("SEED_NOT_PREPARING");
    await expect(
      importer.mutation(api.seedPublication.stage, {
        ...lease,
        target: "fixture",
        items: [{ ordinal: 4, importOrdinal: 2 }],
      }),
    ).rejects.toThrow("SEED_NOT_PREPARING");
    // A variant of this fixture proves the draft/creator policy separately.
    const other = await setup();
    await other.t.run(async (ctx) => {
      await ctx.db.patch(
        "questionVersions",
        other.versions[0].questionVersionId,
        { state: "pending_review" },
      );
    });
    const otherLease = await begin(other.importer, other.importRunId);
    await expect(
      other.importer.mutation(api.seedPublication.stage, {
        ...otherLease,
        target: "fixture",
        items: [stageItems[0]],
      }),
    ).rejects.toThrow("SEED_ITEM_UNAVAILABLE");
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("questionVersions")
          .withIndex("by_state", (q) => q.eq("state", "published"))
          .take(10),
      ),
    ).toHaveLength(0);
  });

  it("requires staged, submitted and approved order before each phase", async () => {
    const { importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await expect(
      submitAll(importer, lease.runId, lease.generation, versions),
    ).rejects.toThrow("SEED_NOT_RUNNING");
    await stageThrough(importer, lease.runId, lease.generation);
    await expect(
      approveAll(approver, lease.runId, lease.generation, versions),
    ).rejects.toThrow("SEED_APPROVAL_ORDER");
    await importer.mutation(api.seedPublication.submit, {
      runId: lease.runId,
      target: "fixture",
      generation: lease.generation,
      questionVersionIds: [versions[0].questionVersionId],
    });
    await expect(
      approveAll(approver, lease.runId, lease.generation, versions),
    ).rejects.toThrow("SEED_APPROVAL_ORDER");
    await submitAll(importer, lease.runId, lease.generation, versions);
    await expect(
      publishAll(approver, lease.runId, lease.generation, versions),
    ).rejects.toThrow("SEED_APPROVAL_ORDER");
    await approveAll(approver, lease.runId, lease.generation, versions);
    // Replayed phases are idempotent; oversized batches are rejected outright.
    await expect(
      importer.mutation(api.seedPublication.submit, {
        ...lease,
        target: "fixture",
        questionVersionIds: versions.map((v) => v.questionVersionId),
      }),
    ).resolves.toBeNull();
    await expect(
      approver.mutation(api.seedPublication.approve, {
        ...lease,
        target: "fixture",
        questionVersionIds: Array.from(
          { length: 11 },
          () => versions[0].questionVersionId,
        ),
      }),
    ).rejects.toThrow("SEED_BATCH_LIMIT");
  });

  it("blocks rollback until paused and never hard-deletes content", async () => {
    const { t, importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await stageThrough(importer, lease.runId, lease.generation);
    await expect(
      importer.mutation(api.seedPublication.rollbackBatch, {
        target: "fixture",
        runId: lease.runId,
        questionVersionIds: [versions[0].questionVersionId],
        reason: "incident",
      }),
    ).rejects.toThrow("SEED_NOT_PAUSED");
    await approver.mutation(api.seedPublication.pause, {
      target: "fixture",
      runId: lease.runId,
      code: "SEED_OPERATION_FAILED",
    });
    await expect(
      importer.mutation(api.seedPublication.rollbackBatch, {
        target: "fixture",
        runId: lease.runId,
        questionVersionIds: versions.map((v) => v.questionVersionId),
        reason: " ",
      }),
    ).rejects.toThrow("SEED_INVALID_STATE");
    await importer.mutation(api.seedPublication.rollbackBatch, {
      target: "fixture",
      runId: lease.runId,
      questionVersionIds: versions.slice(0, 2).map((v) => v.questionVersionId),
      reason: "incident",
    });
    const partial = await importer.query(api.seedPublication.status, {
      target: "fixture",
      runId: lease.runId,
      after: -1,
    });
    expect(partial.run).toMatchObject({ state: "paused", rolledBack: 2 });
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash,
        resumeRunId: lease.runId,
      }),
    ).rejects.toThrow("SEED_ALREADY_ROLLED_BACK");
    await importer.mutation(api.seedPublication.rollbackBatch, {
      target: "fixture",
      runId: lease.runId,
      questionVersionIds: versions.slice(2).map((v) => v.questionVersionId),
      reason: "incident",
    });
    expect(
      await t.run((ctx) => ctx.db.query("questions").collect()),
    ).toHaveLength(4);
    expect(
      await t.run((ctx) => ctx.db.query("questionVersions").collect()),
    ).toHaveLength(4);
    expect(
      await t.run((ctx) => ctx.db.query("questionReviews").collect()),
    ).toHaveLength(0);
  });

  it("keeps a completed begin idempotent and refuses a second plan", async () => {
    const { t, importer, approver, importRunId, versions } = await setup();
    const lease = await begin(importer, importRunId);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash,
        resumeRunId: lease.runId,
      }),
    ).rejects.toThrow("SEED_BUSY");
    await stageThrough(importer, lease.runId, lease.generation);
    await submitAll(importer, lease.runId, lease.generation, versions);
    await approveAll(approver, lease.runId, lease.generation, versions);
    await publishAll(approver, lease.runId, lease.generation, versions);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash,
        resumeRunId: lease.runId,
      }),
    ).resolves.toEqual(lease);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum,
        inventoryHash,
      }),
    ).resolves.toEqual(lease);
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum: "d".repeat(64),
        inventoryHash,
      }),
    ).rejects.toThrow("SEED_PLAN_MISMATCH");
    // The target remains a one-time bootstrap even after completion.
    const alternate = "d".repeat(64);
    vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", alternate);
    await t.run((ctx) =>
      ctx.db.patch("questionImportRuns", importRunId, {
        planChecksum: alternate,
      }),
    );
    await expect(
      importer.mutation(api.seedPublication.begin, {
        target: "fixture",
        importRunId,
        planChecksum: alternate,
        inventoryHash,
      }),
    ).rejects.toThrow("SEED_PLAN_MISMATCH");
  });
});

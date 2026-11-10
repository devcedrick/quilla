import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySeedPublication,
  pauseSeedPublication,
  questionPins,
  readSeedStatus,
  rollbackSeedPublication,
  seedBatches,
  seedClient,
  seedErrorCode,
  stageRequests,
  transitionRequests,
  verifySeedPlan,
  parseSeedArgs,
} from "./publish-seed-question-bank.mjs";

const policy = {
  families: 2,
  perFamilyQuestions: 2,
  expectedQuestions: 4,
  expectedReferences: 1,
  expectedAssets: 1,
};
const planChecksum = "a".repeat(64);
const inventoryHash = "b".repeat(64);
const plan = {
  manifests: [
    { family: 1, questions: 2, references: 1, assets: 0 },
    { family: 2, questions: 2, references: 0, assets: 1 },
  ],
  planChecksum,
  inventoryHash,
  report: {
    counts: { questions: 4, references: 1, assets: 1 },
  },
};
const importEntries = [
  { ordinal: 0, kind: "reference", family: 1, state: "done" },
  { ordinal: 1, kind: "question", family: 1, state: "done" },
  { ordinal: 2, kind: "question", family: 1, state: "done" },
  { ordinal: 3, kind: "asset", family: 2, state: "done" },
  { ordinal: 4, kind: "question", family: 2, state: "done" },
  { ordinal: 5, kind: "question", family: 2, state: "done" },
];

/** Create a minimal in-memory seed backend with bounded status pages. */
function fakeSeed({ denyApprove = false, pageSize = 2 } = {}) {
  const run = {
    _id: "seed-run",
    target: "fixture",
    planChecksum,
    inventoryHash,
    expected: 4,
    staged: 0,
    submitted: 0,
    approved: 0,
    published: 0,
    rolledBack: 0,
    state: "preparing",
    generation: 1,
    leaseUntil: Date.now() + 60_000,
    stagedCounts: [
      { family: 1, questions: 0 },
      { family: 2, questions: 0 },
    ],
  };
  const items = [];
  const calls = [];
  const mutation = vi.fn(async (name, args) => {
    calls.push(name);
    if (name === "begin") return { runId: run._id, generation: run.generation };
    if (name === "stage") {
      for (const pin of args.items) {
        if (pin.ordinal !== run.staged) throw new Error("SEED_ORDER");
        const entry = importEntries.find(
          (value) => value.ordinal === pin.importOrdinal,
        );
        if (!entry || entry.kind !== "question")
          throw new Error("SEED_IMPORT_MISMATCH");
        items.push({
          ordinal: run.staged,
          importOrdinal: entry.ordinal,
          questionVersionId: `v${run.staged}`,
          state: "staged",
        });
        run.staged++;
        run.stagedCounts.find((count) => count.family === entry.family)
          .questions++;
      }
      if (run.staged === run.expected) run.state = "running";
      return null;
    }
    if (name === "submit") {
      for (const id of args.questionVersionIds) {
        const item = items.find((value) => value.questionVersionId === id);
        if (!item || item.state !== "staged")
          throw new Error("SEED_ITEM_UNAVAILABLE");
        item.state = "submitted";
        run.submitted++;
      }
      return null;
    }
    if (name === "approve") {
      if (denyApprove) throw new Error("SEED_APPROVAL_REQUIRED");
      for (const id of args.questionVersionIds) {
        const item = items.find((value) => value.questionVersionId === id);
        if (!item || item.state !== "submitted")
          throw new Error("SEED_APPROVAL_REQUIRED");
        item.state = "approved";
        item.approvalId = `review-${item.ordinal}`;
        run.approved++;
      }
      return null;
    }
    if (name === "publish") {
      for (const id of args.questionVersionIds) {
        const item = items.find((value) => value.questionVersionId === id);
        if (!item || item.state !== "approved")
          throw new Error("SEED_APPROVAL_REQUIRED");
        item.state = "published";
        run.published++;
      }
      if (run.published === run.expected) run.state = "complete";
      return null;
    }
    if (name === "pause") {
      run.state = "paused";
      return null;
    }
    if (name === "rollbackBatch") {
      for (const id of args.questionVersionIds) {
        const item = items.find((value) => value.questionVersionId === id);
        if (!item || item.state === "rolled_back") continue;
        item.state = "rolled_back";
        run.rolledBack++;
      }
      run.state = run.rolledBack === run.expected ? "rolled_back" : "paused";
      return null;
    }
    throw new Error("UNEXPECTED_MUTATION");
  });
  const query = vi.fn(async (name, args) => {
    if (name !== "status") throw new Error("UNEXPECTED_QUERY");
    return {
      run: { ...run },
      items: items
        .filter((item) => item.ordinal > args.after)
        .slice(0, pageSize),
    };
  });
  const importQuery = vi.fn(async (name) => {
    if (name !== "status") throw new Error("UNEXPECTED_QUERY");
    return {
      run: {
        state: "complete",
        planChecksum,
        inventoryHash,
        staged: importEntries.length,
        expected: importEntries.length,
      },
      entries: importEntries,
    };
  });
  return { query, mutation, importQuery, run, items, calls };
}

beforeEach(() => {
  vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", planChecksum);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("seed publication planning", () => {
  it("accepts only the exact frozen corpus shape", () => {
    expect(verifySeedPlan(plan, policy)).toEqual({
      families: 2,
      questions: 4,
      references: 1,
      assets: 1,
    });
    for (const mutate of [
      (value) => value.manifests.pop(),
      (value) => (value.manifests[0].questions = 3),
      (value) => (value.report.counts.questions = 3),
      (value) => (value.report.counts.references = 0),
      (value) => (value.manifests[1].assets = 0),
    ]) {
      const changed = structuredClone(plan);
      mutate(changed);
      expect(() => verifySeedPlan(changed, policy)).toThrow(
        "SEED_POLICY_MISMATCH",
      );
    }
  });

  it("derives ordered pins and rejects missing, unfinished or unbalanced questions", () => {
    expect(questionPins(importEntries, policy)).toEqual([
      { ordinal: 0, importOrdinal: 1, family: 1 },
      { ordinal: 1, importOrdinal: 2, family: 1 },
      { ordinal: 2, importOrdinal: 4, family: 2 },
      { ordinal: 3, importOrdinal: 5, family: 2 },
    ]);
    expect(() => questionPins(importEntries.slice(0, 5), policy)).toThrow(
      "SEED_POLICY_MISMATCH",
    );
    expect(() =>
      questionPins(
        importEntries.map((entry) =>
          entry.ordinal === 1 ? { ...entry, family: 2 } : entry,
        ),
        policy,
      ),
    ).toThrow("SEED_POLICY_MISMATCH");
    expect(() =>
      questionPins(
        importEntries.map((entry) =>
          entry.ordinal === 1 ? { ...entry, state: "pending" } : entry,
        ),
        policy,
      ),
    ).toThrow("SEED_IMPORT_MISMATCH");
  });

  it("resumes staging at the durable ordinal and bounds every phase", () => {
    const pins = questionPins(importEntries, policy);
    expect(stageRequests(pins, 0)).toEqual([
      [
        { ordinal: 0, importOrdinal: 1 },
        { ordinal: 1, importOrdinal: 2 },
        { ordinal: 2, importOrdinal: 4 },
        { ordinal: 3, importOrdinal: 5 },
      ],
    ]);
    expect(stageRequests(pins, 2)).toEqual([
      [
        { ordinal: 2, importOrdinal: 4 },
        { ordinal: 3, importOrdinal: 5 },
      ],
    ]);
    expect(() => stageRequests(pins, 5)).toThrow("SEED_INVALID_CHECKPOINT");
    expect(seedBatches([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(() => seedBatches([], 0)).toThrow("SEED_INVALID_ARGUMENTS");
    const items = [
      { ordinal: 2, state: "staged", questionVersionId: "c" },
      { ordinal: 0, state: "staged", questionVersionId: "a" },
      { ordinal: 1, state: "submitted", questionVersionId: "b" },
    ];
    expect(transitionRequests(items, "staged", 1)).toEqual([["a"], ["c"]]);
  });
});

describe("seed publication client and status", () => {
  it("refuses unapproved targets and missing credentials", () => {
    expect(() => seedClient("fixture", "secret")).toThrow(
      "SEED_TARGET_DISABLED",
    );
    expect(() => seedClient("prod", "secret")).toThrow("SEED_TARGET_DISABLED");
    expect(seedErrorCode(new Error("Bearer super-secret-token"))).toBe(
      "SEED_OPERATION_FAILED",
    );
    expect(seedErrorCode({ data: { code: "SEED_LEASE_LOST" } })).toBe(
      "SEED_LEASE_LOST",
    );
  });

  it("reads every bounded status page and rejects nonadvancing checkpoints", async () => {
    const fake = fakeSeed();
    await expect(
      readSeedStatus(fake, "fixture", "seed-run"),
    ).resolves.toMatchObject({ run: { staged: 0 }, items: [] });
    await fake.mutation("stage", {
      items: [
        { ordinal: 0, importOrdinal: 1 },
        { ordinal: 1, importOrdinal: 2 },
        { ordinal: 2, importOrdinal: 4 },
      ],
    });
    const status = await readSeedStatus(fake, "fixture", "seed-run");
    expect(status.run.staged).toBe(3);
    expect(status.items.map((item) => item.ordinal)).toEqual([0, 1, 2]);
    fake.query.mockResolvedValue({
      run: { staged: 3 },
      items: [{ ordinal: 0 }],
    });
    await expect(readSeedStatus(fake, "fixture", "seed-run")).rejects.toThrow(
      "SEED_INVALID_CHECKPOINT",
    );
  });
});

describe("seed publication orchestration", () => {
  it("stages, submits, independently accepts and publishes the exact plan", async () => {
    const shared = fakeSeed();
    const result = await applySeedPublication(
      plan,
      {
        target: "fixture",
        expectedPlan: planChecksum,
        importRunId: "import-run",
      },
      { importer: shared, approver: shared },
      policy,
    );
    expect(result).toMatchObject({
      mode: "apply",
      state: "complete",
      questions: 4,
      references: 1,
      assets: 1,
      runId: "seed-run",
      planChecksum,
    });
    expect(shared.run).toMatchObject({
      staged: 4,
      submitted: 4,
      approved: 4,
      published: 4,
      state: "complete",
    });
    expect(shared.items.every((item) => item.state === "published")).toBe(true);
    expect(shared.calls).toEqual([
      "begin",
      "stage",
      "submit",
      "approve",
      "publish",
    ]);
    expect(shared.importQuery).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("Synthetic");
  });

  it("refuses a mismatched env pin, plan or import run before any write", async () => {
    const fake = fakeSeed();
    for (const [expectedPlan, importRunId, env] of [
      ["c".repeat(64), "import-run", planChecksum],
      [planChecksum, "import-run", "c".repeat(64)],
    ]) {
      vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", env);
      await expect(
        applySeedPublication(
          plan,
          { target: "fixture", expectedPlan, importRunId },
          { importer: fake, approver: fake },
          policy,
        ),
      ).rejects.toThrow("SEED_PLAN_MISMATCH");
    }
    expect(fake.mutation).not.toHaveBeenCalled();
    vi.stubEnv("SEED_PUBLICATION_PLAN_CHECKSUM", planChecksum);
    const changed = structuredClone(plan);
    changed.report.counts.questions = 3;
    await expect(
      applySeedPublication(
        changed,
        {
          target: "fixture",
          expectedPlan: planChecksum,
          importRunId: "import-run",
        },
        { importer: fake, approver: fake },
        policy,
      ),
    ).rejects.toThrow("SEED_POLICY_MISMATCH");
    expect(fake.mutation).not.toHaveBeenCalled();
    fake.importQuery.mockResolvedValueOnce({
      run: {
        state: "complete",
        planChecksum: "d".repeat(64),
        inventoryHash,
        staged: importEntries.length,
      },
      entries: importEntries,
    });
    await expect(
      applySeedPublication(
        plan,
        {
          target: "fixture",
          expectedPlan: planChecksum,
          importRunId: "import-run",
        },
        { importer: fake, approver: fake },
        policy,
      ),
    ).rejects.toThrow("SEED_IMPORT_MISMATCH");
    expect(fake.run.state).toBe("paused");
  });

  it("is idempotent for a completed run and pauses after an approval failure", async () => {
    const fake = fakeSeed();
    await applySeedPublication(
      plan,
      {
        target: "fixture",
        expectedPlan: planChecksum,
        importRunId: "import-run",
      },
      { importer: fake, approver: fake },
      policy,
    );
    fake.calls.length = 0;
    await expect(
      applySeedPublication(
        plan,
        {
          target: "fixture",
          expectedPlan: planChecksum,
          importRunId: "import-run",
        },
        { importer: fake, approver: fake },
        policy,
      ),
    ).resolves.toMatchObject({ state: "complete" });
    expect(fake.calls).toEqual(["begin"]);

    const denied = fakeSeed({ denyApprove: true });
    let caught;
    try {
      await applySeedPublication(
        plan,
        {
          target: "fixture",
          expectedPlan: planChecksum,
          importRunId: "import-run",
        },
        { importer: denied, approver: denied },
        policy,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught.message).toBe("SEED_APPROVAL_REQUIRED");
    expect(caught.seedRecovery).toEqual({
      target: "fixture",
      runId: "seed-run",
      planChecksum,
      importRunId: "import-run",
    });
    expect(denied.run.state).toBe("paused");
    expect(denied.calls.at(-1)).toBe("pause");
  });

  it("pauses and archives every version on rollback without deleting history", async () => {
    const fake = fakeSeed();
    await applySeedPublication(
      plan,
      {
        target: "fixture",
        expectedPlan: planChecksum,
        importRunId: "import-run",
      },
      { importer: fake, approver: fake },
      policy,
    );
    await expect(
      rollbackSeedPublication(
        fake,
        "fixture",
        "seed-run",
        "Rehearsal rollback",
      ),
    ).resolves.toMatchObject({
      mode: "rollback",
      state: "rolled_back",
      rolledBack: 4,
    });
    expect(fake.items.every((item) => item.state === "rolled_back")).toBe(true);
    expect(fake.items).toHaveLength(4);
    await expect(
      rollbackSeedPublication(fake, "fixture", "seed-run", "retry"),
    ).resolves.toMatchObject({ rolledBack: 4 });
    await expect(
      rollbackSeedPublication(fake, "fixture", "seed-run", " "),
    ).rejects.toThrow("SEED_INVALID_ARGUMENTS");
    const partial = fakeSeed();
    await partial.mutation("stage", {
      items: [
        { ordinal: 0, importOrdinal: 1 },
        { ordinal: 1, importOrdinal: 2 },
      ],
    });
    await expect(
      pauseSeedPublication(partial, "fixture", "seed-run"),
    ).resolves.toMatchObject({ run: { state: "paused", staged: 2 } });
  });
});

describe("seed publication arguments", () => {
  it("requires explicit mode, target, plan and run identities", () => {
    expect(parseSeedArgs([])).toEqual({});
    expect(parseSeedArgs(["--json"])).toEqual({ "--json": true });
    expect(
      parseSeedArgs([
        "--apply",
        "--target",
        "dev",
        "--expect-plan",
        planChecksum,
        "--import-run",
        "import-run",
      ]),
    ).toMatchObject({ "--apply": true });
    expect(
      parseSeedArgs(["--status", "--target", "dev", "--run", "seed-run"]),
    ).toMatchObject({ "--status": true });
    expect(
      parseSeedArgs([
        "--rollback",
        "--target",
        "dev",
        "--run",
        "seed-run",
        "--reason",
        "incident",
      ]),
    ).toMatchObject({ "--rollback": true });
    for (const args of [
      ["--apply"],
      ["--apply", "--target", "dev"],
      ["--target", "dev"],
      ["--status", "--target", "dev"],
      ["--status", "--target", "dev", "--run", "seed-run", "--json", "--json"],
      ["--rollback", "--target", "dev", "--run", "seed-run"],
      ["--apply", "--status", "--target", "dev", "--run", "seed-run"],
      ["--status", "--target", "dev", "--run", "seed-run", "--reason", "x"],
      ["--force"],
    ])
      expect(() => parseSeedArgs(args)).toThrow("SEED_INVALID_ARGUMENTS");
  });
});

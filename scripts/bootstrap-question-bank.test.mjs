import path from "node:path";
import os from "node:os";
import { describe, it, expect, vi } from "vitest";
import {
  applyBootstrap,
  bootstrapErrorCode,
  bootstrapSummary,
  commandBatches,
  isTransientBootstrapError,
  parseBootstrapArgs,
  readBootstrapRun,
  readBootstrapStatus,
  requiresDeployment,
  rollbackBootstrap,
  runConvex,
  selectDeployment,
  verifyBootstrapPlan,
  verifyFrozenBootstrapPlan,
} from "./bootstrap-question-bank.mjs";

const policy = {
  families: 2,
  perFamilyQuestions: 2,
  expectedQuestions: 4,
  expectedReferences: 1,
  expectedAssets: 1,
};
const planChecksum = "a".repeat(64);
const inventoryHash = "b".repeat(64);

/** Build one deterministic six-record initial-corpus fixture without real content. */
function fixturePlan() {
  let ordinal = 0;
  const item = (kind, sourceId, family, value) => ({
    descriptor: {
      ordinal: ordinal++,
      kind,
      sourceId,
      version: kind === "asset" ? 0 : 1,
      family,
      sourceChecksum: "c".repeat(64),
    },
    source: { kind, value },
    ...(kind === "asset" ? { bytes: Uint8Array.from([1, 2, 3]) } : {}),
  });
  return {
    manifests: [
      {
        corpusId: "fixture-1",
        revision: 1,
        checksum: "d".repeat(64),
        family: 1,
        questions: 2,
        references: 1,
        assets: 1,
      },
      {
        corpusId: "fixture-2",
        revision: 1,
        checksum: "e".repeat(64),
        family: 2,
        questions: 2,
        references: 0,
        assets: 0,
      },
    ],
    inventoryHash,
    planChecksum,
    items: [
      item("asset", "img-1", 1, {
        assetId: "img-1",
        mediaType: "image/png",
      }),
      item("reference", "ref-1", 1, { referenceId: "ref-1", version: 1 }),
      item("question", "q-1", 1, { questionId: "q-1", version: 1 }),
      item("question", "q-2", 1, { questionId: "q-2", version: 1 }),
      item("question", "q-3", 2, { questionId: "q-3", version: 1 }),
      item("question", "q-4", 2, { questionId: "q-4", version: 1 }),
    ],
    report: { counts: { questions: 4, references: 1, assets: 1 } },
  };
}

/** Simulate the durable server checkpoint and fenced write path. */
function transportPlan(plan, options = {}) {
  const run = {
    _id: "run-1",
    target: "fixture",
    planChecksum: plan.planChecksum,
    state: "preparing",
    staged: 0,
    processed: 0,
    expected: plan.items.length,
    generation: 1,
    rolledBack: 0,
  };
  const done = new Set();
  const verifiedAssets = new Set();
  let preflightConflict = options.preflightConflict ?? false;
  let leaseFailures = options.leaseFailures ?? 0;
  let transientFailures = options.transientFailures ?? 0;
  let rollbackRounds = options.rollbackRounds ?? 2;
  const calls = [];
  const snapshot = () => ({ ...run });
  return {
    run,
    calls,
    client: {
      query: vi.fn(async (name, args) => {
        expect(args.target).toBe("fixture");
        calls.push(["query", name, args]);
        if (name === "status") {
          if (args.after === Number.MAX_SAFE_INTEGER)
            return { run: snapshot(), entries: [] };
          return { run: snapshot(), entries: [] };
        }
        if (name === "preflight")
          return args.records.map((record) => ({
            ordinal: record.descriptor.ordinal,
            status: preflightConflict ? "conflict" : "new",
            duplicateCandidates: 0,
            ...(preflightConflict ? { code: "CONTENT_CONFLICT" } : {}),
          }));
        throw new Error(`unexpected query ${name}`);
      }),
      mutation: vi.fn(async (name, args) => {
        expect(args.target).toBe("fixture");
        calls.push(["mutation", name, args]);
        if (name === "begin") {
          if (args.resumeRunId) {
            expect(args.resumeRunId).toBe(run._id);
            run.generation++;
          }
          return { runId: run._id, generation: run.generation };
        }
        if (name === "renew") {
          expect(args.generation).toBe(run.generation);
          return null;
        }
        if (name === "stage") {
          run.staged += args.entries.length;
          if (run.staged === run.expected) run.state = "running";
          return null;
        }
        if (name === "assetUploadUrl")
          return {
            uploadUrl: "https://upload.test/asset",
            expectedRevision: 1,
          };
        if (name === "pause") {
          run.state = "paused";
          return null;
        }
        if (name === "rollbackBatch") {
          rollbackRounds--;
          run.rolledBack++;
          run.state = rollbackRounds > 0 ? "paused" : "rolled_back";
          return null;
        }
        if (name === "applyBatch") {
          if (leaseFailures) {
            leaseFailures--;
            throw Object.assign(new Error("lease"), {
              code: "BOOTSTRAP_LEASE_LOST",
            });
          }
          for (const record of args.records) {
            const ordinal = record.descriptor.ordinal;
            if (done.has(ordinal)) continue;
            expect(ordinal).toBe(run.processed);
            if (record.source.kind === "asset") {
              if (!verifiedAssets.has(ordinal))
                return {
                  processed: run.processed,
                  state: run.state,
                  uploadOrdinal: ordinal,
                  uploadRevision: 1,
                };
            }
            done.add(ordinal);
            run.processed++;
          }
          if (run.processed === run.expected) run.state = "complete";
          if (transientFailures) {
            transientFailures--;
            throw Object.assign(new Error("transport"), { transient: true });
          }
          return { processed: run.processed, state: run.state };
        }
        throw new Error(`unexpected mutation ${name}`);
      }),
      action: vi.fn(async (name, args) => {
        calls.push(["action", name, args]);
        if (name === "verifyAsset") {
          verifiedAssets.add(args.ordinal);
          return null;
        }
        throw new Error(`unexpected action ${name}`);
      }),
    },
  };
}

const uploadResponse = {
  ok: true,
  status: 200,
  json: async () => ({ storageId: "storage-1" }),
};

describe("bootstrap plan policy", () => {
  it("accepts the exact six-record fixture shape", () => {
    expect(verifyBootstrapPlan(fixturePlan(), policy)).toEqual({
      families: 2,
      questions: 4,
      references: 1,
      assets: 1,
    });
  });
  it("rejects a plan whose per-family counts differ from policy", () => {
    const plan = fixturePlan();
    plan.manifests[0].questions = 1;
    expect(() => verifyBootstrapPlan(plan, policy)).toThrow(
      "BOOTSTRAP_POLICY_MISMATCH",
    );
  });
  it("rejects a report that omits images", () => {
    const plan = fixturePlan();
    plan.report.counts.assets = 0;
    expect(() => verifyBootstrapPlan(plan, policy)).toThrow(
      "BOOTSTRAP_POLICY_MISMATCH",
    );
  });
  it("accepts only a plan matching both frozen checksums", () => {
    expect(
      verifyFrozenBootstrapPlan(
        fixturePlan(),
        policy,
        planChecksum,
        inventoryHash,
      ),
    ).toEqual({ families: 2, questions: 4, references: 1, assets: 1 });
    const changed = fixturePlan();
    changed.inventoryHash = "f".repeat(64);
    expect(() =>
      verifyFrozenBootstrapPlan(changed, policy, planChecksum, inventoryHash),
    ).toThrow("BOOTSTRAP_PLAN_MISMATCH");
  });
});

describe("command batches", () => {
  it("splits by count and keeps each JSON payload within the byte limit", () => {
    const values = Array.from({ length: 25 }, (_, index) => ({ index }));
    const batches = commandBatches(values, 16 * 1024, 10);
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5]);
    for (const batch of batches)
      expect(Buffer.byteLength(JSON.stringify(batch))).toBeLessThanOrEqual(
        16 * 1024,
      );
  });
  it("rejects a single oversized record", () => {
    expect(() => commandBatches([{ text: "x".repeat(200) }], 100, 10)).toThrow(
      "BOOTSTRAP_INVALID_ARGUMENTS",
    );
  });
});

describe("operator arguments", () => {
  it("requires an expected plan for apply", () => {
    expect(
      parseBootstrapArgs([
        "--apply",
        "--target",
        "development",
        "--expect-plan",
        planChecksum,
      ]),
    ).toMatchObject({ "--apply": true, "--target": "development" });
    expect(() =>
      parseBootstrapArgs(["--apply", "--target", "development"]),
    ).toThrow("BOOTSTRAP_INVALID_ARGUMENTS");
  });
  it("requires a rollback reason and a status run id", () => {
    expect(() =>
      parseBootstrapArgs([
        "--rollback",
        "--target",
        "development",
        "--run",
        "run-1",
      ]),
    ).toThrow("BOOTSTRAP_INVALID_ARGUMENTS");
    expect(() =>
      parseBootstrapArgs(["--status", "--target", "development"]),
    ).toThrow("BOOTSTRAP_INVALID_ARGUMENTS");
  });
  it("requires explicit production confirmation", () => {
    expect(() => parseBootstrapArgs(["--status", "--prod"])).toThrow(
      "BOOTSTRAP_INVALID_ARGUMENTS",
    );
    expect(() =>
      parseBootstrapArgs([
        "--status",
        "--deployment",
        "prod",
        "--target",
        "production",
        "--run",
        "run-1",
      ]),
    ).toThrow("BOOTSTRAP_INVALID_ARGUMENTS");
    expect(
      parseBootstrapArgs([
        "--status",
        "--prod",
        "--confirm-production",
        "--target",
        "production",
        "--run",
        "run-1",
      ]),
    ).toMatchObject({ "--prod": true, "--confirm-production": true });
  });
  it("rejects unknown, duplicate and mixed-mode flags", () => {
    for (const args of [
      ["--unknown"],
      ["--status", "--status", "--target", "development", "--run", "run-1"],
      ["--status", "--pause", "--target", "development", "--run", "run-1"],
      [
        "--status",
        "--target",
        "development",
        "--run",
        "run-1",
        "--reason",
        "x",
      ],
    ])
      expect(() => parseBootstrapArgs(args)).toThrow(
        "BOOTSTRAP_INVALID_ARGUMENTS",
      );
  });
  it("requires an explicit deployment or deployment key", () => {
    expect(selectDeployment({ "--prod": true }, {})).toEqual(["--prod"]);
    expect(selectDeployment({ "--deployment": "dev-123" }, {})).toEqual([
      "--deployment",
      "dev-123",
    ]);
    expect(selectDeployment({}, { CONVEX_DEPLOY_KEY: "key" })).toEqual([]);
    expect(() => selectDeployment({}, {})).toThrow(
      "BOOTSTRAP_INVALID_ARGUMENTS",
    );
  });
  it("needs no deployment for the offline dry run", () => {
    expect(requiresDeployment({})).toBe(false);
    expect(requiresDeployment({ "--json": true })).toBe(false);
    for (const mode of ["--apply", "--status", "--pause", "--rollback"])
      expect(requiresDeployment({ [mode]: true })).toBe(true);
  });
});

describe("operator summary", () => {
  it("reports pause and rollback without claiming zero questions", () => {
    const paused = bootstrapSummary({
      mode: "pause",
      runId: "run-1",
      state: "paused",
    });
    expect(paused).toContain("pause: bootstrap run run-1 is paused");
    expect(paused).not.toContain("0 questions");
    const rolledBack = bootstrapSummary({
      mode: "rollback",
      runId: "run-1",
      state: "rolled_back",
      rolledBack: 1890,
    });
    expect(rolledBack).toContain("1890 bootstrap-published versions archived");
    expect(rolledBack).not.toContain("0 questions");
  });
});

describe("convex transport", () => {
  it("extracts the JSON result from CLI output", () => {
    const spawn = vi.fn(() => ({
      status: 0,
      stdout: 'Uploading functions...\n{"runId":"run-1"}\n',
      stderr: "",
    }));
    expect(
      runConvex(
        "seedBootstrap:begin",
        { target: "development" },
        { "--deployment": "development" },
        { spawn },
      ),
    ).toEqual({ runId: "run-1" });
    expect(spawn.mock.calls[0][0]).toBe(process.execPath);
    expect(spawn.mock.calls[0][1][0]).toMatch(
      /node_modules[\\/]convex[\\/]bin[\\/]main\.js$/,
    );
    expect(spawn.mock.calls[0][1][1]).toBe("run");
    expect(spawn.mock.calls[0][1]).toContain("seedBootstrap:begin");
    expect(spawn.mock.calls[0][1]).toContain("--deployment");
    expect(spawn.mock.calls[0][1]).toContain("--typecheck");
    expect(spawn.mock.calls[0][1]).toContain("disable");
  });
  it("maps known failures to safe codes and unknown failures to transient", () => {
    const failed = (stderr) => ({
      status: 1,
      stdout: "",
      stderr,
    });
    const known = () =>
      runConvex(
        "seedBootstrap:begin",
        {},
        { "--deployment": "development" },
        {
          spawn: () => failed("Error: BOOTSTRAP_BUSY"),
        },
      );
    expect(known).toThrow("BOOTSTRAP_BUSY");
    const unknown = () =>
      runConvex(
        "seedBootstrap:begin",
        {},
        { "--deployment": "development" },
        {
          spawn: () => failed("socket hang up"),
        },
      );
    try {
      unknown();
    } catch (error) {
      expect(error.code).toBe("BOOTSTRAP_OPERATION_FAILED");
      expect(isTransientBootstrapError(error)).toBe(true);
    }
  });
});

describe("apply bootstrap", () => {
  it("stages once and publishes records batch by batch", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan);
    const result = await applyBootstrap(
      plan,
      { "--expect-plan": plan.planChecksum, "--target": "fixture" },
      client,
      {
        checkpoint: null,
        fetchImpl: async () => uploadResponse,
        policy,
        expectedPlanChecksum: plan.planChecksum,
        sleep: async () => {},
      },
    );
    expect(result).toMatchObject({ mode: "apply", state: "complete" });
    expect(run).toMatchObject({
      staged: 6,
      processed: 6,
      state: "complete",
    });
    expect(
      calls.filter(([kind, name]) => kind === "mutation" && name === "stage"),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([kind, name]) => kind === "action" && name === "verifyAsset",
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        ([kind, name]) => kind === "mutation" && name === "applyBatch",
      ),
    ).toHaveLength(3);
  });
  it("retries a lost response without applying a record twice", async () => {
    const plan = fixturePlan();
    const { client, run } = transportPlan(plan, { transientFailures: 1 });
    const result = await applyBootstrap(
      plan,
      { "--expect-plan": plan.planChecksum, "--target": "fixture" },
      client,
      {
        checkpoint: null,
        fetchImpl: async () => uploadResponse,
        policy,
        expectedPlanChecksum: plan.planChecksum,
        sleep: async () => {},
      },
    );
    expect(result.state).toBe("complete");
    expect(run.processed).toBe(6);
  });
  it("reacquires an expired lease and replays the fenced step", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan, { leaseFailures: 1 });
    const result = await applyBootstrap(
      plan,
      { "--expect-plan": plan.planChecksum, "--target": "fixture" },
      client,
      {
        checkpoint: null,
        fetchImpl: async () => uploadResponse,
        policy,
        expectedPlanChecksum: plan.planChecksum,
        sleep: async () => {},
      },
    );
    expect(result.state).toBe("complete");
    expect(run.processed).toBe(6);
    expect(
      calls.filter(([kind, name]) => kind === "mutation" && name === "begin"),
    ).toHaveLength(2);
  });
  it("pauses without writes when preflight finds a conflict", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan, {
      preflightConflict: true,
    });
    await expect(
      applyBootstrap(
        plan,
        { "--expect-plan": plan.planChecksum, "--target": "fixture" },
        client,
        {
          checkpoint: null,
          fetchImpl: async () => uploadResponse,
          policy,
          expectedPlanChecksum: plan.planChecksum,
          sleep: async () => {},
        },
      ),
    ).rejects.toMatchObject({
      code: "BOOTSTRAP_TARGET_CONFLICT",
    });
    expect(run.staged).toBe(0);
    expect(run.state).toBe("paused");
    expect(
      calls.filter(
        ([kind, name]) => kind === "mutation" && name === "applyBatch",
      ),
    ).toHaveLength(0);
  });
  it("renews the fenced lease during a long run", async () => {
    const plan = fixturePlan();
    const base = transportPlan(plan);
    let clock = 0;
    const advance = (result) => {
      clock += 60_000;
      return result;
    };
    const client = {
      query: (...args) => advance(base.client.query(...args)),
      mutation: (...args) => advance(base.client.mutation(...args)),
      action: (...args) => advance(base.client.action(...args)),
    };
    const result = await applyBootstrap(
      plan,
      { "--expect-plan": plan.planChecksum, "--target": "fixture" },
      client,
      {
        checkpoint: null,
        fetchImpl: async () => uploadResponse,
        policy,
        expectedPlanChecksum: plan.planChecksum,
        sleep: async () => {},
        now: () => clock,
      },
    );
    expect(result.state).toBe("complete");
    expect(base.run.processed).toBe(6);
    expect(
      base.calls.filter(
        ([kind, name]) => kind === "mutation" && name === "renew",
      ).length,
    ).toBeGreaterThan(0);
  });
  it("rejects a plan that differs from the reviewed checksum", async () => {
    const plan = fixturePlan();
    const { client } = transportPlan(plan);
    await expect(
      applyBootstrap(
        plan,
        { "--expect-plan": plan.planChecksum, "--target": "fixture" },
        client,
        {
          checkpoint: null,
          policy,
          expectedPlanChecksum: "f".repeat(64),
          sleep: async () => {},
        },
      ),
    ).rejects.toMatchObject({ code: "BOOTSTRAP_PLAN_MISMATCH" });
  });
  it("pauses and reports the run when the initial checkpoint cannot be written", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan);
    const checkpoint = path.join(
      os.tmpdir(),
      `quilla-missing-${process.pid}-${Date.now()}`,
      "checkpoint.json",
    );
    await expect(
      applyBootstrap(
        plan,
        { "--expect-plan": plan.planChecksum, "--target": "fixture" },
        client,
        {
          checkpoint,
          policy,
          expectedPlanChecksum: plan.planChecksum,
          sleep: async () => {},
        },
      ),
    ).rejects.toMatchObject({
      code: "BOOTSTRAP_OPERATION_FAILED",
      recovery: { runId: "run-1" },
    });
    expect(run.state).toBe("paused");
    expect(
      calls.some(([kind, name]) => kind === "mutation" && name === "pause"),
    ).toBe(true);
  });
});

describe("status and rollback", () => {
  it("reads the run header without paging entries", async () => {
    const client = {
      query: vi.fn(async (name, args) => {
        expect(name).toBe("status");
        expect(args.after).toBe(Number.MAX_SAFE_INTEGER);
        return { run: { _id: "run-1", expected: 1, staged: 1 }, entries: [] };
      }),
    };
    await expect(
      readBootstrapRun(client, "fixture", "run-1"),
    ).resolves.toMatchObject({ _id: "run-1" });
  });
  it("pages the full status and rejects an inconsistent entry count", async () => {
    const run = { staged: 2 };
    const client = {
      query: vi.fn(async (name, args) =>
        args.after < 0
          ? { run, entries: [{ ordinal: 0 }, { ordinal: 1 }] }
          : { run, entries: [] },
      ),
    };
    await expect(
      readBootstrapStatus(client, "fixture", "run-1"),
    ).resolves.toEqual({
      run,
      entries: [{ ordinal: 0 }, { ordinal: 1 }],
    });
    const broken = {
      query: vi.fn(async () => ({ run, entries: [{ ordinal: 0 }] })),
    };
    await expect(
      readBootstrapStatus(broken, "fixture", "run-1"),
    ).rejects.toMatchObject({ code: "BOOTSTRAP_INVALID_CHECKPOINT" });
  });
  it("pauses a running run and archives until fully rolled back", async () => {
    const state = { value: "running", rolledBack: 0 };
    const client = {
      query: vi.fn(async () => ({
        run: {
          state: state.value,
          rolledBack: state.rolledBack,
          expected: 6,
        },
        entries: [],
      })),
      mutation: vi.fn(async (name) => {
        if (name === "pause") {
          expect(state.value).toBe("running");
          state.value = "paused";
          return null;
        }
        if (name === "rollbackBatch") {
          expect(state.value).toBe("paused");
          state.rolledBack += 2;
          if (state.rolledBack >= 6) state.value = "rolled_back";
          return null;
        }
        throw new Error(name);
      }),
    };
    await expect(
      rollbackBootstrap(client, "fixture", "run-1", "rehearsal reset"),
    ).resolves.toEqual({
      mode: "rollback",
      target: "fixture",
      runId: "run-1",
      state: "rolled_back",
      rolledBack: 6,
      reason: "rehearsal reset",
    });
    expect(client.mutation).toHaveBeenCalledWith("pause", expect.anything());
    expect(
      client.mutation.mock.calls.filter(([name]) => name === "rollbackBatch"),
    ).toHaveLength(3);
  });
  it("sanitizes unknown error codes", () => {
    expect(bootstrapErrorCode(new Error("socket ECONNRESET"))).toBe(
      "BOOTSTRAP_OPERATION_FAILED",
    );
    expect(bootstrapErrorCode({ code: "BOOTSTRAP_BUSY" })).toBe(
      "BOOTSTRAP_BUSY",
    );
  });
});

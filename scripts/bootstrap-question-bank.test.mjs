import path from "node:path";
import os from "node:os";
import { describe, it, expect, vi } from "vitest";
import {
  applyBootstrap,
  blueprintSummary,
  bootstrapErrorCode,
  bootstrapFailureReport,
  bootstrapSummary,
  commandBatches,
  installBlueprints,
  installTaxonomy,
  isTransientBootstrapError,
  parseBootstrapArgs,
  readBootstrapRun,
  readBootstrapStatus,
  requiresDeployment,
  rollbackBootstrap,
  runConvex,
  selectDeployment,
  taxonomySummary,
  verifyBlueprints,
  verifyBootstrapPlan,
  verifyFrozenBootstrapPlan,
  verifyTaxonomy,
} from "./bootstrap-question-bank.mjs";
import {
  approvedImportTargets,
  seedBlueprintPolicy,
  seedTaxonomyPolicy,
} from "../lib/question-import-contract.mjs";

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
    mode: "bootstrap",
    inventoryHash: plan.inventoryHash,
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
  let beginAttempts = 0;
  const calls = [];
  const snapshot = () => ({ ...run });
  return {
    run,
    calls,
    client: {
      query: vi.fn(async (name, args) => {
        expect(args.target).toBe("fixture");
        calls.push(["query", name, args]);
        if (name === "latest")
          return options.latest === false ? null : snapshot();
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
          if (!args.resumeRunId) {
            beginAttempts++;
            if (options.beginLostResponse && beginAttempts === 1)
              throw Object.assign(new Error("transport"), { transient: true });
            if (options.beginLostResponse && beginAttempts > 1)
              throw Object.assign(new Error("busy"), {
                code: "BOOTSTRAP_BUSY",
              });
          }
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
          if (options.pauseFails)
            throw Object.assign(new Error("pause"), {
              code: "BOOTSTRAP_OPERATION_FAILED",
            });
          if (
            args.generation !== undefined &&
            args.generation !== run.generation
          )
            throw Object.assign(new Error("lease"), {
              code: "BOOTSTRAP_LEASE_LOST",
            });
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
          if (options.pauseOnApply) {
            run.state = "paused";
            run.leaseUntil = 0;
            throw Object.assign(new Error("paused"), {
              code: "BOOTSTRAP_PAUSED",
            });
          }
          if (options.applyFailure)
            throw Object.assign(new Error("apply"), {
              code: "VALIDATION_FAILED",
            });
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
  it("defaults to the frozen checksums when the caller omits them", () => {
    // The CLI calls verifyFrozenBootstrapPlan(plan) at line 711. A missing
    // import for either default would throw ReferenceError before the body.
    expect(() => verifyFrozenBootstrapPlan(fixturePlan(), policy)).toThrow(
      "BOOTSTRAP_PLAN_MISMATCH",
    );
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
    for (const mode of [
      "--apply",
      "--status",
      "--pause",
      "--rollback",
      "--install-taxonomy",
      "--verify-taxonomy",
      "--install-blueprints",
      "--verify-blueprints",
    ])
      expect(requiresDeployment({ [mode]: true })).toBe(true);
  });
  it("parses taxonomy installation and verification modes", () => {
    for (const mode of ["--install-taxonomy", "--verify-taxonomy"])
      expect(
        parseBootstrapArgs([
          mode,
          "--target",
          "quilla-dev",
          "--deployment",
          "development",
        ]),
      ).toMatchObject({ [mode]: true, "--target": "quilla-dev" });
    expect(
      parseBootstrapArgs([
        "--install-taxonomy",
        "--prod",
        "--confirm-production",
        "--target",
        "quilla-dev",
      ]),
    ).toMatchObject({ "--install-taxonomy": true, "--prod": true });
    for (const args of [
      ["--install-taxonomy"],
      ["--install-taxonomy", "--verify-taxonomy", "--target", "quilla-dev"],
      [
        "--install-taxonomy",
        "--status",
        "--target",
        "quilla-dev",
        "--run",
        "run-1",
      ],
      [
        "--install-taxonomy",
        "--target",
        "quilla-dev",
        "--expect-plan",
        planChecksum,
      ],
      ["--install-taxonomy", "--target", "quilla-dev", "--run", "run-1"],
      ["--install-taxonomy", "--target", "quilla-dev", "--resume-run", "run-1"],
      [
        "--install-taxonomy",
        "--target",
        "quilla-dev",
        "--checkpoint",
        "checkpoint.json",
      ],
      ["--install-taxonomy", "--target", "quilla-dev", "--reason", "x"],
      ["--install-taxonomy", "--prod", "--target", "quilla-dev"],
      ["--install-taxonomy", "--deployment", "prod", "--target", "quilla-dev"],
    ])
      expect(() => parseBootstrapArgs(args)).toThrow(
        "BOOTSTRAP_INVALID_ARGUMENTS",
      );
  });
  it("parses blueprint installation and verification modes", () => {
    for (const mode of ["--install-blueprints", "--verify-blueprints"])
      expect(
        parseBootstrapArgs([
          mode,
          "--target",
          "quilla-dev",
          "--deployment",
          "development",
        ]),
      ).toMatchObject({ [mode]: true, "--target": "quilla-dev" });
    expect(
      parseBootstrapArgs([
        "--verify-blueprints",
        "--prod",
        "--confirm-production",
        "--target",
        "quilla-dev",
      ]),
    ).toMatchObject({ "--verify-blueprints": true, "--prod": true });
    for (const args of [
      ["--install-blueprints"],
      ["--install-blueprints", "--verify-blueprints", "--target", "quilla-dev"],
      ["--install-blueprints", "--install-taxonomy", "--target", "quilla-dev"],
      [
        "--verify-blueprints",
        "--status",
        "--target",
        "quilla-dev",
        "--run",
        "run-1",
      ],
      [
        "--install-blueprints",
        "--target",
        "quilla-dev",
        "--expect-plan",
        planChecksum,
      ],
      ["--install-blueprints", "--target", "quilla-dev", "--run", "run-1"],
      [
        "--install-blueprints",
        "--target",
        "quilla-dev",
        "--resume-run",
        "run-1",
      ],
      [
        "--install-blueprints",
        "--target",
        "quilla-dev",
        "--checkpoint",
        "checkpoint.json",
      ],
      ["--install-blueprints", "--target", "quilla-dev", "--reason", "x"],
      ["--install-blueprints", "--prod", "--target", "quilla-dev"],
      [
        "--install-blueprints",
        "--deployment",
        "prod",
        "--target",
        "quilla-dev",
      ],
    ])
      expect(() => parseBootstrapArgs(args)).toThrow(
        "BOOTSTRAP_INVALID_ARGUMENTS",
      );
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
  it("reports taxonomy installation with an explicit write boundary", () => {
    const counts = {
      level: 2,
      difficulty: 3,
      language: 2,
      subject: 5,
      subtopic: 9,
      concept: 12,
      total: 33,
    };
    const base = {
      target: "quilla-dev",
      taxonomyId: "cse-taxonomy-2027-v2",
      counts,
      digest: seedTaxonomyPolicy.digest,
    };
    const absent = taxonomySummary({
      ...base,
      mode: "taxonomy-verify",
      present: false,
      expectedDigest: seedTaxonomyPolicy.digest,
      expectedCounts: counts,
    });
    expect(absent).toContain("is not installed");
    expect(absent).toContain("No writes performed.");
    const installed = taxonomySummary({
      ...base,
      mode: "taxonomy-install",
      present: true,
      created: true,
      state: "sealed",
      revision: 2,
    });
    expect(installed).toContain("Installed and sealed atomically");
    expect(installed).toContain("33 (2 levels");
    expect(installed).toContain(
      "No question, reference, or asset writes occurred.",
    );
    const rerun = taxonomySummary({
      ...base,
      mode: "taxonomy-install",
      present: true,
      created: false,
      state: "sealed",
      revision: 2,
    });
    expect(rerun).toContain("Already installed");
    const matched = taxonomySummary({
      ...base,
      mode: "taxonomy-verify",
      present: true,
      state: "sealed",
      revision: 2,
      matchesExpected: true,
    });
    expect(matched).toContain("matches the reviewed sealed catalog");
    expect(matched).toContain("No writes performed.");
    const mismatched = taxonomySummary({
      ...base,
      mode: "taxonomy-verify",
      present: true,
      state: "sealed",
      revision: 2,
      matchesExpected: false,
    });
    expect(mismatched).toContain("does not match the reviewed sealed catalog");
  });
  it("reports blueprint installation, rerun, and verification with the boundary", () => {
    const counts = {
      scoredItems: 150,
      durationMinutes: 168,
      passingScore: 120,
      cells: 15,
      languages: 5,
      concepts: 9,
    };
    const installedLevel = {
      blueprintId: "cse-professional-2027-v3",
      level: "professional",
      blueprintVersionId: "version-1",
      revision: 3,
      state: "active",
      configurationHash: "a".repeat(64),
      counts,
      supersededVersionId: null,
    };
    const installed = blueprintSummary({
      mode: "blueprint-install",
      target: "quilla-dev",
      created: true,
      taxonomyVersionId: "taxonomy-1",
      fixtureDigest: seedBlueprintPolicy.digest,
      levels: [installedLevel],
    });
    expect(installed).toContain(
      "installed and activated 1 approved v3 blueprints",
    );
    expect(installed).toContain("revision 3");
    expect(installed).toContain("150 items/168 min/120 passing");
    expect(installed).toContain("per-level active pointers");
    expect(installed).toContain(
      "No questions, references, assets, taxonomy entries, or attempt snapshots were written.",
    );
    expect(installed).toContain("not content approval");
    const rerun = blueprintSummary({
      mode: "blueprint-install",
      target: "quilla-dev",
      created: false,
      taxonomyVersionId: "taxonomy-1",
      fixtureDigest: seedBlueprintPolicy.digest,
      levels: [installedLevel],
    });
    expect(rerun).toContain("already active");
    expect(rerun).toContain("no writes performed");

    const verifiedLevel = {
      level: "professional",
      expectedBlueprintId: "cse-professional-2027-v3",
      present: true,
      versionIds: ["version-1"],
      duplicateVersions: false,
      state: "active",
      revision: 3,
      active: true,
      sealed: true,
      configurationFormatVersion: 2,
      contentHash: "a".repeat(64),
      hashMatches: true,
      configurationMatches: true,
      taxonomyMatches: true,
      counts,
      expectedCounts: counts,
      pointerVersionId: "version-1",
      pointerConsistent: true,
      systemAttributed: true,
      matchesExpected: true,
    };
    const verified = blueprintSummary({
      mode: "blueprint-verify",
      target: "quilla-dev",
      matchesExpected: true,
      taxonomyId: "cse-taxonomy-2027-v2",
      taxonomyVersionId: "taxonomy-1",
      taxonomyMatchesExpected: true,
      expectedFixtureDigest: seedBlueprintPolicy.digest,
      deployedFixtureDigest: seedBlueprintPolicy.digest,
      fixtureDigestMatches: true,
      levels: [verifiedLevel],
    });
    expect(verified).toContain("match the reviewed v3 fixture");
    expect(verified).toContain("state=active");
    expect(verified).toContain("sealed=true");
    expect(verified).toContain("No writes performed.");
    expect(verified).toContain("not content approval");

    const mismatched = blueprintSummary({
      mode: "blueprint-verify",
      target: "quilla-dev",
      matchesExpected: false,
      taxonomyId: "cse-taxonomy-2027-v2",
      taxonomyVersionId: "taxonomy-1",
      taxonomyMatchesExpected: true,
      expectedFixtureDigest: seedBlueprintPolicy.digest,
      deployedFixtureDigest: "e".repeat(64),
      fixtureDigestMatches: false,
      levels: [
        {
          ...verifiedLevel,
          contentHash: "b".repeat(64),
          sealed: false,
          hashMatches: false,
          matchesExpected: false,
        },
      ],
    });
    expect(mismatched).toContain("do not match the reviewed v3 fixture");
    expect(mismatched).toContain(
      "Deployed fixture digest does not match the pinned digest.",
    );
    expect(mismatched).toContain(
      `Expected fixture digest: ${seedBlueprintPolicy.digest}. Deployed fixture digest: ${"e".repeat(64)}.`,
    );
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
  it("reads every allowlisted deterministic code from the ConvexError payload", () => {
    const failed = (code) => ({
      status: 1,
      stdout: "",
      stderr: `Failed to run function:\nConvexError: ${JSON.stringify({ code, message: `Question operation rejected: ${code}` })}\n`,
    });
    for (const code of [
      "ASSET_NOT_FOUND",
      "INVALID_TRANSITION",
      "INVALID_TAXONOMY_PATH",
      "INVALID_ELIGIBILITY",
      "UNKNOWN_TAXONOMY_ENTRY",
      "SELF_REVIEW",
      "QUESTION_NOT_FOUND",
      "INVALID_AUDIT_DATA",
      "TAXONOMY_CATALOG_MISMATCH",
      "TAXONOMY_VERSION_CONFLICT",
      "BLUEPRINT_FIXTURE_MISMATCH",
      "BLUEPRINT_TAXONOMY_MISMATCH",
      "BLUEPRINT_VERSION_CONFLICT",
      "ACTIVE_BLUEPRINT_INCONSISTENT",
    ]) {
      try {
        runConvex(
          "seedBootstrap:applyBatch",
          {},
          { "--deployment": "development" },
          { spawn: () => failed(code) },
        );
        throw new Error(`expected ${code} to fail`);
      } catch (error) {
        expect(error.code).toBe(code);
        expect(isTransientBootstrapError(error)).toBe(false);
      }
    }
  });
  it("does not retry an unknown structured failure", () => {
    try {
      runConvex(
        "seedBootstrap:applyBatch",
        {},
        { "--deployment": "development" },
        {
          spawn: () => ({
            status: 1,
            stdout: "",
            stderr: 'ConvexError: {"code":"SOMETHING_NEW","message":"new"}',
          }),
        },
      );
      throw new Error("expected the call to fail");
    } catch (error) {
      expect(error.code).toBe("BOOTSTRAP_OPERATION_FAILED");
      expect(isTransientBootstrapError(error)).toBe(false);
    }
  });
  it("recognizes allowlisted codes printed outside a structured payload", () => {
    expect(() =>
      runConvex(
        "seedBootstrap:applyBatch",
        {},
        { "--deployment": "development" },
        {
          spawn: () => ({
            status: 1,
            stdout: "",
            stderr: "Error: ASSET_NOT_FOUND",
          }),
        },
      ),
    ).toThrow("ASSET_NOT_FOUND");
  });
});

describe("taxonomy installation transport", () => {
  it("sends the pinned digest to the internal installer", async () => {
    const client = {
      mutation: vi.fn(async () => ({
        state: "sealed",
        revision: 2,
        created: true,
      })),
    };
    await expect(
      installTaxonomy(client, "quilla-dev", { sleep: async () => {} }),
    ).resolves.toMatchObject({ state: "sealed", created: true });
    expect(client.mutation).toHaveBeenCalledWith("install", {
      target: "quilla-dev",
      catalogDigest: seedTaxonomyPolicy.digest,
    });
  });
  it("retries a transient installer failure", async () => {
    let attempts = 0;
    const client = {
      mutation: vi.fn(async () => {
        attempts++;
        if (attempts === 1)
          throw Object.assign(new Error("busy"), { code: "BOOTSTRAP_BUSY" });
        return { state: "sealed", created: false };
      }),
    };
    await expect(
      installTaxonomy(client, "quilla-dev", { sleep: async () => {} }),
    ).resolves.toMatchObject({ created: false });
    expect(attempts).toBe(2);
  });
  it("reads verification through the internal query", async () => {
    const client = {
      query: vi.fn(async () => ({ present: false })),
    };
    await expect(verifyTaxonomy(client, "quilla-dev")).resolves.toEqual({
      present: false,
    });
    expect(client.query).toHaveBeenCalledWith("verify", {
      target: "quilla-dev",
    });
  });
  it("rejects a missing target before invoking the deployment", async () => {
    const client = { mutation: vi.fn(), query: vi.fn() };
    await expect(installTaxonomy(client, "")).rejects.toMatchObject({
      code: "BOOTSTRAP_INVALID_ARGUMENTS",
    });
    await expect(verifyTaxonomy(client, "")).rejects.toMatchObject({
      code: "BOOTSTRAP_INVALID_ARGUMENTS",
    });
    expect(client.mutation).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe("blueprint installation transport", () => {
  it("keeps production unregistered", () => {
    expect(approvedImportTargets).toEqual({
      "quilla-dev": "https://perceptive-dodo-136.ap-southeast-2.convex.cloud",
    });
  });
  it("sends the pinned fixture digest to the internal installer", async () => {
    const client = {
      mutation: vi.fn(async () => ({
        created: true,
        levels: [],
      })),
    };
    await expect(
      installBlueprints(client, "quilla-dev", { sleep: async () => {} }),
    ).resolves.toMatchObject({ created: true });
    expect(client.mutation).toHaveBeenCalledWith("install", {
      target: "quilla-dev",
      fixtureDigest: seedBlueprintPolicy.digest,
    });
  });
  it("retries a transient installer failure", async () => {
    let attempts = 0;
    const client = {
      mutation: vi.fn(async () => {
        attempts++;
        if (attempts === 1)
          throw Object.assign(new Error("busy"), { code: "BOOTSTRAP_BUSY" });
        return { created: false };
      }),
    };
    await expect(
      installBlueprints(client, "quilla-dev", { sleep: async () => {} }),
    ).resolves.toMatchObject({ created: false });
    expect(attempts).toBe(2);
  });
  it("reads verification through the internal query", async () => {
    const client = {
      query: vi.fn(async () => ({
        expectedFixtureDigest: seedBlueprintPolicy.digest,
        deployedFixtureDigest: seedBlueprintPolicy.digest,
        fixtureDigestMatches: true,
        matchesExpected: true,
      })),
    };
    await expect(verifyBlueprints(client, "quilla-dev")).resolves.toMatchObject(
      { matchesExpected: true },
    );
    expect(client.query).toHaveBeenCalledWith("verify", {
      target: "quilla-dev",
    });
  });
  it("rejects deployed fixture-digest skew", async () => {
    await expect(
      verifyBlueprints(
        {
          query: async () => ({
            expectedFixtureDigest: "f".repeat(64),
            fixtureDigestMatches: true,
          }),
        },
        "quilla-dev",
      ),
    ).rejects.toMatchObject({ code: "BLUEPRINT_FIXTURE_MISMATCH" });
    await expect(
      verifyBlueprints(
        {
          query: async () => ({
            expectedFixtureDigest: seedBlueprintPolicy.digest,
            fixtureDigestMatches: false,
          }),
        },
        "quilla-dev",
      ),
    ).rejects.toMatchObject({ code: "BLUEPRINT_FIXTURE_MISMATCH" });
  });
  it("retains both fixture digests in the sanitized failure report", async () => {
    const deployedFixtureDigest = "e".repeat(64);
    let failure;
    try {
      await verifyBlueprints(
        {
          query: async () => ({
            expectedFixtureDigest: seedBlueprintPolicy.digest,
            deployedFixtureDigest,
            fixtureDigestMatches: false,
          }),
        },
        "quilla-dev",
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "BLUEPRINT_FIXTURE_MISMATCH",
      details: {
        expectedFixtureDigest: seedBlueprintPolicy.digest,
        deployedFixtureDigest,
      },
    });
    expect(
      bootstrapFailureReport(failure, { blueprintMode: true }),
    ).toMatchObject({
      error: "BLUEPRINT_FIXTURE_MISMATCH",
      details: {
        expectedFixtureDigest: seedBlueprintPolicy.digest,
        deployedFixtureDigest,
      },
    });
  });
  it("rejects a missing target before invoking the deployment", async () => {
    const client = { mutation: vi.fn(), query: vi.fn() };
    await expect(installBlueprints(client, "")).rejects.toMatchObject({
      code: "BOOTSTRAP_INVALID_ARGUMENTS",
    });
    await expect(verifyBlueprints(client, "")).rejects.toMatchObject({
      code: "BOOTSTRAP_INVALID_ARGUMENTS",
    });
    expect(client.mutation).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
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
  it("adopts the run created by a lost begin response", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan, {
      beginLostResponse: true,
    });
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
    expect(run.generation).toBe(2);
    expect(
      calls.filter(([kind, name]) => kind === "query" && name === "latest"),
    ).toHaveLength(1);
  });
  it("records only an explicitly selected deployment", async () => {
    const plan = fixturePlan();
    const run = (flags) =>
      applyBootstrap(plan, flags, transportPlan(plan).client, {
        checkpoint: null,
        fetchImpl: async () => uploadResponse,
        policy,
        expectedPlanChecksum: plan.planChecksum,
        sleep: async () => {},
      });
    const explicit = await run({
      "--expect-plan": plan.planChecksum,
      "--target": "fixture",
      "--deployment": "development",
    });
    expect(explicit.deployment).toBe("development");
    const deployKey = await run({
      "--expect-plan": plan.planChecksum,
      "--target": "fixture",
    });
    expect(deployKey).not.toHaveProperty("deployment");
  });
  it("keeps conflict details when the pause fails", async () => {
    const plan = fixturePlan();
    const { client } = transportPlan(plan, {
      preflightConflict: true,
      pauseFails: true,
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
      conflicts: expect.arrayContaining([
        expect.objectContaining({ code: "CONTENT_CONFLICT" }),
      ]),
    });
  });
  it("fences automatic pauses with the current generation", async () => {
    const plan = fixturePlan();
    const { client, calls } = transportPlan(plan, { applyFailure: true });
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
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    const pause = calls.find(
      ([kind, name]) => kind === "mutation" && name === "pause",
    );
    expect(pause?.[2]).toMatchObject({ generation: 1 });
  });
  it("stops when an operator pauses the run instead of resuming it", async () => {
    const plan = fixturePlan();
    const { client, run, calls } = transportPlan(plan, { pauseOnApply: true });
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
    ).rejects.toMatchObject({ code: "BOOTSTRAP_PAUSED" });
    expect(run.state).toBe("paused");
    expect(
      calls.filter(
        ([kind, name, args]) =>
          kind === "mutation" && name === "begin" && args.resumeRunId,
      ),
    ).toHaveLength(0);
    expect(
      calls.filter(([kind, name]) => kind === "mutation" && name === "pause"),
    ).toHaveLength(0);
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

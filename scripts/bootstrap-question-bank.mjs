import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { prepareImport } from "./import-question-bank.mjs";
import {
  bootstrapBatchSize,
  bootstrapInventoryChecksum,
  bootstrapPlanChecksum,
  bootstrapStageBatchSize,
  seedBootstrapPolicy,
  safeBootstrapFailure,
} from "../lib/question-import-contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const defaultCheckpoint = path.join(root, ".bootstrap-checkpoint.json");
const convexCli = path.join(root, "node_modules", "convex", "bin", "main.js");

class BootstrapError extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "BootstrapError";
    this.code = safeBootstrapFailure(code);
    this.transient = options.transient ?? false;
    this.conflicts = options.conflicts;
    this.recovery = options.recovery;
  }
}

/** Verify that an offline import plan is exactly the frozen initial corpus. */
export function verifyBootstrapPlan(plan, policy = seedBootstrapPolicy) {
  const manifests = plan.manifests;
  if (!Array.isArray(manifests) || manifests.length !== policy.families)
    throw new BootstrapError("BOOTSTRAP_POLICY_MISMATCH");
  let references = 0,
    assets = 0;
  for (let index = 0; index < manifests.length; index++) {
    const manifest = manifests[index];
    if (
      manifest.family !== index + 1 ||
      manifest.questions !== policy.perFamilyQuestions ||
      !Number.isSafeInteger(manifest.references) ||
      manifest.references < 0 ||
      !Number.isSafeInteger(manifest.assets) ||
      manifest.assets < 0
    )
      throw new BootstrapError("BOOTSTRAP_POLICY_MISMATCH");
    references += manifest.references;
    assets += manifest.assets;
  }
  const counts = plan.report?.counts;
  if (
    counts?.questions !== policy.expectedQuestions ||
    counts?.references !== policy.expectedReferences ||
    counts?.assets !== policy.expectedAssets ||
    references !== policy.expectedReferences ||
    assets !== policy.expectedAssets ||
    !/^[a-f0-9]{64}$/.test(plan.planChecksum ?? "") ||
    !/^[a-f0-9]{64}$/.test(plan.inventoryHash ?? "")
  )
    throw new BootstrapError("BOOTSTRAP_POLICY_MISMATCH");
  return {
    families: manifests.length,
    questions: counts.questions,
    references,
    assets,
  };
}

/** Verify both the plan shape and the frozen reviewed checksums. */
export function verifyFrozenBootstrapPlan(
  plan,
  policy = seedBootstrapPolicy,
  expectedPlanChecksum = bootstrapPlanChecksum,
  expectedInventoryHash = bootstrapInventoryChecksum,
) {
  const counts = verifyBootstrapPlan(plan, policy);
  if (
    plan.planChecksum !== expectedPlanChecksum ||
    plan.inventoryHash !== expectedInventoryHash
  )
    throw new BootstrapError("BOOTSTRAP_PLAN_MISMATCH");
  return counts;
}

/** Split records into command-line-safe batches by count and UTF-8 size. */
export function commandBatches(values, maxBytes = 16 * 1024, maxCount = 10) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    !Number.isSafeInteger(maxCount) ||
    maxCount < 1
  )
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  const batches = [];
  let current = [];
  let size = 2;
  for (const value of values) {
    const itemSize = Buffer.byteLength(JSON.stringify(value)) + 1;
    if (itemSize > maxBytes)
      throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
    if (
      current.length &&
      (current.length >= maxCount || size + itemSize > maxBytes)
    ) {
      batches.push(current);
      current = [];
      size = 2;
    }
    current.push(value);
    size += itemSize;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Read bounded status pages without renewing the lease. */
export async function readBootstrapStatus(client, target, runId) {
  const entries = [];
  let after = -1,
    run;
  for (;;) {
    const page = await client.query("status", { target, runId, after });
    run = page.run;
    if (!Array.isArray(page.entries))
      throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
    if (!page.entries.length) break;
    const next = page.entries.at(-1).ordinal;
    if (!Number.isSafeInteger(next) || next <= after)
      throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
    entries.push(...page.entries);
    after = next;
    if (entries.length > 10000)
      throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
    if (entries.length >= run.staged) break;
  }
  if (!run || entries.length !== run.staged)
    throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
  return { run, entries };
}

/**
 * Read only the run header. The status query uses an ordinal cursor, so a
 * sentinel cursor returns the run without paging every entry for each batch.
 */
export async function readBootstrapRun(client, target, runId) {
  const page = await client.query("status", {
    target,
    runId,
    after: Number.MAX_SAFE_INTEGER,
  });
  if (!page?.run) throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
  return page.run;
}

/** Persist only non-secret recovery identities for an interrupted bootstrap. */
async function saveCheckpoint(checkpoint, value) {
  if (!checkpoint) return;
  await writeFile(checkpoint, JSON.stringify(value) + "\n", { mode: 0o600 });
}

const transientCodes = new Set(["BOOTSTRAP_BUSY"]);
export function isTransientBootstrapError(error) {
  return Boolean(error?.transient) || transientCodes.has(error?.code);
}
function isLeaseError(error) {
  return (
    error?.code === "BOOTSTRAP_BUSY" ||
    error?.code === "BOOTSTRAP_LEASE_LOST" ||
    error?.code === "IMPORT_BUSY" ||
    error?.code === "IMPORT_LEASE_LOST"
  );
}

/** Retry transient transport and lease failures with capped exponential backoff. */
async function withBootstrapRetry(
  operation,
  {
    attempts = 6,
    baseDelayMs = 500,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      if (!isTransientBootstrapError(error) || attempt === attempts - 1)
        throw error;
      const delay = Math.min(30_000, baseDelayMs * 2 ** attempt);
      await sleep(delay + Math.floor(Math.random() * Math.min(delay, 1000)));
    }
  }
  throw last;
}

/** Parse explicit operator intent; no dotenv loading or implicit write target. */
export function parseBootstrapArgs(args) {
  const flags = {};
  const booleans = [
    "--json",
    "--apply",
    "--status",
    "--pause",
    "--rollback",
    "--prod",
    "--confirm-production",
  ];
  const values = [
    "--target",
    "--deployment",
    "--expect-plan",
    "--resume-run",
    "--run",
    "--checkpoint",
    "--reason",
  ];
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (booleans.includes(name)) {
      if (flags[name]) throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
      flags[name] = true;
    } else if (
      values.includes(name) &&
      !flags[name] &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      flags[name] = args[++index];
    else throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  }
  const modes = ["--apply", "--status", "--pause", "--rollback"].filter(
    (name) => flags[name],
  );
  if (modes.length > 1) throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  if (flags["--prod"] && flags["--deployment"])
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  // `--deployment prod` selects production without the explicit confirmation
  // required by `--prod`; the production path must use the confirmed flag.
  if (flags["--deployment"] === "prod")
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  if (flags["--confirm-production"] && !flags["--prod"])
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  if (flags["--prod"] && !flags["--confirm-production"])
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  if (modes.length === 0) {
    if (values.some((name) => flags[name]) || flags["--prod"])
      throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
    return flags;
  }
  if (!flags["--target"])
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  if (flags["--apply"]) {
    if (!flags["--expect-plan"] || flags["--run"] || flags["--reason"])
      throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
    return flags;
  }
  if (
    !flags["--run"] ||
    flags["--expect-plan"] ||
    flags["--resume-run"] ||
    flags["--checkpoint"] ||
    (flags["--rollback"] && !flags["--reason"]) ||
    (flags["--status"] && flags["--reason"])
  )
    throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  return flags;
}

/** The offline dry run needs no deployment; every remote mode does. */
export function requiresDeployment(flags) {
  return Boolean(
    flags["--apply"] ||
    flags["--status"] ||
    flags["--pause"] ||
    flags["--rollback"],
  );
}

/** Require an explicit deployment selection or an operator-provided deploy key. */
export function selectDeployment(flags, env = process.env) {
  if (flags["--prod"]) return ["--prod"];
  if (flags["--deployment"]) return ["--deployment", flags["--deployment"]];
  if (env.CONVEX_DEPLOY_KEY) return [];
  throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
}

/**
 * Invoke an internal Convex function with deployment CLI credentials.
 * Run the installed CLI through Node rather than spawning `npx.cmd`: no shell
 * parses the JSON arguments, so Windows command-line quoting cannot alter image
 * paths or question text. This is the same `convex run` entry point as npx.
 */
export function runConvex(
  functionName,
  args,
  flags,
  {
    spawn = spawnSync,
    env = process.env,
    execPath = process.execPath,
    cli = convexCli,
  } = {},
) {
  const result = spawn(
    execPath,
    [
      cli,
      "run",
      functionName,
      JSON.stringify(args),
      "--codegen",
      "disable",
      "--typecheck",
      "disable",
      ...selectDeployment(flags, env),
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env },
  );
  if (result.error || result.status !== 0) {
    const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
    const match = output.match(
      /\b(BOOTSTRAP_[A-Z_]+|IMPORT_[A-Z_]+|CONTENT_CONFLICT|VALIDATION_FAILED|FORBIDDEN|UNAUTHENTICATED|STALE_REVISION|TAXONOMY_UNAVAILABLE|UNVERIFIED_ASSET|REFERENCE_NOT_FOUND|QUESTION_[A-Z_]+)\b/,
    );
    throw new BootstrapError(match ? match[1] : "BOOTSTRAP_OPERATION_FAILED", {
      transient: !match,
    });
  }
  const text = result.stdout.trim();
  if (!text) return null;
  const starts = ["{", "["]
    .map((token) => text.indexOf(token))
    .filter((index) => index >= 0);
  if (!starts.length) throw new BootstrapError("BOOTSTRAP_OPERATION_FAILED");
  try {
    return JSON.parse(text.slice(Math.min(...starts)));
  } catch {
    throw new BootstrapError("BOOTSTRAP_OPERATION_FAILED");
  }
}

/** Build the thin internal-function client for one operator invocation. */
function bootstrapClient(flags, runner = runConvex) {
  return {
    query: (name, args) => runner(`seedBootstrap:${name}`, args, flags),
    mutation: (name, args) => runner(`seedBootstrap:${name}`, args, flags),
    action: (name, args) => runner(`seedBootstrap:${name}`, args, flags),
  };
}

/** Upload exact image bytes through a short-lived Convex storage URL. */
async function uploadBytes(uploadUrl, bytes, mediaType, fetchImpl = fetch) {
  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mediaType },
    body: bytes,
  });
  if (!response.ok)
    throw new BootstrapError("BOOTSTRAP_OPERATION_FAILED", {
      transient: response.status >= 500,
    });
  const body = await response.json();
  if (!body || typeof body.storageId !== "string")
    throw new BootstrapError("BOOTSTRAP_OPERATION_FAILED");
  return body.storageId;
}

/** Strip private image bytes from status/preflight transport payloads. */
function transportRecords(items) {
  return items.map(({ descriptor, source }) => ({ descriptor, source }));
}

/** Ten batches short of the five-minute lease; renew well before it expires. */
const leaseRenewalMs = 60 * 1000;

/** Apply the pinned plan from the durable server checkpoint. */
export async function applyBootstrap(
  plan,
  flags,
  client,
  {
    checkpoint = defaultCheckpoint,
    sleep,
    fetchImpl = fetch,
    policy = seedBootstrapPolicy,
    expectedPlanChecksum = bootstrapPlanChecksum,
    now = Date.now,
  } = {},
) {
  if (flags["--expect-plan"] !== plan.planChecksum)
    throw new BootstrapError("BOOTSTRAP_PLAN_MISMATCH");
  if (plan.planChecksum !== expectedPlanChecksum)
    throw new BootstrapError("BOOTSTRAP_PLAN_MISMATCH");
  const policyCounts = verifyBootstrapPlan(plan, policy);
  const target = flags["--target"];
  const beginArgs = {
    target,
    planChecksum: plan.planChecksum,
    inventoryHash: plan.inventoryHash,
    manifests: plan.manifests,
  };
  let created;
  try {
    created = await withBootstrapRetry(
      () =>
        client.mutation("begin", {
          ...beginArgs,
          ...(flags["--resume-run"]
            ? { resumeRunId: flags["--resume-run"] }
            : {}),
        }),
      { sleep },
    );
  } catch (error) {
    // A lost response can leave the just-created run holding the target lease.
    // Adopt only the newest matching plan, then resume it so the retry advances
    // the generation and fences any stale worker.
    if (error?.code !== "BOOTSTRAP_BUSY" || flags["--resume-run"]) throw error;
    let latest;
    try {
      latest = await client.query("latest", { target });
    } catch {
      throw error;
    }
    if (
      !latest ||
      latest.mode !== "bootstrap" ||
      latest.planChecksum !== plan.planChecksum ||
      latest.inventoryHash !== plan.inventoryHash
    )
      throw error;
    created = await withBootstrapRetry(
      () =>
        client.mutation("begin", {
          ...beginArgs,
          resumeRunId: latest._id,
        }),
      { sleep },
    );
  }
  let access = { ...created, target };
  const deployment = flags["--prod"] ? "prod" : flags["--deployment"];
  const recovery = {
    target,
    ...(deployment ? { deployment } : {}),
    runId: access.runId,
    planChecksum: plan.planChecksum,
  };
  try {
    await saveCheckpoint(checkpoint, recovery);
  } catch {
    // The run exists even when its recovery file cannot be written. Pause it
    // and return the run identity so status, pause or rollback remain usable.
    try {
      await pauseBootstrap(
        client,
        target,
        recovery.runId,
        "BOOTSTRAP_OPERATION_FAILED",
        created.generation,
      );
    } catch {
      /* A completed or unreachable run still needs its identity reported. */
    }
    throw Object.assign(new BootstrapError("BOOTSTRAP_OPERATION_FAILED"), {
      recovery,
    });
  }
  let lastRenewal = now();
  const call = async (kind, name, args) => {
    // A long apply can outlive one CLI invocation's lease. Renew before the
    // lease can expire; the server checkpoint remains authoritative.
    if (
      name !== "begin" &&
      name !== "renew" &&
      now() - lastRenewal >= leaseRenewalMs
    ) {
      await withBootstrapRetry(
        () => client.mutation("renew", { ...access, target }),
        { sleep },
      );
      lastRenewal = now();
    }
    const result = await withBootstrapRetry(() => client[kind](name, args), {
      sleep,
    });
    if (
      name === "begin" ||
      name === "renew" ||
      name === "stage" ||
      name === "applyBatch"
    )
      lastRenewal = now();
    return result;
  };
  /**
   * Re-acquire the lease once and replay the fenced operation from checkpoint.
   * An explicit pause or rollback is not a lease loss and must stop the worker;
   * only expired or superseded leases are resumed automatically.
   */
  const guarded = async (operation) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!isLeaseError(error) || attempt === 3) throw error;
        const lease = await call("mutation", "begin", {
          target,
          planChecksum: plan.planChecksum,
          inventoryHash: plan.inventoryHash,
          manifests: plan.manifests,
          resumeRunId: recovery.runId,
        });
        access = { ...lease, target };
      }
    }
    throw new BootstrapError("BOOTSTRAP_LEASE_LOST");
  };
  try {
    const reader = { query: (name, args) => call("query", name, args) };
    let run = await readBootstrapRun(reader, target, recovery.runId);
    if (run.planChecksum !== plan.planChecksum)
      throw new BootstrapError("BOOTSTRAP_PLAN_MISMATCH");
    if (run.state === "complete")
      return {
        ...recovery,
        mode: "apply",
        state: "complete",
        ...policyCounts,
      };
    // Read-only comparison for work that is not committed yet.
    const pendingItems = plan.items.slice(run.processed);
    const comparison = [];
    for (const records of commandBatches(
      transportRecords(pendingItems),
      16 * 1024,
      bootstrapBatchSize,
    ))
      comparison.push(
        ...(await call("query", "preflight", {
          ...access,
          records,
        })),
      );
    if (
      comparison.length !== pendingItems.length ||
      new Set(comparison.map((result) => result.ordinal)).size !==
        pendingItems.length
    )
      throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
    const conflicts = comparison.filter((result) =>
      ["conflict", "invalid"].includes(result.status),
    );
    if (conflicts.length) {
      try {
        await pauseBootstrap(
          client,
          target,
          recovery.runId,
          "BOOTSTRAP_TARGET_CONFLICT",
          run.generation,
        );
      } catch {
        // Preserve the conflict details even when the deployment credential or
        // the pause itself is unavailable.
      }
      throw new BootstrapError("BOOTSTRAP_TARGET_CONFLICT", {
        conflicts: conflicts.map((result) => ({
          ...plan.items[result.ordinal].descriptor,
          code: result.code ?? "CONTENT_CONFLICT",
        })),
        recovery,
      });
    }
    if (run.staged < run.expected) {
      for (const entries of commandBatches(
        plan.items.slice(run.staged).map((item) => item.descriptor),
        16 * 1024,
        bootstrapStageBatchSize,
      ))
        await guarded(() => call("mutation", "stage", { ...access, entries }));
      run = await readBootstrapRun(reader, target, recovery.runId);
    }
    if (run.state !== "running" || run.staged !== run.expected)
      throw new BootstrapError("BOOTSTRAP_NOT_RUNNING");
    const expected = run.expected;
    while (run.processed < expected) {
      const first = plan.items[run.processed];
      if (!first) throw new BootstrapError("BOOTSTRAP_INVALID_CHECKPOINT");
      const before = run.processed;
      let result;
      if (first.source.kind === "asset") {
        result = await guarded(async () => {
          const reserved = await call("mutation", "applyBatch", {
            ...access,
            records: transportRecords([first]),
          });
          if (reserved.uploadOrdinal === first.descriptor.ordinal) {
            const upload = await call("mutation", "assetUploadUrl", {
              ...access,
              ordinal: first.descriptor.ordinal,
            });
            const storageId = await uploadBytes(
              upload.uploadUrl,
              first.bytes,
              first.source.value.mediaType,
              fetchImpl,
            );
            await call("action", "verifyAsset", {
              ...access,
              ordinal: first.descriptor.ordinal,
              storageId,
            });
          }
          return await call("mutation", "applyBatch", {
            ...access,
            records: transportRecords([first]),
          });
        });
      } else {
        const pending = plan.items
          .slice(run.processed)
          .filter((item) => item.source.kind !== "asset");
        const records = commandBatches(
          transportRecords(pending),
          16 * 1024,
          bootstrapBatchSize,
        )[0];
        result = await guarded(() =>
          call("mutation", "applyBatch", { ...access, records }),
        );
      }
      run = result;
      if (run.processed <= before)
        throw new BootstrapError("BOOTSTRAP_OPERATION_FAILED");
      await saveCheckpoint(checkpoint, recovery);
    }
    const final = await readBootstrapRun(reader, target, recovery.runId);
    if (final.state !== "complete" || final.processed !== final.expected)
      throw new BootstrapError("BOOTSTRAP_NOT_RUNNING");
    return {
      ...recovery,
      mode: "apply",
      state: "complete",
      ...policyCounts,
    };
  } catch (error) {
    const code = bootstrapErrorCode(error);
    // A paused run is already stopped by the operator; do not overwrite its
    // pause metadata with a redundant automatic pause.
    if (code !== "BOOTSTRAP_PAUSED") {
      try {
        await pauseBootstrap(
          client,
          target,
          recovery.runId,
          code,
          access.generation,
        );
      } catch {
        /* A completed run or lost deployment credential must not authorize a fallback write. */
      }
    }
    if (!error.recovery) error.recovery = recovery;
    throw error;
  }
}

/** Pause a running bootstrap without discarding committed work. */
async function pauseBootstrap(client, target, runId, code, generation) {
  await withBootstrapRetry(() =>
    client.mutation("pause", {
      target,
      runId,
      ...(code ? { code } : {}),
      ...(generation !== undefined ? { generation } : {}),
    }),
  );
  return readBootstrapRun(client, target, runId);
}

/** Archive every bootstrap-published version in bounded batches. */
export async function rollbackBootstrap(client, target, runId, reason) {
  if (!reason?.trim()) throw new BootstrapError("BOOTSTRAP_INVALID_ARGUMENTS");
  let run = await readBootstrapRun(client, target, runId);
  if (run.state === "preparing" || run.state === "running")
    run = await pauseBootstrap(
      client,
      target,
      runId,
      "BOOTSTRAP_NOT_PAUSED",
      run.generation,
    );
  for (let round = 0; round < 500; round++) {
    if (run.state === "rolled_back")
      return {
        mode: "rollback",
        target,
        runId,
        state: run.state,
        rolledBack: run.rolledBack ?? 0,
        reason,
      };
    if (run.state !== "paused" && run.state !== "complete")
      throw new BootstrapError("BOOTSTRAP_NOT_PAUSED");
    await withBootstrapRetry(() =>
      client.mutation("rollbackBatch", { target, runId, reason }),
    );
    run = await readBootstrapRun(client, target, runId);
  }
  throw new BootstrapError("BOOTSTRAP_ROLLBACK_ORDER");
}

/** Print only safe, human-readable status for each operator mode. */
export function bootstrapSummary(result) {
  if (result.mode === "pause")
    return `pause: bootstrap run ${result.runId} is ${result.state}.\nCommitted work was preserved.`;
  if (result.mode === "rollback")
    return `rollback: ${result.rolledBack} bootstrap-published versions archived; run ${result.runId} is ${result.state}.\nQuestion, review and attempt history was preserved.`;
  return `${result.mode}: ${result.questions ?? result.counts?.questions ?? 0} questions, ${result.references ?? result.counts?.references ?? 0} references, ${result.assets ?? result.counts?.assets ?? 0} images\nPlan checksum: ${result.planChecksum ?? "not-applicable"}\n${result.state ? `Bootstrap run: ${result.runId}; ${result.state}` : "No writes performed."}\nBootstrap acceptance is not independent editorial review; exam readiness not evaluated.`;
}

/** Print only allowlisted error codes; transport errors may contain credentials. */
export function bootstrapErrorCode(error) {
  const code = error?.data?.code ?? error?.code ?? error?.message;
  return safeBootstrapFailure(code);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const flags = parseBootstrapArgs(process.argv.slice(2));
    const remote = requiresDeployment(flags);
    if (remote) selectDeployment(flags);
    const client = remote ? bootstrapClient(flags) : null;
    let result;
    if (flags["--status"]) {
      const status = await readBootstrapStatus(
        client,
        flags["--target"],
        flags["--run"],
      );
      result = {
        mode: "status",
        run: status.run,
        entryCount: status.entries.length,
      };
    } else if (flags["--pause"]) {
      const run = await pauseBootstrap(
        client,
        flags["--target"],
        flags["--run"],
        flags["--reason"] ?? "BOOTSTRAP_OPERATION_FAILED",
      );
      result = { mode: "pause", runId: flags["--run"], state: run.state, run };
    } else if (flags["--rollback"]) {
      result = await rollbackBootstrap(
        client,
        flags["--target"],
        flags["--run"],
        flags["--reason"],
      );
    } else {
      const plan = await prepareImport();
      const policy = verifyFrozenBootstrapPlan(plan);
      result = {
        ...plan.report,
        mode: "dry-run",
        seedPolicy: { ...policy, verified: true },
      };
      if (flags["--apply"])
        result = await applyBootstrap(plan, flags, client, {
          checkpoint: flags["--checkpoint"],
        });
    }
    if (flags["--json"] || result.mode === "status")
      console.log(JSON.stringify(result));
    else console.log(bootstrapSummary(result));
  } catch (error) {
    console.error(
      JSON.stringify({
        error: bootstrapErrorCode(error),
        conflicts: error.conflicts ?? [],
        checkpoint: error.recovery ?? null,
        recovery:
          "Stop; inspect bootstrap status, pause an active run, and resume only with the same pinned plan. Roll back with a new plan after a full archive.",
      }),
    );
    process.exitCode = 1;
  }
}

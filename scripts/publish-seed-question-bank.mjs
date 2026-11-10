import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { prepareImport, readImportStatus } from "./import-question-bank.mjs";
import {
  approvedImportTargets,
  safeSeedFailure,
  seedPublicationBatchSize,
  seedPublicationPolicy,
  seedStageBatchSize,
} from "../lib/question-import-contract.mjs";

/** Verify that an offline import plan is exactly the frozen seed corpus. */
export function verifySeedPlan(plan, policy = seedPublicationPolicy) {
  const manifests = plan.manifests;
  if (!Array.isArray(manifests) || manifests.length !== policy.families)
    throw new Error("SEED_POLICY_MISMATCH");
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
      throw new Error("SEED_POLICY_MISMATCH");
    references += manifest.references;
    assets += manifest.assets;
  }
  const counts = plan.report?.counts;
  if (
    counts?.questions !== policy.expectedQuestions ||
    counts?.references !== policy.expectedReferences ||
    counts?.assets !== policy.expectedAssets ||
    references !== policy.expectedReferences ||
    assets !== policy.expectedAssets
  )
    throw new Error("SEED_POLICY_MISMATCH");
  return {
    families: manifests.length,
    questions: counts.questions,
    references,
    assets,
  };
}

/** Derive the ordered seed pin list from completed import question entries. */
export function questionPins(entries, policy = seedPublicationPolicy) {
  if (!Array.isArray(entries)) throw new Error("SEED_IMPORT_MISMATCH");
  const questions = entries
    .filter((entry) => entry.kind === "question")
    .sort((a, b) => a.ordinal - b.ordinal);
  if (questions.length !== policy.expectedQuestions)
    throw new Error("SEED_POLICY_MISMATCH");
  const counts = new Map();
  const pins = questions.map((entry, ordinal) => {
    if (
      entry.state !== "done" ||
      !Number.isSafeInteger(entry.ordinal) ||
      entry.ordinal < 0 ||
      !Number.isSafeInteger(entry.family)
    )
      throw new Error("SEED_IMPORT_MISMATCH");
    counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
    return { ordinal, importOrdinal: entry.ordinal, family: entry.family };
  });
  if (counts.size !== policy.families) throw new Error("SEED_POLICY_MISMATCH");
  for (let family = 1; family <= policy.families; family++)
    if (counts.get(family) !== policy.perFamilyQuestions)
      throw new Error("SEED_POLICY_MISMATCH");
  return pins;
}

/** Split an ordered list into bounded transport batches. */
export function seedBatches(values, size) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 100)
    throw new Error("SEED_INVALID_ARGUMENTS");
  const batches = [];
  for (let index = 0; index < values.length; index += size)
    batches.push(values.slice(index, index + size));
  return batches;
}

/** Resume staging at the server's durable count and send only pin ordinals. */
export function stageRequests(pins, after) {
  if (
    !Number.isSafeInteger(after) ||
    after < 0 ||
    after > pins.length ||
    pins.some((pin, index) => pin.ordinal !== index)
  )
    throw new Error("SEED_INVALID_CHECKPOINT");
  return seedBatches(
    pins
      .slice(after)
      .map(({ ordinal, importOrdinal }) => ({ ordinal, importOrdinal })),
    seedStageBatchSize,
  );
}

/** Select ordered version IDs for one lifecycle phase. */
export function transitionRequests(
  items,
  state,
  size = seedPublicationBatchSize,
) {
  const versions = items
    .filter((item) => item.state === state)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((item) => item.questionVersionId);
  return seedBatches(versions, size);
}

/** Select ordered version IDs for rollback from any non-rolled-back state. */
function rollbackRequests(items) {
  return seedBatches(
    items
      .filter((item) => item.state !== "rolled_back")
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((item) => item.questionVersionId),
    seedPublicationBatchSize,
  );
}

/** Read bounded seed status pages without renewing the lease. */
export async function readSeedStatus(client, target, runId) {
  const items = [];
  let after = -1,
    run;
  for (;;) {
    const page = await client.query("status", { target, runId, after });
    run = page.run;
    if (!Array.isArray(page.items)) throw new Error("SEED_INVALID_CHECKPOINT");
    if (!page.items.length) break;
    const next = page.items.at(-1).ordinal;
    if (!Number.isSafeInteger(next) || next <= after)
      throw new Error("SEED_INVALID_CHECKPOINT");
    items.push(...page.items);
    after = next;
    if (items.length > 10000) throw new Error("SEED_INVALID_CHECKPOINT");
    if (items.length >= run.staged) break;
  }
  if (!run || items.length !== run.staged)
    throw new Error("SEED_INVALID_CHECKPOINT");
  return { run, items };
}

/** Use only reviewed target URLs; never derive authority from credentials. */
export function seedClient(target, token) {
  if (!Object.hasOwn(approvedImportTargets, target))
    throw new Error("SEED_TARGET_DISABLED");
  if (!token) throw new Error("SEED_INVALID_ARGUMENTS");
  const client = new ConvexHttpClient(approvedImportTargets[target]);
  client.setAuth(token);
  return {
    query: (name, args) =>
      client.query(makeFunctionReference(`seedPublication:${name}`), args),
    mutation: (name, args) =>
      client.mutation(makeFunctionReference(`seedPublication:${name}`), args),
    importQuery: (name, args) =>
      client.query(makeFunctionReference(`questionImports:${name}`), args),
  };
}

/** Verify the completed import run and return its ordered question pins. */
async function readSeedImport(
  client,
  target,
  importRunId,
  plan,
  policy = seedPublicationPolicy,
) {
  const status = await readImportStatus(
    { query: client.importQuery },
    target,
    importRunId,
  );
  if (
    status.run.state !== "complete" ||
    status.run.planChecksum !== plan.planChecksum ||
    status.run.inventoryHash !== plan.inventoryHash
  )
    throw new Error("SEED_IMPORT_MISMATCH");
  return questionPins(status.entries, policy);
}

/** Persist only non-secret recovery identities for an interrupted rehearsal. */
async function saveCheckpoint(checkpoint, value) {
  if (!checkpoint) return;
  await writeFile(checkpoint, JSON.stringify(value) + "\n", { mode: 0o600 });
}

/** Stage, submit, accept and publish the exact seed plan with two admin tokens. */
export async function applySeedPublication(
  plan,
  { target, expectedPlan, importRunId, resumeRunId, checkpoint },
  clients,
  policy = seedPublicationPolicy,
) {
  if (expectedPlan !== plan.planChecksum) throw new Error("SEED_PLAN_MISMATCH");
  if (process.env.SEED_PUBLICATION_PLAN_CHECKSUM !== plan.planChecksum)
    throw new Error("SEED_PLAN_MISMATCH");
  const policyCounts = verifySeedPlan(plan, policy);
  const lease = await clients.importer.mutation("begin", {
    target,
    importRunId,
    planChecksum: plan.planChecksum,
    inventoryHash: plan.inventoryHash,
    ...(resumeRunId ? { resumeRunId } : {}),
  });
  const access = { ...lease, target };
  const recovery = {
    target,
    runId: lease.runId,
    planChecksum: plan.planChecksum,
    importRunId,
  };
  await saveCheckpoint(checkpoint, recovery);
  try {
    let status = await readSeedStatus(clients.importer, target, lease.runId);
    if (status.run.planChecksum !== plan.planChecksum)
      throw new Error("SEED_PLAN_MISMATCH");
    if (status.run.state === "complete")
      return { ...recovery, mode: "apply", state: "complete", ...policyCounts };
    if (status.run.staged < status.run.expected) {
      const pins = await readSeedImport(
        clients.importer,
        target,
        importRunId,
        plan,
        policy,
      );
      for (const items of stageRequests(pins, status.run.staged))
        await clients.importer.mutation("stage", { ...access, items });
      status = await readSeedStatus(clients.importer, target, lease.runId);
    }
    if (
      status.run.state !== "running" ||
      status.run.staged !== status.run.expected
    )
      throw new Error("SEED_NOT_RUNNING");
    if (status.run.submitted < status.run.expected) {
      for (const questionVersionIds of transitionRequests(
        status.items,
        "staged",
      ))
        await clients.importer.mutation("submit", {
          ...access,
          questionVersionIds,
        });
      status = await readSeedStatus(clients.importer, target, lease.runId);
    }
    if (status.run.submitted !== status.run.expected)
      throw new Error("SEED_APPROVAL_ORDER");
    if (status.run.approved < status.run.expected) {
      for (const questionVersionIds of transitionRequests(
        status.items,
        "submitted",
      ))
        await clients.approver.mutation("approve", {
          ...access,
          questionVersionIds,
        });
      status = await readSeedStatus(clients.approver, target, lease.runId);
    }
    if (status.run.approved !== status.run.expected)
      throw new Error("SEED_APPROVAL_ORDER");
    if (status.run.published < status.run.expected) {
      for (const questionVersionIds of transitionRequests(
        status.items,
        "approved",
      ))
        await clients.approver.mutation("publish", {
          ...access,
          questionVersionIds,
        });
      status = await readSeedStatus(clients.approver, target, lease.runId);
    }
    if (
      status.run.state !== "complete" ||
      status.run.published !== status.run.expected
    )
      throw new Error("SEED_INCOMPLETE");
    return { ...recovery, mode: "apply", state: "complete", ...policyCounts };
  } catch (error) {
    try {
      await clients.importer.mutation("pause", {
        target,
        runId: lease.runId,
        code: seedErrorCode(error),
      });
    } catch {
      /* Lease loss or token expiry must not authorize a fallback write. */
    }
    error.seedRecovery = recovery;
    throw error;
  }
}

/** Pause a running rehearsal without discarding staged or accepted work. */
export async function pauseSeedPublication(client, target, runId) {
  await client.mutation("pause", {
    target,
    runId,
    code: "SEED_OPERATION_FAILED",
  });
  return readSeedStatus(client, target, runId);
}

/** Archive every pinned version in bounded batches; never hard-delete history. */
export async function rollbackSeedPublication(client, target, runId, reason) {
  if (!reason?.trim()) throw new Error("SEED_INVALID_ARGUMENTS");
  let status = await readSeedStatus(client, target, runId);
  if (
    status.run.state !== "paused" &&
    status.run.state !== "complete" &&
    status.run.state !== "rolled_back"
  )
    throw new Error("SEED_NOT_PAUSED");
  for (const questionVersionIds of rollbackRequests(status.items))
    await client.mutation("rollbackBatch", {
      target,
      runId,
      questionVersionIds,
      reason,
    });
  status = await readSeedStatus(client, target, runId);
  if (
    status.run.state !== "rolled_back" ||
    status.run.rolledBack !== status.run.expected
  )
    throw new Error("SEED_ROLLBACK_INCOMPLETE");
  return {
    mode: "rollback",
    target,
    runId,
    state: status.run.state,
    rolledBack: status.run.rolledBack,
    reason,
  };
}

/** Parse explicit operator intent; no dotenv loading or implicit write target. */
export function parseSeedArgs(args) {
  const flags = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (
      ["--json", "--apply", "--status", "--pause", "--rollback"].includes(name)
    ) {
      if (flags[name]) throw new Error("SEED_INVALID_ARGUMENTS");
      flags[name] = true;
    } else if (
      [
        "--target",
        "--expect-plan",
        "--import-run",
        "--resume-run",
        "--run",
        "--checkpoint",
        "--reason",
      ].includes(name) &&
      !flags[name] &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      flags[name] = args[++index];
    else throw new Error("SEED_INVALID_ARGUMENTS");
  }
  const modes = ["--apply", "--status", "--pause", "--rollback"].filter(
    (name) => flags[name],
  );
  if (modes.length > 1) throw new Error("SEED_INVALID_ARGUMENTS");
  if (modes.length === 0) {
    if (
      flags["--target"] ||
      flags["--expect-plan"] ||
      flags["--import-run"] ||
      flags["--resume-run"] ||
      flags["--run"] ||
      flags["--checkpoint"] ||
      flags["--reason"]
    )
      throw new Error("SEED_INVALID_ARGUMENTS");
    return flags;
  }
  if (!flags["--target"]) throw new Error("SEED_INVALID_ARGUMENTS");
  if (flags["--apply"]) {
    if (
      !flags["--expect-plan"] ||
      !flags["--import-run"] ||
      flags["--run"] ||
      flags["--reason"]
    )
      throw new Error("SEED_INVALID_ARGUMENTS");
    return flags;
  }
  if (
    !flags["--run"] ||
    flags["--expect-plan"] ||
    flags["--import-run"] ||
    flags["--resume-run"] ||
    flags["--checkpoint"] ||
    (flags["--rollback"] && !flags["--reason"]) ||
    (flags["--status"] && flags["--reason"])
  )
    throw new Error("SEED_INVALID_ARGUMENTS");
  return flags;
}

/** Print only allowlisted error codes; transport errors may contain credentials. */
export function seedErrorCode(error) {
  const code = error?.data?.code ?? error?.message;
  return safeSeedFailure(code);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const flags = parseSeedArgs(process.argv.slice(2));
    let result;
    if (flags["--status"]) {
      const status = await readSeedStatus(
        seedClient(flags["--target"], process.env.QUESTION_BANK_IMPORT_TOKEN),
        flags["--target"],
        flags["--run"],
      );
      result = {
        mode: "status",
        run: status.run,
        itemCount: status.items.length,
      };
    } else if (flags["--pause"]) {
      const status = await pauseSeedPublication(
        seedClient(flags["--target"], process.env.QUESTION_BANK_IMPORT_TOKEN),
        flags["--target"],
        flags["--run"],
      );
      result = {
        mode: "pause",
        run: status.run,
        itemCount: status.items.length,
      };
    } else if (flags["--rollback"]) {
      result = await rollbackSeedPublication(
        seedClient(flags["--target"], process.env.QUESTION_BANK_IMPORT_TOKEN),
        flags["--target"],
        flags["--run"],
        flags["--reason"],
      );
    } else {
      const plan = await prepareImport();
      const policy = verifySeedPlan(plan);
      result = {
        ...plan.report,
        mode: "dry-run",
        seedPolicy: { ...policy, verified: true },
      };
      if (flags["--apply"])
        result = await applySeedPublication(
          plan,
          {
            target: flags["--target"],
            expectedPlan: flags["--expect-plan"],
            importRunId: flags["--import-run"],
            resumeRunId: flags["--resume-run"],
            checkpoint: flags["--checkpoint"],
          },
          {
            importer: seedClient(
              flags["--target"],
              process.env.QUESTION_BANK_IMPORT_TOKEN,
            ),
            approver: seedClient(
              flags["--target"],
              process.env.SEED_PUBLICATION_APPROVER_TOKEN,
            ),
          },
        );
    }
    if (flags["--json"] || result.mode === "status")
      console.log(JSON.stringify(result));
    else
      console.log(
        `${result.mode}: ${result.questions ?? result.counts?.questions ?? 0} questions, ${result.references ?? result.counts?.references ?? 0} references, ${result.assets ?? result.counts?.assets ?? 0} images\nPlan checksum: ${result.planChecksum ?? "not-applicable"}\n${result.state ? `Seed run: ${result.runId}; ${result.state}` : "No writes performed."}\nEditorial review and exam readiness not evaluated.`,
      );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: seedErrorCode(error),
        checkpoint: error.seedRecovery ?? null,
        recovery:
          "Stop; inspect seed status, pause an active run, and resume only with the same pinned plan.",
      }),
    );
    process.exitCode = 1;
  }
}

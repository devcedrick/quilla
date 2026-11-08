import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { validateQuestionBank } from "./validate-question-bank.mjs";
import {
  approvedImportTargets,
  importCanonical,
  importDigest,
  importChainStart,
  importBatchBytes,
  importBatchSize,
  safeImportFailure,
} from "../lib/question-import-contract.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Load the exact validated snapshot, keeping private payloads out of reports. */
export async function prepareImport(
  manifestPaths = Array.from({ length: 7 }, (_, i) =>
    path.join(root, `content/question-bank/family-0${i + 1}/manifest.json`),
  ),
) {
  const manifests = [],
    items = [],
    issues = [];
  for (const manifestPath of manifestPaths) {
    const validation = await validateQuestionBank(manifestPath, "seed", true);
    issues.push(
      ...validation.issues.map(({ severity, rule, recordId }) => ({
        severity,
        rule,
        recordId,
      })),
    );
    if (!validation.snapshot) continue;
    const { manifest, records, assetBytes } = validation.snapshot;
    if (manifest.seedFamilies.length !== 1)
      throw new Error("IMPORT_REQUIRES_SINGLE_FAMILY_MANIFEST");
    const family = manifest.seedFamilies[0];
    const pin = {
      corpusId: manifest.corpusId,
      revision: manifest.revision,
      checksum: validation.checksum,
      family,
      taxonomyId: manifest.taxonomyId,
      blueprintIds: manifest.blueprintIds,
      questions: records.questions.length,
      references: records.references.length,
      assets: records.assets.length,
    };
    manifests.push(pin);
    for (const [plural, kind, id] of [
      ["assets", "asset", "assetId"],
      ["references", "reference", "referenceId"],
      ["questions", "question", "questionId"],
    ]) {
      for (const { value } of records[plural])
        items.push({
          descriptor: {
            ordinal: 0,
            kind,
            sourceId: value[id],
            version: kind === "asset" ? 0 : value.version,
            family,
            sourceChecksum: await importDigest(value),
          },
          source: { kind, value },
          ...(kind === "asset" ? { bytes: assetBytes.get(value.assetId) } : {}),
        });
    }
  }
  if (issues.some((i) => i.severity === "error")) {
    const error = new Error("IMPORT_OFFLINE_VALIDATION_FAILED");
    error.importIssues = issues;
    throw error;
  }
  manifests.sort((a, b) => a.family - b.family);
  if (
    manifests.length !== 7 ||
    manifests.some((m, i) => m.family !== i + 1 || m.questions !== 270)
  )
    throw new Error("IMPORT_REQUIRES_SEVEN_COMPLETE_FAMILIES");
  const rank = { asset: 0, reference: 1, question: 2 };
  items.sort(
    (a, b) =>
      rank[a.source.kind] - rank[b.source.kind] ||
      a.descriptor.sourceId.localeCompare(b.descriptor.sourceId, "en") ||
      a.descriptor.version - b.descriptor.version,
  );
  const seen = new Set(),
    fingerprints = new Map(),
    duplicates = [];
  let inventoryHash = importChainStart;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.descriptor.ordinal = i;
    // Multiple versions of one ID inside a plan are intentionally unsupported.
    const canonicalIdentity = `${item.descriptor.kind}:${item.descriptor.sourceId}`;
    if (seen.has(canonicalIdentity))
      throw new Error("IMPORT_CROSS_FAMILY_ID_CONFLICT");
    seen.add(canonicalIdentity);
    if (item.source.kind === "question") {
      const normalize = (s) =>
        s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
      const q = item.source.value;
      const ref = q.reference
        ? items.find(
            (r) =>
              r.source.kind === "reference" &&
              r.descriptor.sourceId === q.reference.referenceId &&
              r.descriptor.version === q.reference.referenceVersion,
          )?.source.value
        : null;
      const fingerprint = await importDigest({
        stem: normalize(q.stem),
        choices: q.choices.map((c) => normalize(c.text)).sort(),
        reference: ref?.blocks ?? null,
      });
      if (fingerprints.has(fingerprint))
        duplicates.push({
          sourceId: item.descriptor.sourceId,
          matches: fingerprints.get(fingerprint),
        });
      else fingerprints.set(fingerprint, item.descriptor.sourceId);
    }
    inventoryHash = await importDigest({
      chain: inventoryHash,
      entry: item.descriptor,
    });
  }
  const planChecksum = await importDigest({ manifests, inventoryHash });
  return {
    manifests,
    items,
    inventoryHash,
    planChecksum,
    report: {
      mode: "dry-run",
      planChecksum,
      inventoryHash,
      manifests,
      counts: {
        questions: items.filter((i) => i.source.kind === "question").length,
        references: items.filter((i) => i.source.kind === "reference").length,
        assets: items.filter((i) => i.source.kind === "asset").length,
      },
      inventory: items.map((i) => i.descriptor),
      issues,
      duplicates,
      coverage: "seven-complete-seed-families",
      targetComparison: "not-checked",
      editorialReview: "not-performed",
      examReadiness: "not-evaluated",
    },
  };
}

/** Bound payload batches by both record count and UTF-8 size. */
export function importBatches(items) {
  const batches = [];
  let current = [];
  for (const item of items) {
    if (Buffer.byteLength(importCanonical([item])) > importBatchBytes)
      throw new Error("IMPORT_RECORD_TOO_LARGE");
    if (
      current.length &&
      (current.length === importBatchSize ||
        Buffer.byteLength(importCanonical([...current, item])) >
          importBatchBytes)
    ) {
      batches.push(current);
      current = [];
    }
    current.push(item);
  }
  if (current.length) batches.push(current);
  return batches;
}

/** Use only reviewed target URLs; never derive authority from deployment credentials. */
export function importClient(target, token) {
  if (!Object.hasOwn(approvedImportTargets, target))
    throw new Error("IMPORT_TARGET_NOT_APPROVED");
  if (!token) throw new Error("IMPORT_TOKEN_REQUIRED");
  const client = new ConvexHttpClient(approvedImportTargets[target]);
  client.setAuth(token);
  return {
    query: (name, args) =>
      client.query(makeFunctionReference(`questionImports:${name}`), args),
    mutation: (name, args) =>
      client.mutation(makeFunctionReference(`questionImports:${name}`), args),
    upload: (args) =>
      client.action(
        makeFunctionReference("questionImportActions:uploadAsset"),
        args,
      ),
  };
}

/** Compare every record without writing; pending dependencies are supplied by this plan. */
export async function compareImport(plan, client, target) {
  const results = [],
    requests = [];
  for (const manifest of plan.manifests) {
    const records = plan.items
      .filter((i) => i.descriptor.family === manifest.family)
      .map(({ descriptor, source }) => ({ descriptor, source }));
    for (const group of importBatches(records))
      requests.push({ target, manifest, records: group });
  }
  let next = 0;
  // Read-only work may overlap; writes remain sequential and lease-fenced.
  await Promise.all(
    Array.from({ length: Math.min(4, requests.length) }, async () => {
      while (next < requests.length) {
        const request = requests[next++];
        results.push(...(await client.query("preflight", request)));
      }
    }),
  );
  if (
    results.length !== plan.items.length ||
    new Set(results.map((r) => r.ordinal)).size !== plan.items.length
  )
    throw new Error("IMPORT_INCOMPLETE_PREFLIGHT");
  return results.sort((a, b) => a.ordinal - b.ordinal);
}

/** Read bounded checkpoint pages without renewing the lease or changing progress. */
export async function readImportStatus(client, target, runId) {
  const entries = [];
  let after = -1,
    run;
  do {
    const page = await client.query("status", { target, runId, after });
    run = page.run;
    if (!page.entries.length) break;
    const next = page.entries.at(-1).ordinal;
    if (next <= after) throw new Error("IMPORT_INVALID_CHECKPOINT");
    entries.push(...page.entries);
    after = next;
    if (entries.length > 10000) throw new Error("IMPORT_INVALID_CHECKPOINT");
  } while (entries.length < run.staged);
  return { mode: "status", run, entries };
}

/** Apply or reconcile the pinned plan; the database checkpoint is authoritative. */
export async function applyImport(
  plan,
  client,
  { target, expectedPlan, resumeRunId, checkpoint },
) {
  if (expectedPlan !== plan.planChecksum)
    throw new Error("IMPORT_PLAN_MISMATCH");
  const comparison = await compareImport(plan, client, target);
  if (comparison.some((r) => ["conflict", "invalid"].includes(r.status))) {
    const error = new Error("IMPORT_TARGET_CONFLICT");
    error.importConflicts = comparison
      .filter((r) => ["conflict", "invalid"].includes(r.status))
      .map((r) => ({
        ...plan.items[r.ordinal].descriptor,
        code: r.code ?? "CONTENT_CONFLICT",
      }));
    throw error;
  }
  const lease = await client.mutation("begin", {
    target,
    planChecksum: plan.planChecksum,
    inventoryHash: plan.inventoryHash,
    manifests: plan.manifests,
    ...(resumeRunId ? { resumeRunId } : {}),
  });
  const access = { ...lease, target };
  try {
    const save = async () => {
      if (checkpoint)
        await writeFile(
          checkpoint,
          JSON.stringify({
            target,
            runId: lease.runId,
            planChecksum: plan.planChecksum,
          }) + "\n",
          { mode: 0o600 },
        );
    };
    await save();
    let { run } = await client.query("status", {
      target,
      runId: lease.runId,
      after: -1,
    });
    if (run.planChecksum !== plan.planChecksum)
      throw new Error("IMPORT_PLAN_MISMATCH");
    if (run.state === "complete")
      return {
        ...plan.report,
        mode: "apply",
        targetComparison: comparison,
        runId: lease.runId,
        state: "complete",
      };
    for (const entries of importBatches(
      plan.items.slice(run.staged).map((i) => i.descriptor),
    ))
      await client.mutation("stage", { ...access, entries });
    ({ run } = await client.query("status", {
      target,
      runId: lease.runId,
      after: -1,
    }));
    let pending = plan.items.slice(run.processed);
    while (pending.length) {
      await client.mutation("renew", access);
      const first = pending[0];
      const records =
        first.source.kind === "asset"
          ? [{ descriptor: first.descriptor, source: first.source }]
          : importBatches(
              pending
                .filter((i) => i.source.kind !== "asset")
                .map(({ descriptor, source }) => ({ descriptor, source })),
            )[0];
      await client.mutation("applyBatch", { ...access, records });
      ({ run } = await client.query("status", {
        target,
        runId: lease.runId,
        after: -1,
      }));
      if (
        first.source.kind === "asset" &&
        run.processed === first.descriptor.ordinal
      ) {
        const bytes = first.bytes;
        await client.upload({
          ...access,
          ordinal: first.descriptor.ordinal,
          bytes: bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        });
        await client.mutation("applyBatch", { ...access, records });
        ({ run } = await client.query("status", {
          target,
          runId: lease.runId,
          after: -1,
        }));
      }
      if (run.processed <= first.descriptor.ordinal)
        throw new Error("IMPORT_PROGRESS_STALLED");
      pending = plan.items.slice(run.processed);
      await save();
    }
    return {
      ...plan.report,
      mode: "apply",
      targetComparison: comparison,
      runId: lease.runId,
      state: run.state,
    };
  } catch (error) {
    try {
      await client.mutation("interrupt", {
        ...access,
        code: importErrorCode(error),
      });
    } catch {
      /* Token expiry, a completed run or lease loss must not authorize a fallback write. */
    }
    error.importRecovery = {
      target,
      runId: lease.runId,
      planChecksum: plan.planChecksum,
    };
    throw error;
  }
}

/** Parse explicit operator intent; no dotenv loading or implicit write target. */
export function parseImportArgs(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (["--json", "--apply", "--check-target"].includes(name) && !flags[name])
      flags[name] = true;
    else if (
      [
        "--target",
        "--expect-plan",
        "--resume-run",
        "--checkpoint",
        "--status-run",
      ].includes(name) &&
      !flags[name] &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      flags[name] = args[++i];
    else throw new Error("IMPORT_INVALID_ARGUMENTS");
  }
  if (
    ((flags["--apply"] || flags["--check-target"] || flags["--status-run"]) &&
      !flags["--target"]) ||
    (flags["--status-run"] && (flags["--apply"] || flags["--check-target"])) ||
    (flags["--apply"] && !flags["--expect-plan"]) ||
    (!flags["--apply"] &&
      (flags["--resume-run"] ||
        flags["--checkpoint"] ||
        flags["--expect-plan"])) ||
    (flags["--target"] &&
      !flags["--apply"] &&
      !flags["--check-target"] &&
      !flags["--status-run"])
  )
    throw new Error("IMPORT_INVALID_ARGUMENTS");
  return flags;
}

/** Print only allowlisted error codes; transport errors may contain credentials. */
export function importErrorCode(error) {
  const code = error?.data?.code ?? error?.message;
  return safeImportFailure(code);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const flags = parseImportArgs(process.argv.slice(2));
    let result;
    if (flags["--status-run"]) {
      const client = importClient(
        flags["--target"],
        process.env.QUESTION_BANK_IMPORT_TOKEN,
      );
      result = await readImportStatus(
        client,
        flags["--target"],
        flags["--status-run"],
      );
    } else {
      const plan = await prepareImport();
      result = plan.report;
      if (flags["--apply"] || flags["--check-target"]) {
        const target = flags["--target"],
          client = importClient(target, process.env.QUESTION_BANK_IMPORT_TOKEN);
        result = flags["--apply"]
          ? await applyImport(plan, client, {
              target,
              expectedPlan: flags["--expect-plan"],
              resumeRunId: flags["--resume-run"],
              checkpoint: flags["--checkpoint"],
            })
          : {
              ...result,
              targetComparison: await compareImport(plan, client, target),
            };
      }
    }
    if (
      Array.isArray(result.targetComparison) &&
      result.targetComparison.some((r) =>
        ["conflict", "invalid"].includes(r.status),
      )
    )
      process.exitCode = 1;
    console.log(
      flags["--json"] || result.mode === "status"
        ? JSON.stringify(result)
        : `${result.mode}: ${result.counts.questions} questions, ${result.counts.references} references, ${result.counts.assets} images\nPlan checksum: ${result.planChecksum}\nTarget comparison: ${typeof result.targetComparison === "string" ? result.targetComparison : JSON.stringify(result.targetComparison)}\n${result.state ? `Run: ${result.runId}; ${result.state}` : "No writes performed."}\nEditorial review and exam readiness not evaluated.`,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: importErrorCode(error),
        issues: error.importIssues ?? [],
        conflicts: error.importConflicts ?? [],
        checkpoint: error.importRecovery ?? null,
        recovery:
          "Stop; inspect run status and retry the same plan with fresh authentication after lease release or expiry.",
      }),
    );
    process.exitCode = 1;
  }
}

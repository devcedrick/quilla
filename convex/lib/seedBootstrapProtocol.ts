import { v, type Infer } from "convex/values";
import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  approvedImportTargets,
  bootstrapBatchSize,
  bootstrapPlanChecksum,
  bootstrapInventoryChecksum,
  importLeaseMs,
  seedBootstrapPolicy,
} from "../../lib/question-import-contract.mjs";
import { digest, bounded } from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";
import type { manifestPin } from "./questionImportProtocol";

export const bootstrapLeaseMs = importLeaseMs;
export const systemImporterIdentifier = "system:seed-bootstrap-importer";
export const systemApproverIdentifier = "system:seed-bootstrap-approver";

export const bootstrapRunAccess = {
  runId: v.id("questionImportRuns"),
  target: v.string(),
  generation: v.number(),
};

/** Reject malformed digests without echoing operator input. */
export function bootstrapChecksum(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) fail("BOOTSTRAP_PLAN_MISMATCH");
}

/** Enforce transaction bounds before staging or applying bootstrap records. */
export function bootstrapBatch(values: unknown[], limit = bootstrapBatchSize) {
  if (!values.length || values.length > limit) fail("BOOTSTRAP_BATCH_LIMIT");
  bounded(values, 256 * 1024);
}

/** Require a reviewed target URL; enabling the bootstrap window is separate. */
export function requireKnownBootstrapTarget(target: string) {
  const targets: Readonly<Record<string, string>> = approvedImportTargets;
  const url = Object.hasOwn(targets, target) ? targets[target] : undefined;
  if (!url || env.CONVEX_CLOUD_URL !== url) fail("BOOTSTRAP_TARGET_DISABLED");
  return url;
}

/** Require the reviewed target and an explicitly enabled bootstrap window. */
export function requireBootstrapTarget(target: string) {
  const url = requireKnownBootstrapTarget(target);
  if (process.env.SEED_BOOTSTRAP_ENABLED !== "true")
    fail("BOOTSTRAP_TARGET_DISABLED");
  return url;
}

/** Validate the pinned plan against the frozen one-time bootstrap policy. */
export async function assertBootstrapPlan(args: {
  planChecksum: string;
  inventoryHash: string;
  manifests: Infer<typeof manifestPin>[];
}) {
  bootstrapChecksum(args.planChecksum);
  bootstrapChecksum(args.inventoryHash);
  if (
    args.planChecksum !== bootstrapPlanChecksum ||
    args.inventoryHash !== bootstrapInventoryChecksum
  )
    fail("BOOTSTRAP_PLAN_MISMATCH");
  const policy = seedBootstrapPolicy;
  const manifests = args.manifests;
  if (
    manifests.length !== policy.families ||
    new Set(manifests.map((pin) => pin.family)).size !== policy.families
  )
    fail("BOOTSTRAP_POLICY_MISMATCH");
  let questions = 0,
    references = 0,
    assets = 0;
  for (const pin of manifests) {
    if (
      !Number.isSafeInteger(pin.family) ||
      pin.family < 1 ||
      pin.family > policy.families ||
      pin.questions !== policy.perFamilyQuestions ||
      !pin.corpusId.trim() ||
      !Number.isSafeInteger(pin.revision) ||
      pin.revision < 1 ||
      !/^[a-f0-9]{64}$/.test(pin.checksum) ||
      pin.taxonomyId !== "cse-taxonomy-2027-v2" ||
      pin.blueprintIds.join(",") !==
        "cse-professional-2027-v3,cse-subprofessional-2027-v3" ||
      [pin.references, pin.assets].some(
        (n) => !Number.isSafeInteger(n) || n < 0,
      )
    )
      fail("BOOTSTRAP_POLICY_MISMATCH");
    questions += pin.questions;
    references += pin.references;
    assets += pin.assets;
  }
  if (
    questions !== policy.expectedQuestions ||
    references !== policy.expectedReferences ||
    assets !== policy.expectedAssets
  )
    fail("BOOTSTRAP_POLICY_MISMATCH");
  if (
    (await digest({
      manifests,
      inventoryHash: args.inventoryHash,
    })) !== args.planChecksum
  )
    fail("BOOTSTRAP_PLAN_MISMATCH");
}

/** Resolve a non-login system identity, creating it once on first use. */
export async function ensureSystemUser(
  ctx: MutationCtx,
  tokenIdentifier: string,
) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
  if (existing) {
    if (existing.role !== "system" || existing.status !== "active")
      fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
    return existing;
  }
  const id = await ctx.db.insert("users", {
    tokenIdentifier,
    role: "system",
    status: "active",
  });
  const user = await ctx.db.get("users", id);
  if (!user) fail("BOOTSTRAP_SYSTEM_ACTOR_REQUIRED");
  return user;
}

/** Load one bootstrap run and require its exact target. */
export async function bootstrapRun(
  ctx: Pick<QueryCtx, "db">,
  args: { runId: Id<"questionImportRuns">; target: string },
) {
  requireKnownBootstrapTarget(args.target);
  const run = await ctx.db.get("questionImportRuns", args.runId);
  if (!run || run.mode !== "bootstrap" || run.target !== args.target)
    fail("BOOTSTRAP_TARGET_CONFLICT");
  return run;
}

/** Fence bootstrap mutations against expired, superseded, or competing workers. */
export async function bootstrapLeasedRun(
  ctx: Pick<QueryCtx, "db">,
  args: {
    runId: Id<"questionImportRuns">;
    target: string;
    generation: number;
  },
  options: { allowComplete?: boolean } = {},
) {
  requireBootstrapTarget(args.target);
  const run = await bootstrapRun(ctx, args);
  if (run.generation !== args.generation) fail("BOOTSTRAP_LEASE_LOST");
  if (run.state === "complete") {
    if (options.allowComplete) return run;
    fail("BOOTSTRAP_LEASE_LOST");
  }
  if (run.state !== "running" && run.state !== "preparing")
    fail("BOOTSTRAP_LEASE_LOST");
  if (run.leaseUntil <= Date.now()) fail("BOOTSTRAP_LEASE_LOST");
  const active = await ctx.db
    .query("questionImportRuns")
    .withIndex("by_targetUrl_and_leaseUntil", (q) =>
      q.eq("targetUrl", run.targetUrl).gt("leaseUntil", Date.now()),
    )
    .take(2);
  if (active.some((other) => other._id !== run._id))
    fail("BOOTSTRAP_LEASE_LOST");
  return run;
}

/** Project the acceptance evidence recorded for each bootstrap-published item. */
export function bootstrapAssessment(run: Doc<"questionImportRuns">) {
  const policy = seedBootstrapPolicy;
  return [
    {
      passed: true,
      evidence: `Plan ${run.planChecksum} processed the pinned ${run.expected}-record inventory.`,
    },
    {
      passed: true,
      evidence: `Inventory checksum ${run.inventoryHash} matches the reviewed initial corpus.`,
    },
    {
      passed: true,
      evidence: `Policy: ${policy.families} families x ${policy.perFamilyQuestions} questions = ${policy.expectedQuestions}; ${policy.expectedReferences} references; ${policy.expectedAssets} images.`,
    },
    {
      passed: true,
      evidence:
        "Question content and its exact reference were revalidated against the sealed taxonomy before publication.",
    },
    {
      passed: true,
      evidence: `Acceptor is the non-login system approver, distinct from the system importer ${run.ownerId}.`,
    },
  ];
}

/** Keep bootstrap-published versions attributable without changing learner output. */
export function bootstrapReviewReason(run: Doc<"questionImportRuns">) {
  return `One-time developer bootstrap acceptance for plan ${run.planChecksum} under ADR 0022.`;
}

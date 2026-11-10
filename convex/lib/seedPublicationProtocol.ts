import { v, type Infer } from "convex/values";
import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  approvedImportTargets,
  seedPublicationBatchSize,
  seedPublicationPolicy,
} from "../../lib/question-import-contract.mjs";
import { requireAdmin } from "./auth";
import { bounded } from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";

export const seedLeaseMs = 5 * 60 * 1000;
export const seedRunStates = v.union(
  v.literal("preparing"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("complete"),
  v.literal("rolled_back"),
);
export type SeedRunState = Infer<typeof seedRunStates>;
export const seedItemStates = v.union(
  v.literal("staged"),
  v.literal("submitted"),
  v.literal("approved"),
  v.literal("published"),
  v.literal("rolled_back"),
);
export type SeedItemState = Infer<typeof seedItemStates>;

export const seedRunFields = {
  target: v.string(),
  targetUrl: v.string(),
  importRunId: v.id("questionImportRuns"),
  planChecksum: v.string(),
  inventoryHash: v.string(),
  importerId: v.id("users"),
  approverId: v.id("users"),
  expected: v.number(),
  staged: v.number(),
  submitted: v.number(),
  approved: v.number(),
  published: v.number(),
  rolledBack: v.number(),
  stagedCounts: v.array(
    v.object({
      family: v.number(),
      questions: v.number(),
    }),
  ),
  state: seedRunStates,
  generation: v.number(),
  leaseUntil: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastFailure: v.optional(v.string()),
  rollbackReason: v.optional(v.string()),
};
export const seedItemFields = {
  runId: v.id("seedPublicationRuns"),
  ordinal: v.number(),
  importOrdinal: v.number(),
  questionVersionId: v.id("questionVersions"),
  questionId: v.id("questions"),
  family: v.number(),
  sourceId: v.string(),
  sourceChecksum: v.string(),
  state: seedItemStates,
  approvalId: v.optional(v.id("questionReviews")),
  failureCode: v.optional(v.string()),
  stagedAt: v.number(),
  transitionedAt: v.number(),
};

export const seedAccess = {
  runId: v.id("seedPublicationRuns"),
  target: v.string(),
  generation: v.number(),
};

/** Reject malformed digests without echoing operator input. */
export function seedChecksum(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) fail("SEED_PLAN_MISMATCH");
}

/** Require the reviewed development target and an explicitly enabled seed switch. */
export function requireSeedTarget(target: string) {
  const targets: Readonly<Record<string, string>> = approvedImportTargets;
  const url = Object.hasOwn(targets, target) ? targets[target] : undefined;
  if (
    !url ||
    process.env.SEED_PUBLICATION_ENABLED !== "true" ||
    env.CONVEX_CLOUD_URL !== url
  )
    fail("SEED_TARGET_DISABLED");
  return url;
}

/** Enforce transaction bounds before staging or transitioning seed items. */
export function seedBatch(values: unknown[], limit = seedPublicationBatchSize) {
  if (!values.length || values.length > limit) fail("SEED_BATCH_LIMIT");
  bounded(values, 16384);
}

/** Validate the completed import plan against the frozen one-time seed policy. */
export function assertSeedManifests(
  manifests: Array<{
    family: number;
    questions: number;
    references: number;
    assets: number;
    corpusId: string;
    revision: number;
    checksum: string;
    taxonomyId: string;
    blueprintIds: string[];
  }>,
) {
  const policy = seedPublicationPolicy;
  if (
    manifests.length !== policy.families ||
    new Set(manifests.map((pin) => pin.family)).size !== policy.families
  )
    fail("SEED_POLICY_MISMATCH");
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
      fail("SEED_POLICY_MISMATCH");
    questions += pin.questions;
    references += pin.references;
    assets += pin.assets;
  }
  if (
    questions !== policy.expectedQuestions ||
    references !== policy.expectedReferences ||
    assets !== policy.expectedAssets
  )
    fail("SEED_POLICY_MISMATCH");
}

/** Resolve the operator-nominated approver without trusting a client-supplied ID. */
export async function resolveSeedApprover(
  ctx: Pick<MutationCtx, "db">,
  importerId: Id<"users">,
) {
  const tokenIdentifier = process.env.SEED_PUBLICATION_APPROVER;
  if (!tokenIdentifier?.trim()) fail("SEED_APPROVER_MISMATCH");
  const approver = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
  if (
    !approver ||
    approver.role !== "admin" ||
    approver.status !== "active" ||
    approver._id === importerId
  )
    fail("SEED_APPROVER_MISMATCH");
  return approver;
}

/** Load one seed run for an active participant. The target is not client authority. */
export async function seedRunForActor(
  ctx: Pick<QueryCtx, "auth" | "db">,
  args: { runId: Id<"seedPublicationRuns">; target: string },
  role: "importer" | "approver" | "either" = "either",
) {
  requireSeedTarget(args.target);
  const actor = await requireAdmin(ctx);
  const run = await ctx.db.get("seedPublicationRuns", args.runId);
  if (!run || run.target !== args.target) fail("SEED_RUN_FORBIDDEN");
  if (
    (role === "importer" && actor._id !== run.importerId) ||
    (role === "approver" && actor._id !== run.approverId) ||
    (role === "either" &&
      actor._id !== run.importerId &&
      actor._id !== run.approverId)
  )
    fail("SEED_RUN_FORBIDDEN");
  return { actor, run };
}

/** Fence seed mutations against expired, superseded, or competing workers. */
export async function seedLeasedRun(
  ctx: MutationCtx,
  args: {
    runId: Id<"seedPublicationRuns">;
    target: string;
    generation: number;
  },
  role: "importer" | "approver",
) {
  const { actor, run } = await seedRunForActor(ctx, args, role);
  if (run.generation !== args.generation) fail("SEED_LEASE_LOST");
  if (run.state === "complete" || run.state === "rolled_back")
    fail("SEED_INVALID_STATE");
  if (run.state === "paused") fail("SEED_LEASE_LOST");
  if (run.leaseUntil <= Date.now()) fail("SEED_LEASE_LOST");
  const active = await ctx.db
    .query("seedPublicationRuns")
    .withIndex("by_targetUrl_and_leaseUntil", (q) =>
      q.eq("targetUrl", run.targetUrl).gt("leaseUntil", Date.now()),
    )
    .take(2);
  if (active.some((other) => other._id !== run._id)) fail("SEED_LEASE_LOST");
  return { actor, run };
}

/** Keep ordinary lifecycle operations off versions reserved by an active seed run. */
export async function assertSeedLifecycleFree(
  ctx: Pick<MutationCtx, "db">,
  questionVersionId: Id<"questionVersions">,
) {
  const pins = await ctx.db
    .query("seedPublicationItems")
    .withIndex("by_questionVersionId", (q) =>
      q.eq("questionVersionId", questionVersionId),
    )
    .take(2);
  if (!pins.length) return;
  if (pins.length !== 1) fail("SEED_PUBLICATION_REQUIRED");
  const run = await ctx.db.get("seedPublicationRuns", pins[0].runId);
  if (!run || (run.state !== "complete" && run.state !== "rolled_back"))
    fail("SEED_PUBLICATION_REQUIRED");
}

/** Refuse serving a pinned version until the whole seed publication is complete. */
export async function assertSeedServingComplete(
  ctx: Pick<QueryCtx, "db">,
  questionVersionId: Id<"questionVersions">,
) {
  const pins = await ctx.db
    .query("seedPublicationItems")
    .withIndex("by_questionVersionId", (q) =>
      q.eq("questionVersionId", questionVersionId),
    )
    .take(2);
  if (!pins.length) return;
  if (pins.length !== 1) fail("QUESTION_UNAVAILABLE");
  const run = await ctx.db.get("seedPublicationRuns", pins[0].runId);
  if (!run || run.state !== "complete" || pins[0].state !== "published")
    fail("QUESTION_UNAVAILABLE");
}

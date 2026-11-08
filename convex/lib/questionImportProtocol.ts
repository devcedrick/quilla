import { v, type Infer } from "convex/values";
import { env } from "../_generated/server";
import {
  questionContent,
  referenceContent,
  provenance,
  bounded,
  positive,
} from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";
import {
  approvedImportTargets,
  importBatchBytes,
  importBatchSize,
} from "../../lib/question-import-contract.mjs";

const sourceBlocks = v.array(
  v.union(
    v.object({ type: v.literal("text"), text: v.string() }),
    v.object({
      type: v.literal("table"),
      caption: v.string(),
      headers: v.array(v.string()),
      rows: v.array(v.array(v.string())),
    }),
    v.object({
      type: v.literal("image"),
      assetId: v.string(),
      caption: v.string(),
      alt: v.string(),
      description: v.string(),
    }),
  ),
);
export const sourceQuestion = questionContent.extend({
  questionId: v.string(),
  version: v.number(),
  reference: v.optional(
    v.object({ referenceId: v.string(), referenceVersion: v.number() }),
  ),
});
export const sourceReference = referenceContent.omit("blocks").extend({
  referenceId: v.string(),
  version: v.number(),
  blocks: sourceBlocks,
});
export const sourceAsset = v.object({
  assetId: v.string(),
  path: v.string(),
  sha256: v.string(),
  mediaType: v.union(v.literal("image/png"), v.literal("image/webp")),
  width: v.number(),
  height: v.number(),
  provenance,
});
export const sourceRecord = v.union(
  v.object({ kind: v.literal("asset"), value: sourceAsset }),
  v.object({ kind: v.literal("reference"), value: sourceReference }),
  v.object({ kind: v.literal("question"), value: sourceQuestion }),
);
export type SourceRecord = Infer<typeof sourceRecord>;
export const manifestPin = v.object({
  corpusId: v.string(),
  revision: v.number(),
  checksum: v.string(),
  family: v.number(),
  taxonomyId: v.string(),
  blueprintIds: v.array(v.string()),
  questions: v.number(),
  references: v.number(),
  assets: v.number(),
});
export const descriptor = v.object({
  ordinal: v.number(),
  kind: v.union(
    v.literal("asset"),
    v.literal("reference"),
    v.literal("question"),
  ),
  sourceId: v.string(),
  version: v.number(),
  family: v.number(),
  sourceChecksum: v.string(),
});
export type Descriptor = Infer<typeof descriptor>;
export const runFields = {
  target: v.string(),
  targetUrl: v.string(),
  ownerId: v.id("users"),
  planChecksum: v.string(),
  inventoryHash: v.string(),
  chain: v.string(),
  manifests: v.array(manifestPin),
  expected: v.number(),
  staged: v.number(),
  processed: v.number(),
  state: v.union(
    v.literal("preparing"),
    v.literal("running"),
    v.literal("complete"),
  ),
  generation: v.number(),
  leaseUntil: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  stagedCounts: v.array(
    v.object({
      family: v.number(),
      questions: v.number(),
      references: v.number(),
      assets: v.number(),
    }),
  ),
  lastFailure: v.optional(v.string()),
};
export const entryFields = {
  runId: v.id("questionImportRuns"),
  ...descriptor.fields,
  state: v.union(v.literal("pending"), v.literal("done")),
  outcome: v.optional(v.union(v.literal("created"), v.literal("reused"))),
  resultId: v.optional(v.string()),
  failureCode: v.optional(v.string()),
};
export const runAccess = {
  runId: v.id("questionImportRuns"),
  generation: v.number(),
  target: v.string(),
};

/** Reject malformed digest values without echoing user data. */
export function checksum(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) fail("INVALID_IMPORT_CHECKSUM");
}
/** Enforce metadata transaction bounds before performing reads or writes. */
export function batch(values: unknown[]) {
  if (!values.length || values.length > importBatchSize)
    fail("IMPORT_BATCH_LIMIT");
  bounded(values, importBatchBytes);
}
/** Require a reviewed development target and an explicitly enabled backend. */
export function requireImportTarget(target: string) {
  const targets: Readonly<Record<string, string>> = approvedImportTargets;
  const url = Object.hasOwn(targets, target) ? targets[target] : undefined;
  // CONVEX_CLOUD_URL is a typed platform value. The operator switch remains a
  // runtime variable until a separately reviewed typed env declaration exists.
  if (
    !url ||
    process.env.QUESTION_BANK_IMPORT_ENABLED !== "true" ||
    env.CONVEX_CLOUD_URL !== url
  )
    fail("IMPORT_TARGET_DISABLED");
  return url;
}
/** Validate the source identity and version independently of any client labels. */
export function validateDescriptor(d: Descriptor) {
  positive(d.ordinal + 1);
  positive(d.family);
  checksum(d.sourceChecksum);
  if (
    d.family > 7 ||
    !/^[a-z][a-z0-9_-]{0,99}$/.test(d.sourceId) ||
    (d.kind === "asset"
      ? d.version !== 0
      : !Number.isSafeInteger(d.version) || d.version < 1)
  )
    fail("INVALID_IMPORT_ENTRY");
}

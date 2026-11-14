// Deliberately empty: adding a deployment requires a separately reviewed change.
export const approvedImportTargets = Object.freeze({});
export const importBatchSize = 10;
export const importBatchBytes = 256 * 1024;
export const importLeaseMs = 5 * 60 * 1000;
export const importChainStart = "0".repeat(64);
export const bulkModerationBatchSize = 10;
export const bootstrapStageBatchSize = 50;
export const bootstrapBatchSize = 10;
/** The one-time seed bootstrap is bound to this exact corpus shape. */
export const seedBootstrapPolicy = Object.freeze({
  families: 7,
  perFamilyQuestions: 270,
  expectedQuestions: 1890,
  expectedReferences: 265,
  expectedAssets: 59,
});
/** Frozen offline plan and inventory checksums for the reviewed initial corpus. */
export const bootstrapPlanChecksum =
  "71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38";
export const bootstrapInventoryChecksum =
  "c793d1fa22c9db9de587924f8ba55686001a54ade0ebce3ae1386488ea5f11e0";
const failureCodes = new Set([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_UNAVAILABLE",
  "PROFILE_REQUIRED",
  "VALIDATION_FAILED",
  "CONTENT_CONFLICT",
  "STALE_REVISION",
  "UNVERIFIED_ASSET",
  "ASSET_NOT_FOUND",
  "REFERENCE_NOT_FOUND",
  "TAXONOMY_UNAVAILABLE",
  "UNKNOWN_TAXONOMY_ENTRY",
  "INVALID_ELIGIBILITY",
  "INVALID_TAXONOMY_PATH",
  "MISSING_PARENT",
  "INCOMPLETE_CATALOG",
  "CATALOG_LIMIT",
  "INVALID_IMPORT_CHECKSUM",
  "INVALID_IMPORT_ENTRY",
  "INVALID_IMPORT_PLAN",
  "IMPORT_TARGET_DISABLED",
  "IMPORT_TARGET_NOT_APPROVED",
  "IMPORT_TOKEN_REQUIRED",
  "IMPORT_BATCH_LIMIT",
  "IMPORT_SOURCE_CHANGED",
  "IMPORT_RUN_FORBIDDEN",
  "IMPORT_LEASE_LOST",
  "IMPORT_ORDER",
  "IMPORT_BUSY",
  "IMPORT_NOT_PREPARING",
  "IMPORT_NOT_RUNNING",
  "IMPORT_DUPLICATE_ID",
  "IMPORT_ASSET_BATCH",
  "IMPORT_PLAN_MISMATCH",
  "IMPORT_PROGRESS_STALLED",
  "IMPORT_INCOMPLETE_PREFLIGHT",
  "IMPORT_INVALID_CHECKPOINT",
  "IMPORT_TARGET_CONFLICT",
  "IMPORT_INVALID_ARGUMENTS",
  "IMPORT_RECORD_TOO_LARGE",
  "IMPORT_OFFLINE_VALIDATION_FAILED",
  "IMPORT_REQUIRES_SINGLE_FAMILY_MANIFEST",
  "IMPORT_REQUIRES_SEVEN_COMPLETE_FAMILIES",
  "IMPORT_CROSS_FAMILY_ID_CONFLICT",
  "IMPORT_OPERATION_FAILED",
]);
const bootstrapFailureCodes = new Set([
  "BOOTSTRAP_TARGET_DISABLED",
  "BOOTSTRAP_PLAN_MISMATCH",
  "BOOTSTRAP_POLICY_MISMATCH",
  "BOOTSTRAP_TARGET_CONFLICT",
  "BOOTSTRAP_BUSY",
  "BOOTSTRAP_LEASE_LOST",
  "BOOTSTRAP_PAUSED",
  "BOOTSTRAP_NOT_PREPARING",
  "BOOTSTRAP_NOT_RUNNING",
  "BOOTSTRAP_NOT_PAUSED",
  "BOOTSTRAP_INVALID_STATE",
  "BOOTSTRAP_BATCH_LIMIT",
  "BOOTSTRAP_ORDER",
  "BOOTSTRAP_ITEM_UNAVAILABLE",
  "BOOTSTRAP_ALREADY_ROLLED_BACK",
  "BOOTSTRAP_ROLLBACK_ORDER",
  "BOOTSTRAP_INVALID_CHECKPOINT",
  "BOOTSTRAP_INVALID_ARGUMENTS",
  "BOOTSTRAP_SYSTEM_ACTOR_REQUIRED",
  "BOOTSTRAP_OPERATION_FAILED",
]);

/** Restrict reports and stored failures to known codes rather than raw error messages. */
export function safeImportFailure(code) {
  return failureCodes.has(code) ? code : "IMPORT_OPERATION_FAILED";
}

/** Sanitize bootstrap reports, optionally passing through known import codes. */
export function safeBootstrapFailure(code) {
  if (bootstrapFailureCodes.has(code)) return code;
  return failureCodes.has(code) ? code : "BOOTSTRAP_OPERATION_FAILED";
}

/** Serialize portable authoring values without database IDs or key-order drift. */
export function importCanonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(importCanonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${importCanonical(value[key])}`)
    .join(",")}}`;
}

/** Compute a portable source or plan checksum in Node and the Convex runtime. */
export async function importDigest(value) {
  const bytes = new TextEncoder().encode(importCanonical(value));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

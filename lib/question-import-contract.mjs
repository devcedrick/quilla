// Deliberately empty: adding a deployment requires a separately reviewed change.
export const approvedImportTargets = Object.freeze({});
export const importBatchSize = 10;
export const importBatchBytes = 256 * 1024;
export const importChainStart = "0".repeat(64);
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

/** Restrict reports and stored failures to known codes rather than raw error messages. */
export function safeImportFailure(code) {
  return failureCodes.has(code) ? code : "IMPORT_OPERATION_FAILED";
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

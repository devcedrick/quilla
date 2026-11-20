import { ConvexError } from "convex/values";

const messages: Record<string, string> = {
  CONTENT_CONFLICT:
    "This content conflicts with an existing immutable question or reference.",
  DUPLICATE_OVERFLOW:
    "Too many duplicate candidates can be scanned safely. Approval is blocked until the duplicate set is reduced.",
  DUPLICATE_RECHECK_REQUIRED:
    "The duplicate candidate set changed after approval. Record an independent recheck before publishing.",
  FORBIDDEN: "Your account is not allowed to perform this action.",
  INVALID_PAGE_SIZE: "The requested page size is not supported.",
  INVALID_TRANSITION:
    "This action is no longer allowed for the version's current state.",
  INVALID_BATCH: "The requested batch is not allowed.",
  QUESTION_NOT_FOUND: "The question version could not be found.",
  REASON_REQUIRED:
    "A nonblank reason is required to request revisions or reject a version.",
  SELF_REVIEW:
    "The contributor and version creator cannot review their own question.",
  STALE_REVISION:
    "This version changed while you were working. Review the latest state and try again.",
  TAXONOMY_UNAVAILABLE:
    "The selected taxonomy catalog is not available for authoring.",
  UNVERIFIED_ASSET:
    "A shared reference image is not verified. Verify the asset before continuing.",
  VALIDATION_FAILED:
    "The server rejected these values. Check the required fields and try again.",
  OPERATION_FAILED: "The operation could not be completed. Please try again.",
};

/** Extract only stable domain codes; never render raw provider details. */
export function adminErrorCode(error: unknown) {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (
    data &&
    typeof data === "object" &&
    "code" in data &&
    typeof data.code === "string" &&
    /^[A-Z][A-Z0-9_]{0,63}$/u.test(data.code)
  )
    return data.code;
  return null;
}

export function adminErrorMessage(error: unknown, fallback: string) {
  const code = adminErrorCode(error);
  return (code && messages[code]) || fallback;
}

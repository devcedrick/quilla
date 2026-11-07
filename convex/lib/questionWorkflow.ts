import { ConvexError, v, type Infer } from "convex/values";

export const questionState = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("needs_revision"),
  v.literal("approved"),
  v.literal("published"),
  v.literal("rejected"),
  v.literal("archived"),
);
export type QuestionState = Infer<typeof questionState>;
const reviewCommon = {
  questionVersionId: v.id("questionVersions"),
  reviewerId: v.id("users"),
  expectedRevision: v.number(),
  resultingRevision: v.number(),
  reason: v.string(),
  rubric: v.literal("editorial-quality-v1"),
  duplicateDisposition: v.union(
    v.literal("none_found"),
    v.literal("adjudicated_distinct"),
    v.literal("unresolved"),
  ),
  duplicateEvidence: v.string(),
  candidateFingerprint: v.string(),
  decidedAt: v.number(),
};
export const questionReview = v.union(
  v.object({
    ...reviewCommon,
    kind: v.literal("review"),
    decision: v.union(
      v.literal("approve"),
      v.literal("needs_revision"),
      v.literal("reject"),
    ),
    assessment: v.array(
      v.object({ passed: v.boolean(), evidence: v.string() }),
    ),
    score: v.number(),
  }),
  v.object({
    ...reviewCommon,
    kind: v.literal("duplicate_recheck"),
    decision: v.literal("duplicate_recheck"),
  }),
);
type Transition =
  "submit" | "approve" | "needs_revision" | "reject" | "publish" | "archive";
const transitions: Record<
  Transition,
  Partial<Record<QuestionState, QuestionState>>
> = {
  submit: { draft: "pending_review" },
  approve: { pending_review: "approved" },
  needs_revision: { pending_review: "needs_revision" },
  reject: { pending_review: "rejected" },
  publish: { approved: "published" },
  archive: { approved: "archived", published: "archived" },
};

export function questionWorkflowError(code: string): never {
  throw new ConvexError({
    code,
    message: "Question operation rejected: " + code,
  });
}

/** Domain mutations must authorize and persist this result in one transaction. */
export function nextQuestionState(
  current: QuestionState,
  revision: number,
  expectedRevision: number,
  action: Transition,
  reason?: string,
) {
  if (!Number.isSafeInteger(expectedRevision) || revision !== expectedRevision)
    questionWorkflowError("STALE_REVISION");
  const next = transitions[action][current];
  if (!next) questionWorkflowError("INVALID_TRANSITION");
  if ((action === "reject" || action === "needs_revision") && !reason?.trim())
    questionWorkflowError("REASON_REQUIRED");
  return { state: next, workflowRevision: revision + 1 };
}

export function assertIndependentReviewer(
  reviewerId: string,
  contributorId: string,
  versionCreatorId: string,
) {
  if (reviewerId === contributorId || reviewerId === versionCreatorId)
    questionWorkflowError("SELF_REVIEW");
}

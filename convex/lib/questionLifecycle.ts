import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin } from "./auth";
import { appendAdminAudit } from "./audit";
import {
  nextQuestionState,
  questionWorkflowError as fail,
} from "./questionWorkflow";
import { assertSeedLifecycleFree } from "./seedPublicationProtocol";

export const workflowArgs = {
  questionVersionId: v.id("questionVersions"),
  expectedWorkflowRevision: v.number(),
};
export type WorkflowArgs = {
  questionVersionId: Id<"questionVersions">;
  expectedWorkflowRevision: number;
};
type Transition = Parameters<typeof nextQuestionState>[3];

/** Load the exact version at its expected revision, including the seed-run fence. */
export async function loadWorkflow(
  ctx: MutationCtx,
  args: WorkflowArgs,
  actor?: Doc<"users">,
) {
  const admin = actor ?? (await requireAdmin(ctx));
  const version = await ctx.db.get("questionVersions", args.questionVersionId);
  if (!version) fail("QUESTION_NOT_FOUND");
  if (
    !Number.isSafeInteger(args.expectedWorkflowRevision) ||
    args.expectedWorkflowRevision !== version.workflowRevision
  )
    fail("STALE_REVISION");
  const question = await ctx.db.get("questions", version.questionId);
  if (!question) fail("QUESTION_NOT_FOUND");
  await assertSeedLifecycleFree(ctx, version._id);
  return { actor: admin, version, question };
}

/** Atomically transition workflow state and append its admin audit event. */
export async function changeWorkflow(
  ctx: MutationCtx,
  version: Doc<"questionVersions">,
  action: Transition,
  reason?: string,
) {
  const next = nextQuestionState(
    version.state,
    version.workflowRevision,
    version.workflowRevision,
    action,
    reason,
  );
  await ctx.db.patch("questionVersions", version._id, next);
  await appendAdminAudit(ctx, {
    entityType: "question_version",
    entityId: version._id,
    action,
    before: { state: version.state, revision: version.workflowRevision },
    after: { state: next.state, revision: next.workflowRevision },
  });
  return next.workflowRevision;
}

/** Return only stable application error codes, never raw transport messages. */
export function safeWorkflowFailure(error: unknown) {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (
      data &&
      typeof data === "object" &&
      "code" in data &&
      typeof data.code === "string" &&
      /^[A-Z][A-Z0-9_]{0,63}$/.test(data.code)
    )
      return data.code;
  }
  return "OPERATION_FAILED";
}

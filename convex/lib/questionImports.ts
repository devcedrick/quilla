import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin } from "./auth";
import { appendActorAudit } from "./audit";
import {
  validateQuestion,
  type QuestionContent,
  positive,
  text,
} from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";

/** Trusted integration only: callers provide validated source metadata, never authority.
 * `validatedHashes` may only be supplied by `resolveQuestion` for the same input. */
export async function importQuestionDraft(
  ctx: MutationCtx,
  input: {
    questionId: string;
    version: number;
    content: QuestionContent;
    taxonomyVersionId: Id<"taxonomyVersions">;
    referenceVersionId?: Id<"questionReferenceVersions">;
  },
  validatedHashes?: { contentHash: string; contentFingerprint: string },
  options: {
    actor?: Doc<"users">;
    bootstrapRunId?: Id<"questionImportRuns">;
  } = {},
) {
  const actor = options.actor ?? (await requireAdmin(ctx));
  if (actor.role !== "admin" && actor.role !== "system") fail("FORBIDDEN");
  positive(input.version);
  text(input.questionId);
  if (input.questionId.length > 100) fail("VALIDATION_FAILED");
  const hashes =
    validatedHashes ??
    (await validateQuestion(
      ctx,
      input.content,
      input.taxonomyVersionId,
      input.referenceVersionId,
    ));
  let question = await ctx.db
    .query("questions")
    .withIndex("by_questionId", (q) => q.eq("questionId", input.questionId))
    .unique();
  if (question) {
    const existing = await ctx.db
      .query("questionVersions")
      .withIndex("by_questionId_and_version", (q) =>
        q.eq("questionId", question!._id).eq("version", input.version),
      )
      .unique();
    if (existing) {
      if (existing.contentHash !== hashes.contentHash) fail("CONTENT_CONFLICT");
      return {
        questionId: question._id,
        questionVersionId: existing._id,
        created: false,
      };
    }
    if (
      question.family !== input.content.family ||
      input.version <= question.latestVersion
    )
      fail("CONTENT_CONFLICT");
    await ctx.db.patch("questions", question._id, {
      latestVersion: input.version,
      revision: question.revision + 1,
    });
  } else {
    const id = await ctx.db.insert("questions", {
      questionId: input.questionId,
      contributorId: actor._id,
      family: input.content.family,
      latestVersion: input.version,
      revision: 1,
      createdAt: Date.now(),
    });
    question = await ctx.db.get("questions", id);
  }
  if (!question) fail("QUESTION_NOT_FOUND");
  const questionVersionId = await ctx.db.insert("questionVersions", {
    questionId: question._id,
    version: input.version,
    content: input.content,
    taxonomyVersionId: input.taxonomyVersionId,
    ...(input.referenceVersionId
      ? { referenceVersionId: input.referenceVersionId }
      : {}),
    ...hashes,
    creatorId: actor._id,
    createdAt: Date.now(),
    state: "draft",
    workflowRevision: 1,
    ...(options.bootstrapRunId
      ? { bootstrapRunId: options.bootstrapRunId }
      : {}),
  });
  await appendActorAudit(ctx, actor, {
    entityType: "question_version",
    entityId: questionVersionId,
    action: "import_draft",
    before: null,
    after: {
      questionId: input.questionId,
      version: input.version,
      contentHash: hashes.contentHash,
    },
  });
  return { questionId: question._id, questionVersionId, created: true };
}

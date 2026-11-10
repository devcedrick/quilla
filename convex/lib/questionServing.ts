import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { validateQuestion } from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";
import { assertSeedServingComplete } from "./seedPublicationProtocol";

/** Trusted selector primitive. The caller must authorize the assessment operation. */
export async function loadPublishedQuestion(
  ctx: Pick<QueryCtx, "db">,
  id: Id<"questionVersions">,
) {
  const version = await ctx.db.get("questionVersions", id);
  if (!version || version.state !== "published" || !version.approvalDecisionId)
    fail("QUESTION_UNAVAILABLE");
  await assertSeedServingComplete(ctx, version._id);
  const verified = await validateQuestion(
    ctx,
    version.content,
    version.taxonomyVersionId,
    version.referenceVersionId,
  );
  if (verified.contentHash !== version.contentHash) fail("CONTENT_CONFLICT");
  const reference = version.referenceVersionId
    ? await ctx.db.get("questionReferenceVersions", version.referenceVersionId)
    : null;
  // Explicit projection: never return answer keys, explanations, raw provenance or storage IDs.
  return {
    questionVersionId: version._id,
    canonicalQuestionId: version.questionId,
    version: version.version,
    stem: version.content.stem,
    choices: version.content.choices.map((c) => ({
      choiceId: c.choiceId,
      text: c.text,
    })),
    subjectId: version.content.subjectId,
    subtopicId: version.content.subtopicId,
    conceptId: version.content.conceptId,
    language: version.content.language,
    difficulty: version.content.difficulty,
    levelApplicability: version.content.levelApplicability,
    referenceVersionId: version.referenceVersionId ?? null,
    reference: reference
      ? { title: reference.content.title, blocks: reference.content.blocks }
      : null,
  };
}

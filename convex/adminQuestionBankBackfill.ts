import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  buildQuestionSearchProjection,
  buildReferenceScopeFields,
} from "./lib/questionSearchProjection";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";

const backfillArgs = {
  cursor: v.union(v.string(), v.null()),
  batchSize: v.optional(v.number()),
};
const backfillResult = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  scanned: v.number(),
  updated: v.number(),
});

/**
 * Staged rollout helper. The projection and reference scope stay optional in
 * the schema until an operator runs these internal batches against an approved
 * deployment and then makes the fields required in a later change.
 *
 * This module is not scheduled or invoked by the application.
 */
export const backfillQuestionSearchProjection = internalMutation({
  args: backfillArgs,
  returns: backfillResult,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 25;
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
      fail("VALIDATION_FAILED");
    const page = await ctx.db
      .query("questionVersions")
      .order("asc")
      .paginate({ numItems: batchSize, cursor: args.cursor });
    let updated = 0;
    for (const version of page.page) {
      if (version.searchText !== undefined) continue;
      const question = await ctx.db.get("questions", version.questionId);
      if (!question) fail("QUESTION_NOT_FOUND");
      await ctx.db.patch(
        "questionVersions",
        version._id,
        buildQuestionSearchProjection(
          version.content,
          question.questionId,
          question.contributorId,
        ),
      );
      updated += 1;
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
      updated,
    };
  },
});

/** Backfill the immutable reference scope after an approved schema push. */
export const backfillReferenceScope = internalMutation({
  args: backfillArgs,
  returns: backfillResult,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 25;
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
      fail("VALIDATION_FAILED");
    const page = await ctx.db
      .query("questionReferenceVersions")
      .order("asc")
      .paginate({ numItems: batchSize, cursor: args.cursor });
    let updated = 0;
    for (const reference of page.page) {
      if (reference.family !== undefined) continue;
      await ctx.db.patch(
        "questionReferenceVersions",
        reference._id,
        buildReferenceScopeFields(reference.content),
      );
      updated += 1;
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
      updated,
    };
  },
});

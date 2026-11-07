import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { referenceContent } from "./lib/questionContent";
import { createReferenceDraft } from "./lib/questionReferenceDrafts";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";

export const createReferenceVersion = mutation({
  args: {
    referenceId: v.string(),
    expectedLatestVersion: v.number(),
    content: referenceContent,
  },
  returns: v.id("questionReferenceVersions"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (
      !Number.isSafeInteger(args.expectedLatestVersion) ||
      args.expectedLatestVersion < 0
    )
      fail("VALIDATION_FAILED");
    const previous = await ctx.db
      .query("questionReferenceVersions")
      .withIndex("by_referenceId_and_version", (q) =>
        q.eq("referenceId", args.referenceId),
      )
      .order("desc")
      .first();
    if ((previous?.version ?? 0) !== args.expectedLatestVersion)
      fail("STALE_REVISION");
    return createReferenceDraft(
      ctx,
      {
        referenceId: args.referenceId,
        version: args.expectedLatestVersion + 1,
        content: args.content,
      },
      false,
    );
  },
});

import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";
import { requireAdmin } from "./lib/auth";
import { validateAuditIdentifier } from "./lib/audit";

const returns = paginationResultValidator(schema.doc("auditEvents"));

/** Reject audit pages outside the supported integer range. */
function validatePage(numItems: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > 100) {
    throw new ConvexError({
      code: "INVALID_PAGE_SIZE",
      message: "Request between 1 and 100 audit events.",
    });
  }
}

/** Return recent audit events to an authenticated active admin. */
export const listRecent = query({
  args: { paginationOpts: paginationOptsValidator },
  returns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validatePage(args.paginationOpts.numItems);
    return await ctx.db
      .query("auditEvents")
      .withIndex("by_occurredAt")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Page audit events for one durable actor identity. */
export const listByActor = query({
  args: { actorId: v.id("users"), paginationOpts: paginationOptsValidator },
  returns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validatePage(args.paginationOpts.numItems);
    return await ctx.db
      .query("auditEvents")
      .withIndex("by_actorId_and_occurredAt", (q) =>
        q.eq("actorId", args.actorId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Page audit events for one exact entity identity. */
export const listByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validatePage(args.paginationOpts.numItems);
    validateAuditIdentifier(args.entityType, 100);
    validateAuditIdentifier(args.entityId, 256);
    return await ctx.db
      .query("auditEvents")
      .withIndex("by_entityType_and_entityId_and_occurredAt", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

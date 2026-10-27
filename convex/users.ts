import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findUserByIdentity, requireIdentity } from "./lib/auth";
import { activeAccess, currentAccessResult } from "./lib/userAccess";

export const ensureCurrentUser = mutation({
  args: {},
  returns: activeAccess,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await findUserByIdentity(ctx, identity.tokenIdentifier);
    if (existing) {
      if (existing.status !== "active") {
        throw new ConvexError({
          code: "ACCOUNT_SUSPENDED",
          message: "This account cannot access Quilla learning features.",
        });
      }
      return {
        status: "active" as const,
        userId: existing._id,
        role: existing.role,
      };
    }

    // The indexed read and insert share one transaction; retries cannot reset
    // existing application-controlled role or suspension state.
    const userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      role: "user",
      status: "active",
    });
    return { status: "active" as const, userId, role: "user" as const };
  },
});

export const currentAccess = query({
  args: {},
  returns: currentAccessResult,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await findUserByIdentity(ctx, identity.tokenIdentifier);
    if (!user) return { status: "missing_profile" as const };
    if (user.status !== "active") return { status: "suspended" as const };
    return { status: "active" as const, userId: user._id, role: user.role };
  },
});

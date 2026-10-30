import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  findUserByIdentity,
  requireIdentity,
  requireActiveUser,
} from "./lib/auth";
import { examLevel, preferencesResult } from "./lib/preparation";
import { manilaDate, targetDateError } from "../lib/preparation";
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

export const currentPreferences = query({
  args: {},
  returns: preferencesResult,
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    return {
      preferredLevel: user.preferredLevel ?? null,
      targetExamDate: user.targetExamDate ?? null,
    };
  },
});

export const savePreferences = mutation({
  args: {
    preferredLevel: examLevel,
    targetExamDate: v.optional(v.union(v.string(), v.null())),
  },
  returns: preferencesResult,
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    if (typeof args.targetExamDate === "string") {
      const error = targetDateError(
        args.targetExamDate,
        manilaDate(Date.now()),
      );
      if (error)
        throw new ConvexError({ code: "INVALID_TARGET_DATE", message: error });
    }
    const changes = {
      preferredLevel: args.preferredLevel,
      ...(args.targetExamDate !== undefined
        ? { targetExamDate: args.targetExamDate ?? undefined }
        : {}),
    };
    await ctx.db.patch("users", user._id, changes);
    return {
      preferredLevel: args.preferredLevel,
      targetExamDate:
        args.targetExamDate === undefined
          ? (user.targetExamDate ?? null)
          : args.targetExamDate,
    };
  },
});

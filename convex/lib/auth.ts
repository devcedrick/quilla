import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx, "auth" | "db">;

export async function requireIdentity(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  return identity;
}

export async function findUserByIdentity(
  ctx: AuthContext,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  try {
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", tokenIdentifier),
      )
      .unique();
  } catch {
    // Never expose duplicate records, identity keys, or database diagnostics.
    throw new ConvexError({
      code: "ACCOUNT_UNAVAILABLE",
      message: "Account access is temporarily unavailable.",
    });
  }
}

export async function requireActiveUser(ctx: AuthContext) {
  const identity = await requireIdentity(ctx);
  const user = await findUserByIdentity(ctx, identity.tokenIdentifier);
  if (!user) {
    throw new ConvexError({
      code: "PROFILE_REQUIRED",
      message: "Account setup is required.",
    });
  }
  if (user.status !== "active") {
    throw new ConvexError({
      code: "ACCOUNT_SUSPENDED",
      message: "This account cannot access Quilla learning features.",
    });
  }
  return user;
}

export async function requireAdmin(ctx: AuthContext) {
  const user = await requireActiveUser(ctx);
  if (user.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "This action is not available for this account.",
    });
  }
  return user;
}

/** ownerId must come from a resource loaded on the server, not client identity. */
export async function requireOwner(ctx: AuthContext, ownerId: Id<"users">) {
  const user = await requireActiveUser(ctx);
  if (user._id !== ownerId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "This action is not available for this account.",
    });
  }
  return user;
}

import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ExamLevel } from "../../lib/preparation";
import { requireActiveUser } from "./auth";

type AuthContext = Pick<QueryCtx, "auth" | "db">;

export async function requireOnboarding(ctx: AuthContext) {
  const user = await requireActiveUser(ctx);
  if (!user.preferredLevel)
    throw new ConvexError({
      code: "ONBOARDING_REQUIRED",
      message: "Choose your preferred exam level first.",
    });
  return user;
}

/** #57 must replace this conservative reader with indexed submitted-attempt evidence.
 * Never infer submission from a preference, shared mastery, or client assertions.
 */
function hasSubmittedDiagnostic(
  _ctx: AuthContext,
  _userId: Id<"users">,
  _level: ExamLevel,
): boolean {
  // The scoped inputs will be used by #57's indexed evidence reader.
  void _ctx;
  void _userId;
  void _level;
  return false;
}

export async function requireDiagnosticEligibility(
  ctx: AuthContext,
  level: ExamLevel,
) {
  const user = await requireOnboarding(ctx);
  if (!hasSubmittedDiagnostic(ctx, user._id, level))
    throw new ConvexError({
      code: "DIAGNOSTIC_REQUIRED",
      message:
        "Submit a diagnostic for this level to unlock guidance and readiness.",
    });
  return user;
}

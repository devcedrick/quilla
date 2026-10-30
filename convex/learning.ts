import { query } from "./_generated/server";
import { requireActiveUser } from "./lib/auth";
import { examLevel, learningAccessResult } from "./lib/preparation";

export const currentAccess = query({
  args: { level: examLevel },
  returns: learningAccessResult,
  handler: async (ctx, { level }) => {
    const user = await requireActiveUser(ctx);
    // No submitted-attempt store exists yet (#57). Fail closed for either level.
    return {
      level,
      status: user.preferredLevel
        ? ("diagnostic_required" as const)
        : ("onboarding_required" as const),
    };
  },
});

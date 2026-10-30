import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole, userStatus } from "./lib/userAccess";
import { examLevel } from "./lib/preparation";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    role: userRole,
    status: userStatus,
    preferredLevel: v.optional(examLevel),
    targetExamDate: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});

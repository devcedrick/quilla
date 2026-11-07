import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole, userStatus } from "./lib/userAccess";
import { examLevel } from "./lib/preparation";
import { auditEventFields } from "./lib/audit";

export default defineSchema({
  auditEvents: defineTable(auditEventFields)
    .index("by_occurredAt", ["occurredAt"])
    .index("by_actorId_and_occurredAt", ["actorId", "occurredAt"])
    .index("by_entityType_and_entityId_and_occurredAt", [
      "entityType",
      "entityId",
      "occurredAt",
    ]),
  users: defineTable({
    tokenIdentifier: v.string(),
    role: userRole,
    status: userStatus,
    preferredLevel: v.optional(examLevel),
    targetExamDate: v.optional(v.string()),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});

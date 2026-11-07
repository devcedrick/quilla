import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole, userStatus } from "./lib/userAccess";
import { examLevel } from "./lib/preparation";
import { auditEventFields } from "./lib/audit";
import { taxonomyEntry, taxonomyState } from "./lib/taxonomy";

export default defineSchema({
  taxonomyVersions: defineTable({
    taxonomyId: v.string(),
    state: taxonomyState,
    revision: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_taxonomyId", ["taxonomyId"])
    .index("by_state", ["state"]),
  taxonomyEntries: defineTable(
    v.union(
      ...taxonomyEntry.members.map((member) =>
        member.extend({ taxonomyVersionId: v.id("taxonomyVersions") }),
      ),
    ),
  )
    .index("by_taxonomyVersionId", ["taxonomyVersionId"])
    .index("by_taxonomyVersionId_and_kind", ["taxonomyVersionId", "kind"])
    .index("by_taxonomyVersionId_and_kind_and_key", [
      "taxonomyVersionId",
      "kind",
      "key",
    ]),
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

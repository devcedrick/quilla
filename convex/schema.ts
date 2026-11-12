import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { userRole, userStatus } from "./lib/userAccess";
import { examLevel } from "./lib/preparation";
import { auditEventFields } from "./lib/audit";
import { taxonomyEntry, taxonomyState } from "./lib/taxonomy";
import {
  questionContent,
  referenceContent,
  provenance,
} from "./lib/questionContent";
import { questionState, questionReview } from "./lib/questionWorkflow";
import { runFields, entryFields } from "./lib/questionImportProtocol";

export default defineSchema({
  questionImportRuns: defineTable(runFields)
    .index("by_targetUrl_and_leaseUntil", ["targetUrl", "leaseUntil"])
    .index("by_target_and_planChecksum", ["target", "planChecksum"])
    .index("by_mode_and_target", ["mode", "target"]),
  questionImportEntries: defineTable(entryFields)
    .index("by_runId_and_ordinal", ["runId", "ordinal"])
    .index("by_runId_and_kind_and_sourceId_and_version", [
      "runId",
      "kind",
      "sourceId",
      "version",
    ]),
  questions: defineTable({
    questionId: v.string(),
    contributorId: v.id("users"),
    family: v.number(),
    latestVersion: v.number(),
    revision: v.number(),
    createdAt: v.number(),
  })
    .index("by_questionId", ["questionId"])
    .index("by_contributorId", ["contributorId"]),
  questionVersions: defineTable({
    questionId: v.id("questions"),
    version: v.number(),
    content: questionContent,
    contentHash: v.string(),
    contentFingerprint: v.string(),
    taxonomyVersionId: v.id("taxonomyVersions"),
    referenceVersionId: v.optional(v.id("questionReferenceVersions")),
    creatorId: v.id("users"),
    createdAt: v.number(),
    state: questionState,
    workflowRevision: v.number(),
    approvalDecisionId: v.optional(v.id("questionReviews")),
    bootstrapRunId: v.optional(v.id("questionImportRuns")),
  })
    .index("by_questionId_and_version", ["questionId", "version"])
    .index("by_state", ["state"])
    .index("by_contentFingerprint", ["contentFingerprint"])
    .index("by_contentFingerprint_and_questionId", [
      "contentFingerprint",
      "questionId",
    ])
    .index("by_bootstrapRunId_and_state", ["bootstrapRunId", "state"]),
  questionReviews: defineTable(questionReview)
    .index("by_questionVersionId", ["questionVersionId"])
    .index("by_reviewerId", ["reviewerId"]),
  questionReferenceVersions: defineTable({
    referenceId: v.string(),
    version: v.number(),
    content: referenceContent,
    contentHash: v.string(),
    creatorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_referenceId_and_version", ["referenceId", "version"]),
  questionAssets: defineTable({
    assetId: v.string(),
    sha256: v.string(),
    mediaType: v.union(v.literal("image/png"), v.literal("image/webp")),
    width: v.number(),
    height: v.number(),
    provenance,
    uploaderId: v.id("users"),
    createdAt: v.number(),
    state: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("failed"),
    ),
    storageId: v.optional(v.id("_storage")),
    revision: v.number(),
  })
    .index("by_assetId", ["assetId"])
    .index("by_uploaderId_and_state", ["uploaderId", "state"]),
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

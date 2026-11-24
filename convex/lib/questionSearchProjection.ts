import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  language,
  moduleId,
  provenance,
  questionContent,
  referenceContent,
  type QuestionContent,
} from "./questionContent";

/**
 * Derived, immutable fields used only by the admin question bank. They are not
 * part of contentHash: the hash must continue to identify authored content,
 * taxonomy and reference identity alone. Never patch these fields after insert.
 */
export const questionSearchProjection = {
  canonicalQuestionId: v.string(),
  contributorId: v.id("users"),
  searchText: v.string(),
  family: v.number(),
  module: moduleId,
  subjectId: v.string(),
  subtopicId: v.string(),
  conceptId: v.string(),
  difficulty: questionContent.fields.difficulty,
  language,
  origin: provenance.fields.kind,
  professionalEligible: v.boolean(),
  subprofessionalEligible: v.boolean(),
};

/**
 * Staged schema form. Existing rows predate the projection, so the fields stay
 * optional until an approved backfill has populated every row. New writes still
 * use the required builder above.
 */
export const questionSearchProjectionSchemaFields = {
  canonicalQuestionId: v.optional(questionSearchProjection.canonicalQuestionId),
  contributorId: v.optional(questionSearchProjection.contributorId),
  searchText: v.optional(questionSearchProjection.searchText),
  family: v.optional(questionSearchProjection.family),
  module: v.optional(questionSearchProjection.module),
  subjectId: v.optional(questionSearchProjection.subjectId),
  subtopicId: v.optional(questionSearchProjection.subtopicId),
  conceptId: v.optional(questionSearchProjection.conceptId),
  difficulty: v.optional(questionSearchProjection.difficulty),
  language: v.optional(questionSearchProjection.language),
  origin: v.optional(questionSearchProjection.origin),
  professionalEligible: v.optional(
    questionSearchProjection.professionalEligible,
  ),
  subprofessionalEligible: v.optional(
    questionSearchProjection.subprofessionalEligible,
  ),
};

/** Derive the projection from already-validated immutable content. */
export function buildQuestionSearchProjection(
  content: QuestionContent,
  canonicalQuestionId: string,
  contributorId: Id<"users">,
) {
  return {
    canonicalQuestionId,
    contributorId,
    searchText: [
      canonicalQuestionId,
      content.stem,
      ...content.choices.map((choice) => choice.text),
      content.explanation,
      content.provenance.author,
    ].join("\n"),
    family: content.family,
    module: content.module,
    subjectId: content.subjectId,
    subtopicId: content.subtopicId,
    conceptId: content.conceptId,
    difficulty: content.difficulty,
    language: content.language,
    origin: content.provenance.kind,
    professionalEligible: content.levelApplicability.includes("professional"),
    subprofessionalEligible:
      content.levelApplicability.includes("subprofessional"),
  };
}

/** Reference scope is immutable and duplicated for an indexed admin picker. */
export const referenceScopeFields = {
  family: v.number(),
  module: moduleId,
  language,
};

/** Staged schema form for reference rows that predate the scope projection. */
export const referenceScopeSchemaFields = {
  family: v.optional(referenceScopeFields.family),
  module: v.optional(referenceScopeFields.module),
  language: v.optional(referenceScopeFields.language),
};

export function buildReferenceScopeFields(
  content: Infer<typeof referenceContent>,
) {
  return {
    family: content.family,
    module: content.module,
    language: content.language,
  };
}

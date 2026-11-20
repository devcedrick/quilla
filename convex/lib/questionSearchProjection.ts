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

export function buildReferenceScopeFields(
  content: Infer<typeof referenceContent>,
) {
  return {
    family: content.family,
    module: content.module,
    language: content.language,
  };
}

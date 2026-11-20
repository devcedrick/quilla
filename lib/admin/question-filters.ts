import type {
  AdminQuestionDifficulty,
  AdminQuestionLanguage,
  AdminQuestionLevel,
  AdminQuestionModule,
  AdminQuestionOrigin,
  AdminQuestionState,
} from "./question-options";

export type QuestionFilterValues = {
  search: string;
  state: string;
  family: string;
  module: string;
  subjectId: string;
  subtopicId: string;
  conceptId: string;
  difficulty: string;
  language: string;
  level: string;
  origin: string;
  contributorId: string;
  questionId: string;
};

export const emptyQuestionFilters: QuestionFilterValues = {
  search: "",
  state: "",
  family: "",
  module: "",
  subjectId: "",
  subtopicId: "",
  conceptId: "",
  difficulty: "",
  language: "",
  level: "",
  origin: "",
  contributorId: "",
  questionId: "",
};

export type QuestionFilterErrors = Partial<
  Record<"search" | "family" | "questionId", string>
>;

/** Validate the client-side bounds the backend also enforces. */
export function validateQuestionFilters(
  filters: QuestionFilterValues,
): QuestionFilterErrors {
  const errors: QuestionFilterErrors = {};
  if (filters.search.trim().length > 100)
    errors.search = "Search text is limited to 100 characters.";
  if (filters.family.trim()) {
    const family = Number(filters.family);
    if (!Number.isSafeInteger(family) || family < 1)
      errors.family = "Family must be a positive whole number.";
  }
  if (filters.questionId.trim().length > 100)
    errors.questionId = "Question IDs are limited to 100 characters.";
  return errors;
}

export type AdminVersionFilterArgs = {
  search?: string;
  state?: AdminQuestionState;
  family?: number;
  module?: AdminQuestionModule;
  subjectId?: string;
  subtopicId?: string;
  conceptId?: string;
  difficulty?: AdminQuestionDifficulty;
  language?: AdminQuestionLanguage;
  level?: AdminQuestionLevel;
  origin?: AdminQuestionOrigin;
  contributorId?: string;
  questionId?: string;
};

/** Build one combined filter object; empty controls never reach the backend. */
export function buildQuestionFilterArgs(
  filters: QuestionFilterValues,
): AdminVersionFilterArgs {
  const family = filters.family.trim() ? Number(filters.family) : undefined;
  return {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.state ? { state: filters.state as AdminQuestionState } : {}),
    ...(family !== undefined ? { family } : {}),
    ...(filters.module
      ? { module: filters.module as AdminQuestionModule }
      : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.subtopicId ? { subtopicId: filters.subtopicId } : {}),
    ...(filters.conceptId ? { conceptId: filters.conceptId } : {}),
    ...(filters.difficulty
      ? { difficulty: filters.difficulty as AdminQuestionDifficulty }
      : {}),
    ...(filters.language
      ? { language: filters.language as AdminQuestionLanguage }
      : {}),
    ...(filters.level ? { level: filters.level as AdminQuestionLevel } : {}),
    ...(filters.origin
      ? { origin: filters.origin as AdminQuestionOrigin }
      : {}),
    ...(filters.contributorId.trim()
      ? { contributorId: filters.contributorId.trim() }
      : {}),
    ...(filters.questionId.trim()
      ? { questionId: filters.questionId.trim() }
      : {}),
  };
}

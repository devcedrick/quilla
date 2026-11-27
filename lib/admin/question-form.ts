import type { Id } from "@/convex/_generated/dataModel";
import type { QuestionContent } from "@/convex/lib/questionContent";
import {
  moduleLevels,
  moduleSubjectKeys,
  type AdminQuestionDifficulty,
  type AdminQuestionLanguage,
  type AdminQuestionModule,
  type AdminQuestionOrigin,
} from "./question-options";

export type AuthoringChoice = { choiceId: string; text: string };

export type AuthoringDraft = {
  questionId: string;
  family: string;
  module: AdminQuestionModule;
  subjectId: string;
  subtopicId: string;
  conceptId: string;
  language: AdminQuestionLanguage;
  difficulty: AdminQuestionDifficulty;
  stem: string;
  choices: AuthoringChoice[];
  correctChoiceId: string;
  explanation: string;
  origin: AdminQuestionOrigin;
  author: string;
  assistance: string;
  sourcesText: string;
  referenceVersionId: Id<"questionReferenceVersions"> | "";
};

export type AuthoringErrors = Partial<Record<AuthoringField, string>>;
export type AuthoringField =
  | "questionId"
  | "family"
  | "module"
  | "subjectId"
  | "subtopicId"
  | "conceptId"
  | "language"
  | "difficulty"
  | "stem"
  | "choices"
  | "correctChoiceId"
  | "explanation"
  | "origin"
  | "author"
  | "assistance"
  | "sources"
  | "taxonomy";

export const authoringFieldIds: Record<AuthoringField, string> = {
  questionId: "admin-question-id",
  family: "admin-family",
  module: "admin-module",
  subjectId: "admin-subject",
  subtopicId: "admin-subtopic",
  conceptId: "admin-concept",
  language: "admin-language",
  difficulty: "admin-difficulty",
  stem: "admin-stem",
  choices: "admin-choice-0",
  correctChoiceId: "admin-correct-0",
  explanation: "admin-explanation",
  origin: "admin-origin",
  author: "admin-author",
  assistance: "admin-assistance",
  sources: "admin-sources",
  taxonomy: "admin-taxonomy",
};

const unsafeMarkup = /<\/?[a-z][^>]*>|javascript:/iu;
const taxonomyKey = /^[a-z][a-z0-9_]*$/;

function required(value: string) {
  return Boolean(value.trim());
}

function contentText(value: string) {
  return required(value) && !unsafeMarkup.test(value);
}

/** Return field-level authoring errors without weakening backend validation. */
export function validateAuthoringDraft(draft: AuthoringDraft): AuthoringErrors {
  const errors: AuthoringErrors = {};
  if (!required(draft.questionId))
    errors.questionId = "Enter a canonical question ID.";
  else if (draft.questionId.trim().length > 100)
    errors.questionId = "Question IDs are limited to 100 characters.";
  else if (unsafeMarkup.test(draft.questionId))
    errors.questionId = "Question IDs cannot contain markup or script URLs.";

  const family = Number(draft.family);
  if (!Number.isSafeInteger(family) || family < 1)
    errors.family = "Family must be a positive whole number.";

  const subjects = moduleSubjectKeys(draft.module);
  if (!subjects) errors.module = "Choose a module.";
  else if (!subjects.includes(draft.subjectId))
    errors.subjectId = "Choose a subject allowed for this module.";
  if (!taxonomyKey.test(draft.subtopicId))
    errors.subtopicId = "Choose a subtopic.";
  if (!taxonomyKey.test(draft.conceptId))
    errors.conceptId = "Choose a concept.";
  if (!required(draft.difficulty)) errors.difficulty = "Choose a difficulty.";
  if (!required(draft.language)) errors.language = "Choose a language.";
  else if (
    draft.language === "filipino" &&
    draft.subjectId !== "verbal_ability"
  )
    errors.language = "Filipino is only available for Verbal Ability.";
  if (!contentText(draft.stem)) errors.stem = "Enter a stem without markup.";
  if (!contentText(draft.explanation))
    errors.explanation = "Enter an explanation without markup.";

  if (draft.choices.length < 2 || draft.choices.length > 6)
    errors.choices = "Provide between 2 and 6 choices.";
  else if (draft.choices.some((choice) => !contentText(choice.text)))
    errors.choices = "Every choice needs text without markup.";
  else {
    const normalized = draft.choices.map((choice) =>
      choice.text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "),
    );
    if (new Set(normalized).size !== normalized.length)
      errors.choices = "Choices must be distinct after normalization.";
  }
  if (
    !draft.correctChoiceId ||
    !draft.choices.some((choice) => choice.choiceId === draft.correctChoiceId)
  )
    errors.correctChoiceId = "Mark exactly one choice as correct.";

  if (!required(draft.origin)) errors.origin = "Choose the content origin.";
  if (!required(draft.author)) errors.author = "Enter the content author.";
  if (!required(draft.assistance))
    errors.assistance = "Describe any authoring assistance.";
  const sources = draft.sourcesText
    .split(/\r?\n/u)
    .map((source) => source.trim())
    .filter(Boolean);
  if (draft.origin === "licensed" && !sources.length)
    errors.sources = "Licensed content requires at least one source.";
  else if (
    draft.sourcesText
      .split(/\r?\n/u)
      .some((source) => unsafeMarkup.test(source))
  )
    errors.sources = "Sources cannot contain markup or script URLs.";

  return errors;
}

/** Build the exact validated content payload sent to the backend. */
export function buildQuestionContent(draft: AuthoringDraft): QuestionContent {
  return {
    family: Number(draft.family),
    module: draft.module,
    subjectId: draft.subjectId,
    subtopicId: draft.subtopicId,
    conceptId: draft.conceptId,
    levelApplicability: moduleLevels(draft.module),
    language: draft.language,
    difficulty: draft.difficulty,
    stem: draft.stem.trim(),
    choices: draft.choices.map((choice, index) => ({
      choiceId: choice.choiceId || nextChoiceId(index),
      text: choice.text.trim(),
    })),
    correctChoiceId: draft.correctChoiceId,
    explanation: draft.explanation.trim(),
    provenance: {
      kind: draft.origin,
      author: draft.author.trim(),
      assistance: draft.assistance.trim(),
      sources: draft.sourcesText
        .split(/\r?\n/u)
        .map((source) => source.trim())
        .filter(Boolean),
    },
  };
}

function nextChoiceId(index: number) {
  return String.fromCharCode(97 + index);
}

/** Pick the first letter not already used after a choice was removed. */
export function nextUnusedChoiceId(choices: readonly AuthoringChoice[]) {
  const used = new Set(choices.map((choice) => choice.choiceId));
  for (let index = 0; index < 26; index++) {
    const id = nextChoiceId(index);
    if (!used.has(id)) return id;
  }
  return nextChoiceId(choices.length);
}

export function firstAuthoringField(errors: AuthoringErrors) {
  const order: AuthoringField[] = [
    "taxonomy",
    "questionId",
    "family",
    "module",
    "subjectId",
    "subtopicId",
    "conceptId",
    "language",
    "difficulty",
    "stem",
    "choices",
    "correctChoiceId",
    "explanation",
    "origin",
    "author",
    "assistance",
    "sources",
  ];
  return order.find((field) => errors[field]);
}

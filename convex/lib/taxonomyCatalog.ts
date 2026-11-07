import { levels, subjects, type TaxonomyEntry } from "./taxonomy";

export const v2Concepts = [
  [
    "general_information",
    "civic_and_general_information",
    "philippine_constitution_general_information_events",
  ],
  ["verbal_ability", "vocabulary", "vocabulary_questions"],
  [
    "verbal_ability",
    "grammar_and_usage",
    "idiomatic_expressions_and_correct_grammar",
  ],
  ["verbal_ability", "reading", "reading_comprehension_test"],
  ["verbal_ability", "discourse", "paragraph_organization_test_questions"],
  ["numerical_ability", "numerical_reasoning", "numerical_reasoning"],
  ["numerical_ability", "numerical_reasoning", "data_sufficiency"],
  ["analytical_ability", "data_reasoning", "graphs_charts_and_data"],
  ["analytical_ability", "logic_and_analogy", "word_analogy_and_logic_test"],
  ["clerical_ability", "clerical_operations", "clerical_operations"],
  ["clerical_ability", "clerical_operations", "alphabetizing"],
  ["clerical_ability", "clerical_operations", "spelling"],
] as const;
/** Derive a readable fixture label without changing its stable identifier. */
const label = (key: string) => key.replaceAll("_", " ");
/** Return the approved subject-level eligibility for the local V2 fixture. */
const applicability = (subject: string) =>
  subject === "analytical_ability"
    ? [levels[0]]
    : subject === "clerical_ability"
      ? [levels[1]]
      : [...levels];
/** Offline fixture only; no automatic installation or activation. */
export const initialV2Catalog: TaxonomyEntry[] = [
  ...levels.map((key) => ({
    kind: "level" as const,
    key,
    label: label(key),
    archived: false,
  })),
  ...["easy", "medium", "hard"].map((key) => ({
    kind: "difficulty" as const,
    key,
    label: label(key),
    archived: false,
  })),
  ...["english", "filipino"].map((key) => ({
    kind: "language" as const,
    key,
    label: label(key),
    archived: false,
  })),
  ...subjects.map((key) => ({
    kind: "subject" as const,
    key,
    label: label(key),
    archived: false,
    levels: applicability(key),
  })),
  ...v2Concepts
    .filter((row, i, all) => all.findIndex((r) => r[1] === row[1]) === i)
    .map(([subjectKey, key]) => ({
      kind: "subtopic" as const,
      key,
      label: label(key),
      subjectKey,
      levels: applicability(subjectKey),
      archived: false,
    })),
  ...v2Concepts.map(([subjectKey, subtopicKey, key]) => ({
    kind: "concept" as const,
    key,
    label: label(key),
    subjectKey,
    subtopicKey,
    levels: applicability(subjectKey),
    archived: false,
  })),
];

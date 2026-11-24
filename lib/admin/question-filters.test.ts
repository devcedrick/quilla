import { describe, expect, it } from "vitest";
import {
  buildQuestionFilterArgs,
  emptyQuestionFilters,
  validateQuestionFilters,
  type QuestionFilterValues,
} from "./question-filters";

const allFilters: QuestionFilterValues = {
  search: "  two plus three  ",
  state: "pending_review",
  family: " 2 ",
  module: "shared-core",
  subjectId: "numerical_ability",
  subtopicId: "numerical_reasoning",
  conceptId: "numerical_reasoning",
  difficulty: "medium",
  language: "english",
  level: "professional",
  origin: "original",
  contributorId: " user-1 ",
  questionId: " q-1 ",
};

describe("admin question bank filters", () => {
  it("omits every empty control", () => {
    expect(buildQuestionFilterArgs(emptyQuestionFilters)).toEqual({});
  });
  it("combines every supplied filter in one payload", () => {
    expect(buildQuestionFilterArgs(allFilters)).toEqual({
      search: "two plus three",
      state: "pending_review",
      family: 2,
      module: "shared-core",
      subjectId: "numerical_ability",
      subtopicId: "numerical_reasoning",
      conceptId: "numerical_reasoning",
      difficulty: "medium",
      language: "english",
      level: "professional",
      origin: "original",
      contributorId: "user-1",
      questionId: "q-1",
    });
  });
  it("accepts valid bounds without errors", () => {
    expect(validateQuestionFilters(allFilters)).toEqual({});
  });
  it("reports each invalid bound by field", () => {
    expect(
      validateQuestionFilters({
        ...emptyQuestionFilters,
        search: "s".repeat(101),
        family: "0",
        questionId: "q".repeat(101),
      }),
    ).toEqual({
      search: "Search text is limited to 100 characters.",
      family: "Family must be a positive whole number.",
      questionId: "Question IDs are limited to 100 characters.",
    });
    expect(
      validateQuestionFilters({ ...emptyQuestionFilters, family: "1.5" }),
    ).toMatchObject({ family: expect.any(String) });
  });
});

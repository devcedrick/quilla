import { describe, expect, it } from "vitest";
import {
  buildQuestionContent,
  firstAuthoringField,
  validateAuthoringDraft,
  type AuthoringDraft,
} from "./question-form";

const validDraft: AuthoringDraft = {
  questionId: "q-1",
  family: "1",
  module: "shared-core",
  subjectId: "numerical_ability",
  subtopicId: "numerical_reasoning",
  conceptId: "numerical_reasoning",
  language: "english",
  difficulty: "easy",
  stem: "What is 2 + 3?",
  choices: [
    { choiceId: "a", text: "5" },
    { choiceId: "b", text: "6" },
  ],
  correctChoiceId: "a",
  explanation: "Two plus three is five.",
  origin: "synthetic",
  author: "Fixture",
  assistance: "None",
  sourcesText: "",
  referenceVersionId: "",
};

describe("admin question authoring validation", () => {
  it("accepts a complete draft without errors", () => {
    expect(validateAuthoringDraft(validDraft)).toEqual({});
  });
  it("requires a positive whole family", () => {
    expect(
      validateAuthoringDraft({ ...validDraft, family: "0" }),
    ).toMatchObject({
      family: expect.stringContaining("positive whole number"),
    });
    expect(
      validateAuthoringDraft({ ...validDraft, family: "1.5" }),
    ).toMatchObject({ family: expect.any(String) });
  });
  it("rejects an overlong or markup-bearing canonical ID", () => {
    expect(
      validateAuthoringDraft({ ...validDraft, questionId: "q".repeat(101) }),
    ).toMatchObject({ questionId: expect.any(String) });
    expect(
      validateAuthoringDraft({
        ...validDraft,
        questionId: "<script>alert(1)</script>",
      }),
    ).toMatchObject({ questionId: expect.any(String) });
  });
  it("rejects subjects and languages the module does not allow", () => {
    expect(
      validateAuthoringDraft({
        ...validDraft,
        module: "analytical",
        subjectId: "numerical_ability",
      }),
    ).toMatchObject({ subjectId: expect.any(String) });
    expect(
      validateAuthoringDraft({ ...validDraft, language: "filipino" }),
    ).toMatchObject({ language: expect.any(String) });
    expect(
      validateAuthoringDraft({
        ...validDraft,
        subjectId: "verbal_ability",
        subtopicId: "vocabulary",
        conceptId: "vocabulary_questions",
        language: "filipino",
      }),
    ).not.toHaveProperty("language");
  });
  it("requires distinct normalized choices and exactly one correct answer", () => {
    expect(
      validateAuthoringDraft({
        ...validDraft,
        choices: [
          { choiceId: "a", text: " five " },
          { choiceId: "b", text: "FIVE" },
        ],
      }),
    ).toMatchObject({ choices: expect.stringContaining("distinct") });
    expect(
      validateAuthoringDraft({ ...validDraft, correctChoiceId: "missing" }),
    ).toMatchObject({ correctChoiceId: expect.any(String) });
  });
  it("rejects markup and script URLs in authored content", () => {
    expect(
      validateAuthoringDraft({ ...validDraft, stem: "<b>What is 2 + 3?</b>" }),
    ).toMatchObject({ stem: expect.any(String) });
    expect(
      validateAuthoringDraft({
        ...validDraft,
        explanation: "javascript:alert(1)",
      }),
    ).toMatchObject({ explanation: expect.any(String) });
  });
  it("requires sources for licensed content", () => {
    expect(
      validateAuthoringDraft({ ...validDraft, origin: "licensed" }),
    ).toMatchObject({ sources: expect.any(String) });
    expect(
      validateAuthoringDraft({
        ...validDraft,
        origin: "licensed",
        sourcesText: "Fixture licence\nhttps://example.test/terms",
      }),
    ).not.toHaveProperty("sources");
  });
  it("reports the first field in focus order", () => {
    const errors = validateAuthoringDraft({
      ...validDraft,
      family: "0",
      stem: "",
    });
    expect(firstAuthoringField(errors)).toBe("family");
    expect(firstAuthoringField({})).toBeUndefined();
  });
});

describe("admin question authoring payload", () => {
  it("builds the exact server content with derived levels and trimmed sources", () => {
    const payload = buildQuestionContent({
      ...validDraft,
      stem: "  What is 2 + 3?  ",
      choices: [
        { choiceId: "a", text: " 5 " },
        { choiceId: "b", text: " 6 " },
      ],
      sourcesText: "  Source one \n\n Source two  \n",
      origin: "licensed",
    });
    expect(payload).toMatchObject({
      family: 1,
      module: "shared-core",
      levelApplicability: ["professional", "subprofessional"],
      stem: "What is 2 + 3?",
      choices: [
        { choiceId: "a", text: "5" },
        { choiceId: "b", text: "6" },
      ],
      provenance: {
        kind: "licensed",
        author: "Fixture",
        assistance: "None",
        sources: ["Source one", "Source two"],
      },
    });
  });
  it.each([
    ["professional-numerical", ["professional"]],
    ["analytical", ["professional"]],
    ["clerical", ["subprofessional"]],
  ] as const)("derives %s level applicability", (module, levels) => {
    expect(
      buildQuestionContent({ ...validDraft, module }).levelApplicability,
    ).toEqual(levels);
  });
});

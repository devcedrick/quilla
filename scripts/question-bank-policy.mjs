// cse-taxonomy-2027-v1 / ADR 0008. Display labels are never identifiers.
export const policy = {
  taxonomy: "cse-taxonomy-2027-v1",
  blueprints: ["cse-professional-2027-v1", "cse-subprofessional-2027-v1"],
  concepts: {
    general_information: [
      "civic_and_general_information",
      "philippine_constitution_general_information_events",
    ],
    verbal_ability: [
      ["vocabulary", "vocabulary_questions"],
      ["grammar_and_usage", "idiomatic_expressions_and_correct_grammar"],
      ["reading", "reading_comprehension_test"],
      ["discourse", "paragraph_organization_test_questions"],
    ],
    numerical_ability: ["numerical_reasoning", "numerical_reasoning"],
    analytical_ability: [
      ["data_reasoning", "graphs_charts_and_data"],
      ["logic_and_analogy", "word_analogy_and_logic_test"],
    ],
    clerical_ability: [
      ["clerical_operations", "clerical_operations"],
      ["language_accuracy", "spelling"],
    ],
  },
  cells: [
    ["shared-core", "general_information", 6, 10, 4],
    ["shared-core", "verbal_ability", 15, 25, 10],
    ["shared-core", "numerical_ability", 10, 18, 7],
    ["professional-numerical", "numerical_ability", 2, 2, 1],
    ["analytical", "analytical_ability", 12, 20, 8],
    ["clerical", "clerical_ability", 12, 20, 8],
  ],
};

// ADRs 0011–0013: seed authorship is not a pooled-exam activation gate.
export const seedPolicy = {
  ...policy,
  taxonomy: "cse-taxonomy-2027-v2",
  blueprints: ["cse-professional-2027-v3", "cse-subprofessional-2027-v3"],
  concepts: {
    ...policy.concepts,
    numerical_ability: [
      ["numerical_reasoning", "numerical_reasoning"],
      ["numerical_reasoning", "data_sufficiency"],
    ],
    clerical_ability: [
      ["clerical_operations", "clerical_operations"],
      ["clerical_operations", "alphabetizing"],
      ["clerical_operations", "spelling"],
    ],
  },
  seedSubjects: {
    general_information: 40,
    verbal_ability: 50,
    numerical_ability: 60,
    analytical_ability: 80,
    clerical_ability: 40,
  },
};

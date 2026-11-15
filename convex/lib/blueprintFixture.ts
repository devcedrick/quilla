import {
  blueprintPolicy,
  type BlueprintConfiguration,
  type BlueprintLevel,
} from "./blueprintValidation";
import { v2Concepts } from "./taxonomyCatalog";

type CellTuple = readonly [
  BlueprintConfiguration["cells"][number]["module"],
  string,
  number,
  number,
  number,
];

/** Shared allocation from ADR 0013: 105 items serve either level. */
const sharedCells: CellTuple[] = [
  ["shared-core", "general_information", 6, 10, 4],
  ["shared-core", "verbal_ability", 15, 25, 10],
  ["shared-core", "numerical_ability", 10, 18, 7],
];
const levelCells: Record<BlueprintLevel, CellTuple[]> = {
  professional: [
    ...sharedCells,
    ["professional-numerical", "numerical_ability", 2, 2, 1],
    ["analytical", "analytical_ability", 12, 20, 8],
  ],
  subprofessional: [
    ...sharedCells,
    ["clerical", "clerical_ability", 12, 20, 8],
  ],
};

/** Expand the documented subject-by-difficulty cells into concrete rows. */
function cells(level: BlueprintLevel) {
  return levelCells[level].flatMap(
    ([module, subjectId, easy, medium, hard]) => [
      { module, subjectId, difficulty: "easy" as const, count: easy },
      { module, subjectId, difficulty: "medium" as const, count: medium },
      { module, subjectId, difficulty: "hard" as const, count: hard },
    ],
  );
}

/** Expand the policy's exact subject-level language totals. */
function languages(level: BlueprintLevel) {
  type Language = BlueprintConfiguration["languages"][number]["language"];
  return Object.entries(blueprintPolicy[level].languageTotals).flatMap(
    ([subjectId, totals]) =>
      Object.entries(totals ?? {}).flatMap(([language, count]) =>
        typeof count === "number"
          ? [
              {
                subjectId,
                language: language as Language,
                count,
              },
            ]
          : [],
      ),
  );
}

/** Require at least one item for every concept applicable to the level. */
function concepts(level: BlueprintLevel) {
  return v2Concepts
    .filter(
      ([subjectId]) => blueprintPolicy[level].subjectTotals[subjectId] > 0,
    )
    .map(([subjectId, subtopicId, conceptId]) => ({
      subjectId,
      subtopicId,
      conceptId,
      minimum: 1,
    }));
}

type InitialBlueprint = {
  blueprintId: string;
  level: BlueprintLevel;
  taxonomyId: string;
  configuration: BlueprintConfiguration;
};

/** Offline fixture only; no automatic installation or activation. */
export const initialV3Blueprints: InitialBlueprint[] = [
  {
    blueprintId: "cse-professional-2027-v3",
    level: "professional",
    taxonomyId: "cse-taxonomy-2027-v2",
    configuration: {
      scoredItems: blueprintPolicy.professional.scoredItems,
      durationMinutes: blueprintPolicy.professional.durationMinutes,
      passingScore: blueprintPolicy.professional.passingScore,
      passingRatioBps: blueprintPolicy.professional.passingRatioBps,
      difficultyMix: { ...blueprintPolicy.professional.difficultyMix },
      cells: cells("professional"),
      languages: languages("professional"),
      concepts: concepts("professional"),
    },
  },
  {
    blueprintId: "cse-subprofessional-2027-v3",
    level: "subprofessional",
    taxonomyId: "cse-taxonomy-2027-v2",
    configuration: {
      scoredItems: blueprintPolicy.subprofessional.scoredItems,
      durationMinutes: blueprintPolicy.subprofessional.durationMinutes,
      passingScore: blueprintPolicy.subprofessional.passingScore,
      passingRatioBps: blueprintPolicy.subprofessional.passingRatioBps,
      difficultyMix: { ...blueprintPolicy.subprofessional.difficultyMix },
      cells: cells("subprofessional"),
      languages: languages("subprofessional"),
      concepts: concepts("subprofessional"),
    },
  },
];

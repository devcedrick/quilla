import { ConvexError, v, type Infer } from "convex/values";
import { examLevel } from "./preparation";
import {
  canonical,
  digest,
  language as questionLanguage,
  moduleId,
} from "./questionContent";
import type { TaxonomyEntry } from "./taxonomy";

export const blueprintState = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("archived"),
);

const blueprintDifficulty = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);
const blueprintCell = v.object({
  module: moduleId,
  subjectId: v.string(),
  difficulty: blueprintDifficulty,
  count: v.number(),
});
const blueprintLanguageTotal = v.object({
  subjectId: v.string(),
  language: questionLanguage,
  count: v.number(),
});
const blueprintConceptRequirement = v.object({
  subjectId: v.string(),
  subtopicId: v.string(),
  conceptId: v.string(),
  minimum: v.number(),
});

/** A complete, self-describing blueprint configuration stored on a version. */
export const blueprintConfiguration = v.object({
  scoredItems: v.number(),
  durationMinutes: v.number(),
  passingScore: v.number(),
  passingRatioBps: v.number(),
  difficultyMix: v.object({
    easy: v.number(),
    medium: v.number(),
    hard: v.number(),
  }),
  cells: v.array(blueprintCell),
  languages: v.array(blueprintLanguageTotal),
  concepts: v.array(blueprintConceptRequirement),
});

export type BlueprintConfiguration = Infer<typeof blueprintConfiguration>;
export type BlueprintLevel = Infer<typeof examLevel>;
type BlueprintDifficulty = Infer<typeof blueprintDifficulty>;
type BlueprintModule = Infer<typeof moduleId>;
type BlueprintLanguage = Infer<typeof questionLanguage>;

const subjectKeys = [
  "general_information",
  "verbal_ability",
  "numerical_ability",
  "analytical_ability",
  "clerical_ability",
] as const;
type BlueprintSubject = (typeof subjectKeys)[number];
const difficultyKeys = ["easy", "medium", "hard"] as const;

const moduleSubjects: Record<BlueprintModule, readonly BlueprintSubject[]> = {
  "shared-core": ["general_information", "verbal_ability", "numerical_ability"],
  "professional-numerical": ["numerical_ability"],
  analytical: ["analytical_ability"],
  clerical: ["clerical_ability"],
};
const moduleLevels: Record<BlueprintModule, readonly BlueprintLevel[]> = {
  "shared-core": ["professional", "subprofessional"],
  "professional-numerical": ["professional"],
  analytical: ["professional"],
  clerical: ["subprofessional"],
};

type LanguageTotals = Partial<
  Record<BlueprintSubject, Partial<Record<BlueprintLanguage, number>>>
>;
type DifficultyCell = readonly [
  BlueprintModule,
  BlueprintSubject,
  number,
  number,
  number,
];
type LevelPolicy = {
  scoredItems: number;
  difficultyMix: Record<BlueprintDifficulty, number>;
  difficultyCells: readonly DifficultyCell[];
  subjectTotals: Record<BlueprintSubject, number>;
  moduleTotals: Record<BlueprintModule, number>;
  languageTotals: LanguageTotals;
  durationMinutes: number;
  passingScore: number;
  passingRatioBps: number;
  officialMinutes: number;
  officialItems: number;
};

/**
 * Quilla-authored exam policy for the current two levels. These values mirror
 * `docs/exams/cse-taxonomy-and-blueprints.md` and are re-stored on every
 * blueprint so historical snapshots never depend on later policy edits.
 */
export const blueprintPolicy: Record<BlueprintLevel, LevelPolicy> = {
  professional: {
    scoredItems: 150,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    difficultyCells: [
      ["shared-core", "general_information", 6, 10, 4],
      ["shared-core", "verbal_ability", 15, 25, 10],
      ["shared-core", "numerical_ability", 10, 18, 7],
      ["professional-numerical", "numerical_ability", 2, 2, 1],
      ["analytical", "analytical_ability", 12, 20, 8],
    ],
    subjectTotals: {
      general_information: 20,
      verbal_ability: 50,
      numerical_ability: 40,
      analytical_ability: 40,
      clerical_ability: 0,
    },
    moduleTotals: {
      "shared-core": 105,
      "professional-numerical": 5,
      analytical: 40,
      clerical: 0,
    },
    languageTotals: {
      general_information: { english: 20 },
      verbal_ability: { english: 25, filipino: 25 },
      numerical_ability: { english: 40 },
      analytical_ability: { english: 40 },
    },
    durationMinutes: 168,
    passingScore: 120,
    passingRatioBps: 8000,
    officialMinutes: 190,
    officialItems: 170,
  },
  subprofessional: {
    scoredItems: 145,
    difficultyMix: { easy: 30, medium: 50, hard: 20 },
    difficultyCells: [
      ["shared-core", "general_information", 6, 10, 4],
      ["shared-core", "verbal_ability", 15, 25, 10],
      ["shared-core", "numerical_ability", 10, 18, 7],
      ["clerical", "clerical_ability", 12, 20, 8],
    ],
    subjectTotals: {
      general_information: 20,
      verbal_ability: 50,
      numerical_ability: 35,
      analytical_ability: 0,
      clerical_ability: 40,
    },
    moduleTotals: {
      "shared-core": 105,
      "professional-numerical": 0,
      analytical: 0,
      clerical: 40,
    },
    languageTotals: {
      general_information: { english: 20 },
      verbal_ability: { english: 25, filipino: 25 },
      numerical_ability: { english: 35 },
      clerical_ability: { english: 40 },
    },
    durationMinutes: 141,
    passingScore: 116,
    passingRatioBps: 8000,
    officialMinutes: 160,
    officialItems: 165,
  },
};

/** Reject a blueprint operation with a stable domain error code. */
export function blueprintError(code: string): never {
  throw new ConvexError({
    code,
    message: "Blueprint operation rejected: " + code,
  });
}

/** Validate the bounded stable blueprint identifier format. */
export function validateBlueprintIdentifier(value: string) {
  if (!/^[a-z0-9_-]{1,100}$/.test(value)) blueprintError("INVALID_IDENTIFIER");
}

const positiveInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

const maxConfigurationBytes = 8 * 1024;
const maxCells = 32;
const maxLanguages = 32;
const maxConcepts = 32;
/** Current persisted format; format 1 remains verifiable as a legacy format. */
export const blueprintConfigurationFormatVersion = 2;

/**
 * Validate one configuration against its level policy and sealed taxonomy.
 * Ordering is normalized separately, so this accepts any cell/language/concept
 * ordering while still rejecting duplicate identities.
 */
export function validateBlueprintConfiguration(
  level: BlueprintLevel,
  rows: readonly TaxonomyEntry[],
  configuration: BlueprintConfiguration,
) {
  const policy = blueprintPolicy[level];
  if (!policy) blueprintError("INVALID_LEVEL");
  if (
    new TextEncoder().encode(canonical(configuration)).byteLength >
    maxConfigurationBytes
  )
    blueprintError("CONFIGURATION_TOO_LARGE");

  const requireSubject = (subjectId: string): BlueprintSubject => {
    if (!subjectKeys.includes(subjectId as BlueprintSubject))
      blueprintError("UNKNOWN_SUBJECT");
    const subject = rows.find(
      (entry) =>
        entry.kind === "subject" && entry.key === subjectId && !entry.archived,
    );
    if (!subject || !("levels" in subject) || !subject.levels.includes(level))
      blueprintError("UNKNOWN_SUBJECT");
    return subjectId as BlueprintSubject;
  };

  if (
    !Array.isArray(configuration.cells) ||
    configuration.cells.length === 0 ||
    configuration.cells.length > maxCells
  )
    blueprintError("INVALID_CELLS");

  const cellKeys = new Set<string>();
  const cellCounts = new Map<string, number>();
  const subjectCounts = new Map<BlueprintSubject, number>();
  const moduleCounts = new Map<BlueprintModule, number>();
  const difficultyCounts: Record<BlueprintDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const cell of configuration.cells) {
    if (!positiveInteger(cell.count)) blueprintError("INVALID_CELLS");
    if (!moduleLevels[cell.module].includes(level))
      blueprintError("INVALID_MODULE");
    const subject = requireSubject(cell.subjectId);
    if (!moduleSubjects[cell.module].includes(subject))
      blueprintError("INVALID_MODULE");
    if (policy.subjectTotals[subject] <= 0) blueprintError("INVALID_SUBJECT");
    const identity = `${cell.module}:${subject}:${cell.difficulty}`;
    if (cellKeys.has(identity)) blueprintError("DUPLICATE_IDENTITY");
    cellKeys.add(identity);
    cellCounts.set(identity, cell.count);
    subjectCounts.set(subject, (subjectCounts.get(subject) ?? 0) + cell.count);
    moduleCounts.set(
      cell.module,
      (moduleCounts.get(cell.module) ?? 0) + cell.count,
    );
    difficultyCounts[cell.difficulty] += cell.count;
  }

  if (!positiveInteger(configuration.scoredItems))
    blueprintError("INVALID_SCORED_ITEMS");
  if (configuration.scoredItems !== policy.scoredItems)
    blueprintError("INVALID_SCORED_ITEMS");

  let scoredTotal = 0;
  for (const subject of subjectKeys) {
    const actual = subjectCounts.get(subject) ?? 0;
    if (actual !== policy.subjectTotals[subject])
      blueprintError("INVALID_SUBJECT_TOTAL");
    scoredTotal += actual;
  }
  if (scoredTotal !== configuration.scoredItems)
    blueprintError("INVALID_SCORED_ITEMS");

  for (const moduleKey of Object.keys(
    policy.moduleTotals,
  ) as BlueprintModule[]) {
    if ((moduleCounts.get(moduleKey) ?? 0) !== policy.moduleTotals[moduleKey])
      blueprintError("INVALID_MODULE_TOTAL");
  }

  for (const difficulty of difficultyKeys) {
    const percent = configuration.difficultyMix[difficulty];
    if (
      !Number.isInteger(percent) ||
      percent < 0 ||
      percent > 100 ||
      percent !== policy.difficultyMix[difficulty]
    )
      blueprintError("INVALID_DIFFICULTY_MIX");
  }
  if (
    difficultyKeys.reduce(
      (total, difficulty) => total + configuration.difficultyMix[difficulty],
      0,
    ) !== 100
  )
    blueprintError("INVALID_DIFFICULTY_MIX");
  for (const difficulty of difficultyKeys) {
    const target =
      (configuration.scoredItems * configuration.difficultyMix[difficulty]) /
      100;
    const actual = difficultyCounts[difficulty];
    if (actual < Math.floor(target) || actual > Math.ceil(target))
      blueprintError("INVALID_DIFFICULTY_TOTAL");
  }

  const expectedCellKeys = new Set<string>();
  for (const [
    module,
    subjectId,
    easy,
    medium,
    hard,
  ] of policy.difficultyCells) {
    const expectedByDifficulty: Array<[BlueprintDifficulty, number]> = [
      ["easy", easy],
      ["medium", medium],
      ["hard", hard],
    ];
    for (const [difficulty, count] of expectedByDifficulty) {
      const identity = `${module}:${subjectId}:${difficulty}`;
      expectedCellKeys.add(identity);
      if (cellCounts.get(identity) !== count)
        blueprintError("INVALID_DIFFICULTY_CELL");
    }
  }
  if (cellCounts.size !== expectedCellKeys.size)
    blueprintError("INVALID_DIFFICULTY_CELL");

  if (
    !Array.isArray(configuration.languages) ||
    configuration.languages.length === 0 ||
    configuration.languages.length > maxLanguages
  )
    blueprintError("INVALID_LANGUAGE_TOTAL");
  const languageKeys = new Set<string>();
  const languageBySubject = new Map<
    BlueprintSubject,
    Map<BlueprintLanguage, number>
  >();
  for (const total of configuration.languages) {
    if (!positiveInteger(total.count)) blueprintError("INVALID_LANGUAGE_TOTAL");
    const subject = requireSubject(total.subjectId);
    if (policy.subjectTotals[subject] <= 0) blueprintError("INVALID_SUBJECT");
    const language = rows.find(
      (entry) =>
        entry.kind === "language" &&
        entry.key === total.language &&
        !entry.archived,
    );
    if (!language) blueprintError("UNKNOWN_LANGUAGE");
    const identity = `${subject}:${total.language}`;
    if (languageKeys.has(identity)) blueprintError("DUPLICATE_IDENTITY");
    languageKeys.add(identity);
    const byLanguage =
      languageBySubject.get(subject) ?? new Map<BlueprintLanguage, number>();
    byLanguage.set(total.language, total.count);
    languageBySubject.set(subject, byLanguage);
  }
  for (const subject of subjectKeys) {
    const expected = policy.languageTotals[subject] ?? {};
    const expectedEntries = Object.entries(expected);
    const actual = languageBySubject.get(subject);
    if (expectedEntries.length === 0) {
      if (actual && actual.size > 0) blueprintError("INVALID_LANGUAGE_TOTAL");
      continue;
    }
    if (!actual || actual.size !== expectedEntries.length)
      blueprintError("INVALID_LANGUAGE_TOTAL");
    for (const [language, count] of expectedEntries)
      if (actual.get(language as BlueprintLanguage) !== count)
        blueprintError("INVALID_LANGUAGE_TOTAL");
  }

  if (
    !Array.isArray(configuration.concepts) ||
    configuration.concepts.length === 0 ||
    configuration.concepts.length > maxConcepts
  )
    blueprintError("MISSING_CONCEPT");
  const applicableConcepts = rows.filter(
    (entry): entry is Extract<TaxonomyEntry, { kind: "concept" }> =>
      entry.kind === "concept" &&
      !entry.archived &&
      entry.levels.includes(level),
  );
  const conceptKeys = new Set<string>();
  const conceptMinimumBySubject = new Map<BlueprintSubject, number>();
  let conceptMinimumTotal = 0;
  for (const requirement of configuration.concepts) {
    if (!positiveInteger(requirement.minimum))
      blueprintError("INVALID_CONCEPT_REQUIREMENT");
    const subject = requireSubject(requirement.subjectId);
    if (policy.subjectTotals[subject] <= 0) blueprintError("INVALID_SUBJECT");
    if (requirement.minimum > policy.subjectTotals[subject])
      blueprintError("INVALID_CONCEPT_REQUIREMENT");
    const concept = rows.find(
      (entry) =>
        entry.kind === "concept" &&
        entry.key === requirement.conceptId &&
        !entry.archived,
    );
    if (
      !concept ||
      concept.kind !== "concept" ||
      !concept.levels.includes(level) ||
      concept.subjectKey !== requirement.subjectId ||
      concept.subtopicKey !== requirement.subtopicId
    )
      blueprintError("UNKNOWN_CONCEPT");
    const identity = `${requirement.subjectId}:${requirement.subtopicId}:${requirement.conceptId}`;
    if (conceptKeys.has(identity)) blueprintError("DUPLICATE_IDENTITY");
    conceptKeys.add(identity);
    conceptMinimumTotal += requirement.minimum;
    conceptMinimumBySubject.set(
      subject,
      (conceptMinimumBySubject.get(subject) ?? 0) + requirement.minimum,
    );
  }
  for (const subject of subjectKeys)
    if (
      (conceptMinimumBySubject.get(subject) ?? 0) >
      policy.subjectTotals[subject]
    )
      blueprintError("INVALID_CONCEPT_REQUIREMENT");
  if (conceptMinimumTotal > configuration.scoredItems)
    blueprintError("INVALID_CONCEPT_REQUIREMENT");
  if (configuration.concepts.length !== applicableConcepts.length)
    blueprintError("MISSING_CONCEPT");
  for (const concept of applicableConcepts) {
    if (
      !conceptKeys.has(
        `${concept.subjectKey}:${concept.subtopicKey}:${concept.key}`,
      )
    )
      blueprintError("MISSING_CONCEPT");
  }

  if (!positiveInteger(configuration.durationMinutes))
    blueprintError("INVALID_DURATION");
  const expectedMinutes = Math.round(
    (policy.officialMinutes * configuration.scoredItems) / policy.officialItems,
  );
  if (configuration.durationMinutes !== expectedMinutes)
    blueprintError("INVALID_DURATION");

  if (configuration.passingRatioBps !== policy.passingRatioBps)
    blueprintError("INVALID_PASSING_SCORE");
  const expectedPassing = Math.ceil(
    (configuration.scoredItems * configuration.passingRatioBps) / 10000,
  );
  if (!positiveInteger(configuration.passingScore))
    blueprintError("INVALID_PASSING_SCORE");
  if (configuration.passingScore !== expectedPassing)
    blueprintError("INVALID_PASSING_SCORE");
}

const moduleOrder: Record<BlueprintModule, number> = {
  "shared-core": 0,
  "professional-numerical": 1,
  analytical: 2,
  clerical: 3,
};
const difficultyOrder: Record<BlueprintDifficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Sort optional collections into the stable order used for hashing. */
export function normalizeBlueprintConfiguration(
  configuration: BlueprintConfiguration,
): BlueprintConfiguration {
  return {
    scoredItems: configuration.scoredItems,
    durationMinutes: configuration.durationMinutes,
    passingScore: configuration.passingScore,
    passingRatioBps: configuration.passingRatioBps,
    difficultyMix: {
      easy: configuration.difficultyMix.easy,
      medium: configuration.difficultyMix.medium,
      hard: configuration.difficultyMix.hard,
    },
    cells: [...configuration.cells]
      .map(({ module, subjectId, difficulty, count }) => ({
        module,
        subjectId,
        difficulty,
        count,
      }))
      .sort(
        (a, b) =>
          moduleOrder[a.module] - moduleOrder[b.module] ||
          compare(a.subjectId, b.subjectId) ||
          difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty],
      ),
    languages: [...configuration.languages]
      .map(({ subjectId, language, count }) => ({
        subjectId,
        language,
        count,
      }))
      .sort(
        (a, b) =>
          compare(a.subjectId, b.subjectId) || compare(a.language, b.language),
      ),
    concepts: [...configuration.concepts]
      .map(({ subjectId, subtopicId, conceptId, minimum }) => ({
        subjectId,
        subtopicId,
        conceptId,
        minimum,
      }))
      .sort(
        (a, b) =>
          compare(a.subjectId, b.subjectId) ||
          compare(a.subtopicId, b.subtopicId) ||
          compare(a.conceptId, b.conceptId),
      ),
  };
}

/** Identity bound into a blueprint hash from format 2 onward. */
export type BlueprintHashIdentity = {
  blueprintVersionId: string;
  blueprintId: string;
};

/**
 * Hash a normalized configuration under its stored format. Format 1 is the
 * frozen legacy payload and ignores identity; format 2 also binds the exact
 * blueprint version and stable identifier so a snapshot cannot be repointed.
 */
export async function blueprintContentHash(
  formatVersion: number,
  level: BlueprintLevel,
  taxonomyVersionId: string,
  configuration: BlueprintConfiguration,
  identity: BlueprintHashIdentity,
) {
  const normalized = normalizeBlueprintConfiguration(configuration);
  switch (formatVersion) {
    case 1:
      return await digest({
        formatVersion,
        level,
        taxonomyVersionId,
        configuration: normalized,
      });
    case 2:
      return await digest({
        formatVersion,
        level,
        taxonomyVersionId,
        blueprintVersionId: identity.blueprintVersionId,
        blueprintId: identity.blueprintId,
        configuration: normalized,
      });
    default:
      blueprintError("UNSUPPORTED_FORMAT_VERSION");
  }
}

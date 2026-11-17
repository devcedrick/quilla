import { describe, expect, it } from "vitest";
import { seedPolicy } from "../../scripts/question-bank-policy.mjs";
import { initialV3Blueprints } from "./blueprintFixture";
import {
  blueprintConfigurationFormatVersion,
  blueprintContentHash,
  blueprintPolicy,
  normalizeBlueprintConfiguration,
  validateBlueprintConfiguration,
  validateBlueprintIdentifier,
  type BlueprintConfiguration,
} from "./blueprintValidation";
import { digest } from "./questionContent";
import { initialV2Catalog } from "./taxonomyCatalog";

function expectCode(operation: () => unknown, code: string) {
  try {
    operation();
  } catch (error) {
    expect(error).toMatchObject({ data: { code } });
    return;
  }
  throw new Error(`Expected blueprint error ${code}`);
}

const professional = initialV3Blueprints.find(
  (blueprint) => blueprint.level === "professional",
)!;
const subprofessional = initialV3Blueprints.find(
  (blueprint) => blueprint.level === "subprofessional",
)!;

function clone(configuration: BlueprintConfiguration) {
  return structuredClone(configuration);
}

function cellKey(cell: BlueprintConfiguration["cells"][number]) {
  return `${cell.module}:${cell.subjectId}:${cell.difficulty}:${cell.count}`;
}

function policyCellKeys(level: "professional" | "subprofessional") {
  return (seedPolicy.cells as [string, string, number, number, number][])
    .filter(([module]) =>
      level === "professional"
        ? module !== "clerical"
        : !["professional-numerical", "analytical"].includes(module),
    )
    .flatMap(([module, subjectId, easy, medium, hard]) =>
      [
        ["easy", easy],
        ["medium", medium],
        ["hard", hard],
      ].map(
        ([difficulty, count]) =>
          `${module}:${subjectId}:${difficulty}:${count}`,
      ),
    )
    .sort();
}

function difficultyTotal(
  configuration: BlueprintConfiguration,
  difficulty: "easy" | "medium" | "hard",
) {
  return configuration.cells
    .filter((cell) => cell.difficulty === difficulty)
    .reduce((total, cell) => total + cell.count, 0);
}

describe("blueprint validation", () => {
  it("validates both approved v3 configurations and matches the documented totals", () => {
    for (const blueprint of initialV3Blueprints) {
      expect(() =>
        validateBlueprintConfiguration(
          blueprint.level,
          initialV2Catalog,
          blueprint.configuration,
        ),
      ).not.toThrow();
      expect(blueprint.configuration.scoredItems).toBe(
        blueprintPolicy[blueprint.level].scoredItems,
      );
      expect(blueprint.configuration.durationMinutes).toBe(
        blueprint.level === "professional" ? 168 : 141,
      );
      expect(blueprint.configuration.passingScore).toBe(
        blueprint.level === "professional" ? 120 : 116,
      );
      expect(blueprint.configuration.passingRatioBps).toBe(8000);
      expect(
        blueprint.configuration.concepts.map((concept) => concept.minimum),
      ).toEqual(
        Array.from(
          {
            length: blueprint.level === "professional" ? 9 : 10,
          },
          () => 1,
        ),
      );
    }
    expect(professional.configuration.cells.map(cellKey).sort()).toEqual(
      policyCellKeys("professional"),
    );
    expect(subprofessional.configuration.cells.map(cellKey).sort()).toEqual(
      policyCellKeys("subprofessional"),
    );
    expect(
      (["easy", "medium", "hard"] as const).map((difficulty) =>
        difficultyTotal(professional.configuration, difficulty),
      ),
    ).toEqual([45, 75, 30]);
    expect(
      (["easy", "medium", "hard"] as const).map((difficulty) =>
        difficultyTotal(subprofessional.configuration, difficulty),
      ),
    ).toEqual([43, 73, 29]);
    expect(seedPolicy.blueprints).toEqual(
      initialV3Blueprints.map((blueprint) => blueprint.blueprintId),
    );
    expect(
      professional.configuration.languages.filter(
        (row) => row.subjectId === "verbal_ability",
      ),
    ).toEqual([
      { subjectId: "verbal_ability", language: "english", count: 25 },
      { subjectId: "verbal_ability", language: "filipino", count: 25 },
    ]);
    for (const blueprint of initialV3Blueprints) {
      expect(
        blueprint.configuration.languages.some(
          (row) =>
            row.language === "filipino" && row.subjectId !== "verbal_ability",
        ),
      ).toBe(false);
    }
  });

  it("rejects invalid scored totals, cells, and module eligibility", () => {
    const lowTotal = clone(professional.configuration);
    lowTotal.scoredItems = 149;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          lowTotal,
        ),
      "INVALID_SCORED_ITEMS",
    );

    const missingCell = clone(professional.configuration);
    missingCell.cells.pop();
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          missingCell,
        ),
      "INVALID_SUBJECT_TOTAL",
    );

    const duplicateCell = clone(professional.configuration);
    duplicateCell.cells.push({ ...duplicateCell.cells[0] });
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          duplicateCell,
        ),
      "DUPLICATE_IDENTITY",
    );

    const clerical = clone(professional.configuration);
    clerical.cells = [
      {
        module: "clerical",
        subjectId: "clerical_ability",
        difficulty: "easy",
        count: 1,
      },
    ];
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          clerical,
        ),
      "INVALID_MODULE",
    );

    const analytical = clone(subprofessional.configuration);
    analytical.cells = [
      {
        module: "analytical",
        subjectId: "analytical_ability",
        difficulty: "easy",
        count: 1,
      },
    ];
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "subprofessional",
          initialV2Catalog,
          analytical,
        ),
      "INVALID_MODULE",
    );

    const mismatchedModule = clone(professional.configuration);
    mismatchedModule.cells[0] = {
      ...mismatchedModule.cells[0],
      module: "analytical",
    };
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          mismatchedModule,
        ),
      "INVALID_MODULE",
    );
  });

  it("rejects invalid difficulty mixes, aggregate counts, and cells", () => {
    const incomplete = clone(professional.configuration);
    incomplete.difficultyMix = { easy: 30, medium: 50, hard: 19 };
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          incomplete,
        ),
      "INVALID_DIFFICULTY_MIX",
    );

    const fractional = clone(professional.configuration);
    fractional.difficultyMix = { easy: 30.5, medium: 49.5, hard: 20 };
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          fractional,
        ),
      "INVALID_DIFFICULTY_MIX",
    );

    const policyMismatch = clone(professional.configuration);
    policyMismatch.difficultyMix = { easy: 40, medium: 40, hard: 20 };
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          policyMismatch,
        ),
      "INVALID_DIFFICULTY_MIX",
    );

    const counts = clone(professional.configuration);
    const easy = counts.cells.find(
      (cell) =>
        cell.module === "shared-core" &&
        cell.subjectId === "general_information" &&
        cell.difficulty === "easy",
    );
    const medium = counts.cells.find(
      (cell) =>
        cell.module === "shared-core" &&
        cell.subjectId === "general_information" &&
        cell.difficulty === "medium",
    );
    if (!easy || !medium) throw new Error("Fixture lacks difficulty cells");
    easy.count += 1;
    medium.count -= 1;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          counts,
        ),
      "INVALID_DIFFICULTY_TOTAL",
    );

    const redistributed = clone(professional.configuration);
    const cell = (subjectId: string, difficulty: "easy" | "medium") => {
      const found = redistributed.cells.find(
        (candidate) =>
          candidate.module === "shared-core" &&
          candidate.subjectId === subjectId &&
          candidate.difficulty === difficulty,
      );
      if (!found) throw new Error("Fixture lacks difficulty cells");
      return found;
    };
    cell("general_information", "easy").count += 5;
    cell("general_information", "medium").count -= 5;
    cell("verbal_ability", "easy").count -= 5;
    cell("verbal_ability", "medium").count += 5;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          redistributed,
        ),
      "INVALID_DIFFICULTY_CELL",
    );
  });

  it("rejects missing, extra, and duplicate language totals", () => {
    const missingFilipino = clone(professional.configuration);
    missingFilipino.languages = missingFilipino.languages.filter(
      (row) => row.language !== "filipino",
    );
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          missingFilipino,
        ),
      "INVALID_LANGUAGE_TOTAL",
    );

    const extraFilipino = clone(professional.configuration);
    extraFilipino.languages.push({
      subjectId: "general_information",
      language: "filipino",
      count: 1,
    });
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          extraFilipino,
        ),
      "INVALID_LANGUAGE_TOTAL",
    );

    const duplicate = clone(professional.configuration);
    duplicate.languages.push({ ...duplicate.languages[0] });
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          duplicate,
        ),
      "DUPLICATE_IDENTITY",
    );
  });

  it("requires one valid minimum for every applicable concept", () => {
    const missing = clone(professional.configuration);
    missing.concepts.pop();
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          missing,
        ),
      "MISSING_CONCEPT",
    );

    const unknown = clone(professional.configuration);
    unknown.concepts[0] = {
      ...unknown.concepts[0],
      conceptId: "unknown_concept",
    };
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          unknown,
        ),
      "UNKNOWN_CONCEPT",
    );

    const path = clone(professional.configuration);
    path.concepts[0] = {
      ...path.concepts[0],
      subtopicId: "reading",
    };
    expectCode(
      () =>
        validateBlueprintConfiguration("professional", initialV2Catalog, path),
      "UNKNOWN_CONCEPT",
    );

    const zero = clone(professional.configuration);
    zero.concepts[0] = { ...zero.concepts[0], minimum: 0 };
    expectCode(
      () =>
        validateBlueprintConfiguration("professional", initialV2Catalog, zero),
      "INVALID_CONCEPT_REQUIREMENT",
    );

    const overSubject = clone(professional.configuration);
    const verbalConcepts = overSubject.concepts.filter(
      (concept) => concept.subjectId === "verbal_ability",
    );
    verbalConcepts[0].minimum = 30;
    verbalConcepts[1].minimum = 30;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          overSubject,
        ),
      "INVALID_CONCEPT_REQUIREMENT",
    );

    const duplicate = clone(professional.configuration);
    duplicate.concepts.push({ ...duplicate.concepts[0] });
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          duplicate,
        ),
      "DUPLICATE_IDENTITY",
    );

    const archivedRows = initialV2Catalog.map((entry) =>
      entry.kind === "concept" && entry.key === "data_sufficiency"
        ? { ...entry, archived: true }
        : entry,
    );
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          archivedRows,
          professional.configuration,
        ),
      "UNKNOWN_CONCEPT",
    );

    const archivedSubject = initialV2Catalog.map((entry) =>
      entry.kind === "subject" && entry.key === "general_information"
        ? { ...entry, archived: true }
        : entry,
    );
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          archivedSubject,
          professional.configuration,
        ),
      "UNKNOWN_SUBJECT",
    );

    const ineligibleConcept = initialV2Catalog.map((entry) =>
      entry.kind === "concept" && entry.key === "data_sufficiency"
        ? { ...entry, levels: ["subprofessional"] }
        : entry,
    );
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          ineligibleConcept,
          professional.configuration,
        ),
      "UNKNOWN_CONCEPT",
    );
  });

  it("validates the scaled time limit and passing reference", () => {
    const duration = clone(professional.configuration);
    duration.durationMinutes = 167;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          duration,
        ),
      "INVALID_DURATION",
    );

    const passing = clone(professional.configuration);
    passing.passingScore = 119;
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          passing,
        ),
      "INVALID_PASSING_SCORE",
    );

    const ratio = clone(professional.configuration);
    ratio.passingRatioBps = 9000;
    ratio.passingScore = 135;
    expectCode(
      () =>
        validateBlueprintConfiguration("professional", initialV2Catalog, ratio),
      "INVALID_PASSING_SCORE",
    );
  });

  it("bounds configuration size and identifier format", () => {
    const oversized = clone(professional.configuration);
    oversized.concepts = Array.from({ length: 32 }, (_, index) => ({
      subjectId: `subject_${index}`.padEnd(100, "x"),
      subtopicId: `subtopic_${index}`.padEnd(100, "y"),
      conceptId: `concept_${index}`.padEnd(100, "z"),
      minimum: 1,
    }));
    expectCode(
      () =>
        validateBlueprintConfiguration(
          "professional",
          initialV2Catalog,
          oversized,
        ),
      "CONFIGURATION_TOO_LARGE",
    );

    expect(() =>
      validateBlueprintIdentifier("cse-professional-2027-v3"),
    ).not.toThrow();
    for (const invalid of ["", "CSE-PROFESSIONAL", "a".repeat(101), "a b"]) {
      expectCode(
        () => validateBlueprintIdentifier(invalid),
        "INVALID_IDENTIFIER",
      );
    }
  });

  it("hashes normalized configurations and binds format, level and taxonomy", async () => {
    const base = professional.configuration;
    const identity = {
      blueprintVersionId: "blueprint-version",
      blueprintId: "cse-professional-2027-v3",
    };
    const reordered = clone(base);
    reordered.cells.reverse();
    reordered.languages.reverse();
    reordered.concepts.reverse();
    expect(normalizeBlueprintConfiguration(reordered)).toEqual(
      normalizeBlueprintConfiguration(base),
    );
    const hash = await blueprintContentHash(
      blueprintConfigurationFormatVersion,
      "professional",
      "taxonomy-version",
      base,
      identity,
    );
    expect(
      await blueprintContentHash(
        blueprintConfigurationFormatVersion,
        "professional",
        "taxonomy-version",
        reordered,
        identity,
      ),
    ).toBe(hash);

    const changed = clone(base);
    changed.concepts[0] = { ...changed.concepts[0], minimum: 2 };
    expect(
      await blueprintContentHash(
        blueprintConfigurationFormatVersion,
        "professional",
        "taxonomy-version",
        changed,
        identity,
      ),
    ).not.toBe(hash);
    expect(
      await blueprintContentHash(
        blueprintConfigurationFormatVersion,
        "subprofessional",
        "taxonomy-version",
        base,
        identity,
      ),
    ).not.toBe(hash);
    expect(
      await blueprintContentHash(
        blueprintConfigurationFormatVersion,
        "professional",
        "other-taxonomy-version",
        base,
        identity,
      ),
    ).not.toBe(hash);
  });

  it("dispatches hashing by stored format and binds blueprint identity", async () => {
    const base = professional.configuration;
    const identity = {
      blueprintVersionId: "version-one",
      blueprintId: "cse-professional-2027-v3",
    };
    const legacy = await blueprintContentHash(
      1,
      "professional",
      "taxonomy-version",
      base,
      identity,
    );
    expect(legacy).toBe(
      await digest({
        formatVersion: 1,
        level: "professional",
        taxonomyVersionId: "taxonomy-version",
        configuration: normalizeBlueprintConfiguration(base),
      }),
    );
    expect(
      await blueprintContentHash(1, "professional", "taxonomy-version", base, {
        blueprintVersionId: "version-two",
        blueprintId: "cse-professional-2028-v4",
      }),
    ).toBe(legacy);

    const current = await blueprintContentHash(
      2,
      "professional",
      "taxonomy-version",
      base,
      identity,
    );
    expect(current).not.toBe(legacy);
    expect(
      await blueprintContentHash(2, "professional", "taxonomy-version", base, {
        ...identity,
        blueprintVersionId: "version-two",
      }),
    ).not.toBe(current);
    expect(
      await blueprintContentHash(2, "professional", "taxonomy-version", base, {
        ...identity,
        blueprintId: "cse-professional-2028-v4",
      }),
    ).not.toBe(current);

    await expect(
      blueprintContentHash(
        99,
        "professional",
        "taxonomy-version",
        base,
        identity,
      ),
    ).rejects.toMatchObject({ data: { code: "UNSUPPORTED_FORMAT_VERSION" } });
  });
});

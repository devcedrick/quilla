import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateQuestionBank } from "./validate-question-bank.mjs";

const root = "content/question-bank/family-04";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const load = async (paths) =>
  (
    await Promise.all(
      paths.map(async (p) =>
        JSON.parse(await readFile(`${root}/${p}`, "utf8")),
      ),
    )
  ).flat();
const questions = await load(manifest.sources[0].questionFiles);
const references = await load(manifest.sources[0].referenceFiles);

describe("Family 04 offline content", () => {
  it("meets the independent family contract and all subject difficulty targets", async () => {
    const result = await validateQuestionBank(`${root}/manifest.json`, "seed");
    expect(result.issues).toEqual([]);
    expect(questions).toHaveLength(270);
    for (const [subject, total] of Object.entries({
      general_information: 40,
      verbal_ability: 50,
      numerical_ability: 60,
      analytical_ability: 80,
      clerical_ability: 40,
    })) {
      const rows = questions.filter((q) => q.subjectId === subject);
      expect(rows).toHaveLength(total);
      expect(
        ["easy", "medium", "hard"].map(
          (d) => rows.filter((q) => q.difficulty === d).length,
        ),
      ).toEqual([total * 0.3, total * 0.5, total * 0.2]);
    }
    const verbal = questions.filter((q) => q.subjectId === "verbal_ability");
    expect(verbal.filter((q) => q.language === "english")).toHaveLength(25);
    expect(verbal.filter((q) => q.language === "filipino")).toHaveLength(25);
  });
  it("gives every reading and paragraph item a dedicated matching reference", () => {
    const rows = questions.filter(
      (q) =>
        q.subjectId === "verbal_ability" &&
        ["reading", "discourse"].includes(q.subtopicId),
    );
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((q) => q.reference.referenceId)).size).toBe(24);
    for (const q of rows) {
      const ref = references.find(
        (r) => r.referenceId === q.reference.referenceId,
      );
      expect(ref).toBeDefined();
      expect(ref.version).toBe(q.reference.referenceVersion);
      expect(ref.language).toBe(q.language);
      expect(
        questions.filter(
          (row) => row.reference?.referenceId === ref.referenceId,
        ),
      ).toHaveLength(1);
    }
  });
  it("passes independent numerical, sufficiency, sorting and clerical calculations", async () => {
    await import("./family04-numerical-clerical-check.mjs");
  });
  it("passes reviewer enumeration of interacting data and logic constraints", async () => {
    await import("./verify-family04-analytical.mjs");
  });
  it("has no cross-family ID or normalized full-task duplicate", async () => {
    const { auditResult } = await import("./audit-family04-quality.mjs");
    expect(auditResult.exact).toEqual([]);
    expect(
      auditResult.inventories.find((f) => f.name === "family-04").count,
    ).toBe(270);
  });
});

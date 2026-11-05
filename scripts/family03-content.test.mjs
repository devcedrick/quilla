import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { validateQuestionBank } from "./validate-question-bank.mjs";

const root = "content/question-bank/family-03";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const load = async (base, paths) =>
  (
    await Promise.all(
      paths.map(async (p) =>
        JSON.parse(await readFile(`${base}/${p}`, "utf8")),
      ),
    )
  ).flat();
const questions = await load(root, manifest.sources[0].questionFiles);
const references = await load(root, manifest.sources[0].referenceFiles);

describe("Family 03 integration", () => {
  it("is a complete independent seed bank with exact per-subject difficulty targets", async () => {
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
    for (const language of ["english", "filipino"])
      expect(
        questions.filter(
          (q) => q.subjectId === "verbal_ability" && q.language === language,
        ),
      ).toHaveLength(25);
  });

  it("preserves level boundaries, self-contained DS choices, and position-independent explanations", () => {
    for (const q of questions) {
      if (q.subjectId === "analytical_ability")
        expect(q.levelApplicability).toEqual(["professional"]);
      if (q.subjectId === "clerical_ability")
        expect(q.levelApplicability).toEqual(["subprofessional"]);
      if (q.conceptId === "data_sufficiency") {
        expect(q.choices).toHaveLength(5);
        expect(q.choices.every((c) => c.text.length > 25)).toBe(true);
      }
      expect(q.explanation).not.toMatch(
        /(?:first|second|third|fourth|last) (?:choice|option)/i,
      );
    }
  });

  it("gives every reading/paragraph question its own reference", () => {
    const rows = questions.filter((q) =>
      [
        "reading_comprehension_test",
        "paragraph_organization_test_questions",
      ].includes(q.conceptId),
    );
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((q) => q.reference.referenceId);
    expect(new Set(ids).size).toBe(rows.length);
    for (const q of rows)
      expect(
        references.some(
          (r) =>
            r.referenceId === q.reference.referenceId &&
            r.version === q.reference.referenceVersion &&
            r.language === q.language,
        ),
      ).toBe(true);
  });

  it("does not reuse canonical IDs or complete tasks from earlier families", async () => {
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const fingerprint = (q, refs) =>
      JSON.stringify([
        normalize(q.stem),
        q.choices.map((c) => normalize(c.text)).sort(),
        q.reference
          ? refs.find((r) => r.referenceId === q.reference.referenceId)?.blocks
          : null,
      ]);
    for (const family of ["01", "02"]) {
      const base = `content/question-bank/family-${family}`;
      const priorManifest = JSON.parse(
        await readFile(`${base}/manifest.json`, "utf8"),
      );
      const prior = await load(base, priorManifest.sources[0].questionFiles);
      const priorReferences = await load(
        base,
        priorManifest.sources[0].referenceFiles,
      );
      const ids = new Set(prior.map((q) => q.questionId));
      const tasks = new Set(prior.map((q) => fingerprint(q, priorReferences)));
      const priorText = new Set(
        priorReferences.flatMap((r) =>
          r.blocks
            .filter((b) => b.type === "text")
            .map((b) => normalize(b.text)),
        ),
      );
      for (const q of questions) {
        expect(ids.has(q.questionId)).toBe(false);
        expect(tasks.has(fingerprint(q, references))).toBe(false);
      }
      for (const r of references)
        for (const b of r.blocks.filter((b) => b.type === "text"))
          expect(priorText.has(normalize(b.text))).toBe(false);
    }
  });
});

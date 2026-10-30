import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { validateQuestionBank } from "./validate-question-bank.mjs";
import { policy } from "./question-bank-policy.mjs";

const provenance = {
  kind: "synthetic",
  author: "Test fixture",
  assistance: "Generated in test",
  sources: [],
};
function corpus() {
  const questions = [];
  for (let family = 1; family <= 8; family++)
    for (const [module, subjectId, ...counts] of policy.cells) {
      let n = 0;
      const p = policy.concepts[subjectId];
      const pairs = typeof p[0] === "string" ? [p] : p;
      for (const [i, difficulty] of ["easy", "medium", "hard"].entries())
        for (let k = 0; k < counts[i]; k++) {
          const questionId = `f${family}-${module}-${subjectId}-${n}`;
          const [subtopicId, conceptId] = pairs[n % pairs.length];
          questions.push({
            questionId,
            version: 1,
            family,
            module,
            subjectId,
            subtopicId,
            conceptId,
            levelApplicability:
              module === "shared-core"
                ? ["professional", "subprofessional"]
                : [module === "clerical" ? "subprofessional" : "professional"],
            language:
              subjectId === "verbal_ability" && n >= 25
                ? "filipino"
                : "english",
            difficulty,
            stem: `Synthetic ${questionId}?`,
            choices: [
              { choiceId: "a", text: "First" },
              { choiceId: "b", text: "Second" },
            ],
            correctChoiceId: "a",
            explanation:
              "Synthetic fixture explanation; not educational content.",
            provenance,
          });
          n++;
        }
    }
  return {
    manifest: {
      formatVersion: 1,
      corpusId: "synthetic-test",
      revision: 1,
      taxonomyId: policy.taxonomy,
      blueprintIds: policy.blueprints,
      questionFiles: ["questions.json"],
      referenceFiles: ["references.json"],
      assetFiles: ["assets.json"],
    },
    questions,
    references: [],
    assets: [],
  };
}
async function fixture(data, run) {
  const root = await mkdtemp(path.join(tmpdir(), "quilla-corpus-"));
  try {
    for (const [name, value] of Object.entries(data))
      await writeFile(path.join(root, `${name}.json`), JSON.stringify(value));
    await run(path.join(root, "manifest.json"), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function reference(data) {
  const q = data.questions.find((q) => q.subjectId === "verbal_ability");
  const r = {
    referenceId: "passage",
    version: 1,
    family: 1,
    module: "shared-core",
    language: "english",
    title: "Synthetic passage",
    blocks: [
      { type: "text", text: "A library opened on Monday." },
      {
        type: "table",
        caption: "Hours",
        headers: ["Day", "Hours"],
        rows: [["Monday", "8"]],
      },
    ],
    provenance,
  };
  data.references.push(r);
  q.reference = { referenceId: r.referenceId, referenceVersion: 1 };
  data.questions.find(
    (other) => other !== q && other.subjectId === "verbal_ability",
  ).reference = { ...q.reference };
  return r;
}
const errors = (r) => r.issues.filter((i) => i.severity === "error");
describe("offline corpus contract", () => {
  it("validates dataset checksums while excluding external sign-off", async () => {
    const d = corpus();
    await fixture(d, async (file) => {
      const initial = await validateQuestionBank(file);
      d.manifest.datasetChecksum = initial.checksum;
      d.manifest.signOff = { actor: "test", note: "not authority" };
      await writeFile(file, JSON.stringify(d.manifest));
      expect(errors(await validateQuestionBank(file))).toEqual([]);
      d.manifest.datasetChecksum = "0".repeat(64);
      await writeFile(file, JSON.stringify(d.manifest));
      expect(
        errors(await validateQuestionBank(file)).some(
          (i) => i.rule === "dataset-checksum",
        ),
      ).toBe(true);
    });
  });
  it("matches the documented matrices and validates 1,520 unique items", async () => {
    const doc = await readFile(
      "docs/exams/cse-taxonomy-and-blueprints.md",
      "utf8",
    );
    for (const c of Object.values(policy.concepts).flat())
      for (const id of Array.isArray(c) ? c : [c])
        expect(doc).toContain(`\`${id}\``);
    expect(policy.cells.map((c) => c.slice(2))).toEqual([
      [6, 10, 4],
      [15, 25, 10],
      [10, 18, 7],
      [2, 2, 1],
      [12, 20, 8],
      [12, 20, 8],
    ]);
    await fixture(corpus(), async (file) => {
      const r = await validateQuestionBank(file, "release");
      expect(errors(r)).toEqual([]);
      expect(r.summary.questions).toBe(1520);
      expect(r.summary.professionalExams).toBe(8);
      expect(r.summary.distributions.level).toEqual({
        professional: 1200,
        subprofessional: 1160,
      });
    });
  });
  it("accepts standalone drafts and reports incomplete release coverage", async () => {
    const data = corpus();
    data.questions = data.questions.slice(0, 1);
    await fixture(data, async (file) => {
      expect(errors(await validateQuestionBank(file))).toEqual([]);
      expect(
        errors(await validateQuestionBank(file, "release")).length,
      ).toBeGreaterThan(0);
    });
  });
  it("shares composite references without inflating counts, and detects content changes", async () => {
    const data = corpus();
    const ref = reference(data);
    await fixture(data, async (file, root) => {
      const initial = await validateQuestionBank(file, "release");
      expect(errors(initial)).toEqual([]);
      expect(initial.summary.references).toBe(1);
      await writeFile(file, JSON.stringify(data.manifest, null, 2));
      expect((await validateQuestionBank(file, "release")).checksum).toBe(
        initial.checksum,
      );
      ref.blocks[0].text = "Changed passage";
      await writeFile(
        path.join(root, "references.json"),
        JSON.stringify(data.references),
      );
      expect((await validateQuestionBank(file)).checksum).not.toBe(
        initial.checksum,
      );
    });
  });
  it.each([
    [
      "taxonomy",
      (d) => {
        d.questions[0].subjectId = "constructor";
      },
    ],
    [
      "block-type",
      (d) => {
        reference(d).blocks[0].type = "constructor";
      },
    ],
    [
      "reference-link",
      (d) => {
        reference(d);
        d.references[0].version = 2;
      },
    ],
    [
      "reference-link",
      (d) => {
        reference(d);
        d.references[0].language = "filipino";
      },
    ],
    [
      "reference-link",
      (d) => {
        reference(d);
        d.references[0].module = "analytical";
      },
    ],
    [
      "block-content",
      (d) => {
        reference(d).blocks[1].rows = [["broken"]];
      },
    ],
    [
      "unknown-field",
      (d) => {
        d.questions[0].approved = true;
      },
    ],
    [
      "answer",
      (d) => {
        d.questions[0].correctChoiceId = "missing";
      },
    ],
    [
      "choice",
      (d) => {
        d.questions[0].choices[1].text = " FIRST ";
      },
    ],
    [
      "identity",
      (d) => {
        d.questions[1].questionId = d.questions[0].questionId;
      },
    ],
    [
      "applicability",
      (d) => {
        d.questions[0].levelApplicability = ["subprofessional"];
      },
    ],
    [
      "taxonomy",
      (d) => {
        d.questions[0].conceptId = "unknown";
      },
    ],
    [
      "difficulty-cell",
      (d) => {
        d.questions[0].difficulty = "hard";
      },
    ],
    [
      "verbal-language",
      (d) => {
        d.questions.find((q) => q.subjectId === "verbal_ability").language =
          "filipino";
      },
    ],
    [
      "concept-minimum",
      (d) => {
        for (const q of d.questions.filter(
          (q) => q.subjectId === "verbal_ability",
        )) {
          q.subtopicId = "vocabulary";
          q.conceptId = "vocabulary_questions";
        }
      },
    ],
  ])("rejects %s", async (rule, mutate) => {
    const d = corpus();
    mutate(d);
    await fixture(d, async (file) =>
      expect(
        errors(await validateQuestionBank(file, "release")).some(
          (i) => i.rule === rule,
        ),
      ).toBe(true),
    );
  });
  it("checks images, accessibility and altered bytes", async () => {
    const d = corpus();
    const r = reference(d);
    // Valid tiny PNG fixture, kept out of the source corpus.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    d.assets.push({
      assetId: "graph",
      path: "graph.png",
      mediaType: "image/png",
      sha256: createHash("sha256").update(png).digest("hex"),
      width: 1,
      height: 1,
      provenance,
    });
    r.blocks.push({
      type: "image",
      assetId: "graph",
      caption: "Synthetic",
      alt: "Test pixel",
      description: "Test image; no answer information.",
    });
    await fixture(d, async (file, root) => {
      await writeFile(path.join(root, "graph.png"), png);
      expect(errors(await validateQuestionBank(file, "release"))).toEqual([]);
      r.blocks[2].alt = "";
      await writeFile(
        path.join(root, "references.json"),
        JSON.stringify(d.references),
      );
      expect(
        errors(await validateQuestionBank(file)).some(
          (i) => i.rule === "block-content",
        ),
      ).toBe(true);
      await writeFile(path.join(root, "graph.png"), Buffer.alloc(40));
      const result = await validateQuestionBank(file);
      expect(result.issues.some((i) => i.rule === "asset-checksum")).toBe(true);
      expect(result.issues.some((i) => i.rule === "image")).toBe(true);
    });
  });
  it("reports unused records and duplicate candidates deterministically", async () => {
    const d = corpus();
    reference(d);
    delete d.questions.find((q) => q.reference).reference;
    for (const q of d.questions) delete q.reference;
    d.questions[1].stem = d.questions[0].stem;
    await fixture(d, async (file) => {
      const a = await validateQuestionBank(file);
      expect(a).toEqual(await validateQuestionBank(file));
      expect(
        a.issues.some(
          (i) => i.rule === "unreferenced" && i.severity === "warning",
        ),
      ).toBe(true);
      expect(a.issues.some((i) => i.rule === "duplicate-candidate")).toBe(true);
      expect(
        errors(await validateQuestionBank(file, "release")).some(
          (i) => i.rule === "unreferenced",
        ),
      ).toBe(true);
    });
  });
  it("confines paths and documents CLI exit codes", async () => {
    const d = corpus();
    d.questions = d.questions.slice(0, 1);
    await fixture(d, async (file, root) => {
      const cli = (...args) =>
        spawnSync(
          process.execPath,
          ["scripts/validate-question-bank.mjs", ...args],
          { encoding: "utf8" },
        );
      expect(cli("--manifest", file, "--mode", "draft", "--json").status).toBe(
        0,
      );
      expect(cli("--manifest", file, "--mode", "release").status).toBe(1);
      expect(cli("--bad").status).toBe(2);
      await writeFile(path.join(root, "questions.json"), "invalid JSON");
      expect(cli("--manifest", file, "--mode", "draft").status).toBe(1);
      for (const unsafe of [
        "../outside.json",
        "C:/outside.json",
        "/outside.json",
        "a\\b.json",
      ]) {
        d.manifest.questionFiles = [unsafe];
        await writeFile(file, JSON.stringify(d.manifest));
        await expect(validateQuestionBank(file)).rejects.toThrow(/Unsafe/);
      }
      // Symlink tests are permitted where the host grants symlink creation.
      try {
        await symlink(
          path.resolve("package.json"),
          path.join(root, "outside.json"),
        );
      } catch (e) {
        if (e.code !== "EPERM") throw e;
        return;
      }
      d.manifest.questionFiles = ["outside.json"];
      await writeFile(file, JSON.stringify(d.manifest));
      await expect(validateQuestionBank(file)).rejects.toThrow(/leaves corpus/);
    });
  });
});

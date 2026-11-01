import { describe, it, expect } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  readdir,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { validateQuestionBank } from "./validate-question-bank.mjs";
import { policy, seedPolicy } from "./question-bank-policy.mjs";

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

function seedCorpus() {
  const data = corpus();
  data.manifest = {
    formatVersion: 2,
    corpusId: "synthetic-seed",
    revision: 1,
    taxonomyId: seedPolicy.taxonomy,
    blueprintIds: seedPolicy.blueprints,
    seedFamilies: [1],
    sources: [
      {
        root: "",
        questionFiles: ["questions.json"],
        referenceFiles: ["references.json"],
        assetFiles: ["assets.json"],
      },
    ],
  };
  data.questions = [];
  for (const [subjectId, count] of Object.entries(seedPolicy.seedSubjects)) {
    const concepts = seedPolicy.concepts[subjectId];
    const pairs = typeof concepts[0] === "string" ? [concepts] : concepts;
    for (let n = 0; n < count; n++) {
      const moduleId =
        subjectId === "analytical_ability"
          ? "analytical"
          : subjectId === "clerical_ability"
            ? "clerical"
            : "shared-core";
      const [subtopicId, conceptId] = pairs[n % pairs.length];
      data.questions.push({
        questionId: `seed-${subjectId}-${n}`,
        version: 1,
        family: 1,
        module: moduleId,
        subjectId,
        subtopicId,
        conceptId,
        levelApplicability:
          moduleId === "shared-core"
            ? ["professional", "subprofessional"]
            : [moduleId === "clerical" ? "subprofessional" : "professional"],
        language:
          subjectId === "verbal_ability" && n >= 25 ? "filipino" : "english",
        // Deliberately not exam difficulty cells: seed completeness is separate.
        difficulty: "easy",
        stem: `Synthetic seed ${subjectId} ${n}?`,
        choices: [
          { choiceId: "a", text: "One" },
          { choiceId: "b", text: "Two" },
        ],
        correctChoiceId: "a",
        explanation: "Synthetic seed fixture, not product content.",
        provenance,
      });
    }
  }
  return data;
}

describe("seed-family validation (ADR 0013)", () => {
  it("accepts 270 seed items with v2 concepts without requiring exam cells or publication", async () => {
    await fixture(seedCorpus(), async (file) => {
      const result = await validateQuestionBank(file, "seed");
      expect(errors(result)).toEqual([]);
      expect(result.summary.questions).toBe(270);
      expect(result.summary.completeSeedFamilies).toBe(1);
      expect(result.summary.examReadiness).toBe("not-evaluated");
      expect(result.summary.coverage[0].subjects.general_information).toEqual({
        expected: 40,
        actual: 40,
        difficulties: { easy: 40, medium: 0, hard: 0 },
      });
      expect(result.summary).not.toHaveProperty("professionalExams");
      expect(result).toEqual(await validateQuestionBank(file, "seed"));
    });
  });

  it.each([
    [
      "seed-subject-count",
      (d) => {
        d.questions.pop();
      },
    ],
    [
      "seed-question-count",
      (d) => {
        d.questions.pop();
      },
    ],
    [
      "seed-assignment",
      (d) => {
        d.questions[0].family = 2;
      },
    ],
    [
      "seed-families",
      (d) => {
        d.manifest.seedFamilies = [1, 1];
      },
    ],
    [
      "seed-families",
      (d) => {
        d.manifest.seedFamilies = [];
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
      "applicability",
      (d) => {
        d.questions.find((q) => q.module === "clerical").levelApplicability = [
          "professional",
        ];
      },
    ],
    [
      "applicability",
      (d) => {
        d.questions.find((q) => q.module === "analytical").levelApplicability =
          ["subprofessional"];
      },
    ],
    [
      "taxonomy",
      (d) => {
        d.questions.find((q) => q.conceptId === "spelling").subtopicId =
          "language_accuracy";
      },
    ],
    [
      "taxonomy",
      (d) => {
        d.questions.find((q) => q.module === "analytical").module = "clerical";
      },
    ],
    [
      "identity",
      (d) => {
        d.questions[1].questionId = d.questions[0].questionId;
      },
    ],
    [
      "answer",
      (d) => {
        d.questions[0].correctChoiceId = "missing";
      },
    ],
    [
      "policy",
      (d) => {
        d.manifest.blueprintIds = policy.blueprints;
      },
    ],
    [
      "sources",
      (d) => {
        d.manifest.sources = [];
      },
    ],
  ])("rejects seed %s violations", async (rule, mutate) => {
    const data = seedCorpus();
    mutate(data);
    await fixture(data, async (file) => {
      const result = await validateQuestionBank(file, "seed");
      expect(errors(result).some((i) => i.rule === rule)).toBe(true);
      expect(result.summary.completeSeedFamilies).toBe(0);
    });
  });

  it("keeps legacy modes bound to legacy metadata", async () => {
    await fixture(seedCorpus(), async (file) => {
      expect(
        errors(await validateQuestionBank(file)).some(
          (i) => i.rule === "policy",
        ),
      ).toBe(true);
    });
    await fixture(corpus(), async (file) => {
      expect(
        errors(await validateQuestionBank(file, "seed")).some(
          (i) => i.rule === "manifest-identity",
        ),
      ).toBe(true);
    });
  });

  it("validates the independent Family 01 bank", async () => {
    const result = await validateQuestionBank(
      "content/question-bank/family-01/manifest.json",
      "seed",
    );
    expect(errors(result)).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.summary.questions).toBe(270);
    expect(result.summary.distributions.subjectId).toEqual(
      seedPolicy.seedSubjects,
    );
    expect(result.summary.completeSeedFamilies).toBe(1);
  });

  it("preserves Family 01 records in topic files under its own manifest", async () => {
    const bank = "content/question-bank";
    const root = `${bank}/family-01`;
    const manifest = JSON.parse(
      await readFile(`${root}/manifest.json`, "utf8"),
    );
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0].root).toBe("");
    expect(manifest.seedFamilies).toEqual([1]);
    expect(manifest.sources[0].questionFiles).toHaveLength(17);
    expect(
      manifest.sources[0].questionFiles.every((file) =>
        file.startsWith("content/"),
      ),
    ).toBe(true);
    expect(
      manifest.sources[0].referenceFiles.every((file) =>
        file.startsWith("references/"),
      ),
    ).toBe(true);
    const names = await readdir(bank);
    expect(names).not.toContain("cse-2027-v1");
    expect(names).not.toContain("cse-2027-v2");
    expect(names).not.toContain("seed-family01.manifest.json");
    expect(names).not.toContain("manifest.json");
    expect(names).not.toContain("questions.json");
    expect((await readdir(root)).sort()).toEqual([
      "content",
      "manifest.json",
      "references",
    ]);
    const questions = (
      await Promise.all(
        manifest.sources[0].questionFiles.map(async (file) =>
          JSON.parse(await readFile(`${root}/${file}`, "utf8")),
        ),
      )
    ).flat();
    const family = questions.filter((q) => q.family === 1);
    expect(family).toHaveLength(270);
    // Revision-5 reviewed content fingerprint; editorial changes are itemized in
    // docs/content/family01-quality-revision.md, not label-only adjustments.
    const digest = createHash("sha256")
      .update(
        JSON.stringify(
          family.sort((a, b) => a.questionId.localeCompare(b.questionId)),
        ),
      )
      .digest("hex");
    expect(digest).toBe(
      "c210317d778e5a9edd74d1557791ca54a02687f265739ea6af0d13f65c7298e9",
    );
  });

  it("rejects undeclared per-family content files", async () => {
    await fixture(seedCorpus(), async (file, root) => {
      await mkdir(path.join(root, "content"));
      await writeFile(path.join(root, "content", "forgotten.json"), "[]");
      expect(
        errors(await validateQuestionBank(file, "seed")).some(
          (issue) => issue.rule === "undeclared-file",
        ),
      ).toBe(true);
    });
  });

  it("resolves source-local assets and references, and checks undeclared JSON", async () => {
    const data = seedCorpus();
    reference(data);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    );
    data.assets.push({
      assetId: "pixel",
      path: "pixel.png",
      mediaType: "image/png",
      sha256: createHash("sha256").update(png).digest("hex"),
      width: 1,
      height: 1,
      provenance,
    });
    data.references[0].blocks.push({
      type: "image",
      assetId: "pixel",
      caption: "Pixel",
      alt: "Synthetic pixel",
      description: "No answer content.",
    });
    data.manifest.sources[0].root = "nested";
    await fixture(data, async (file, root) => {
      await mkdir(path.join(root, "nested", "families"), { recursive: true });
      for (const name of ["questions", "references", "assets"])
        await writeFile(
          path.join(root, "nested", `${name}.json`),
          JSON.stringify(data[name]),
        );
      await writeFile(path.join(root, "nested", "pixel.png"), png);
      expect(errors(await validateQuestionBank(file, "seed"))).toEqual([]);
      await writeFile(
        path.join(root, "nested", "families", "forgotten.json"),
        "[]",
      );
      expect(
        errors(await validateQuestionBank(file, "seed")).some(
          (i) => i.rule === "undeclared-file",
        ),
      ).toBe(true);
    });
  });

  it("checks cross-source identities and duplicate content", async () => {
    const data = seedCorpus();
    data.manifest.sources.push({
      root: "second",
      questionFiles: ["questions.json"],
      referenceFiles: [],
      assetFiles: [],
    });
    await fixture(data, async (file, root) => {
      await mkdir(path.join(root, "second"));
      await writeFile(
        path.join(root, "second", "questions.json"),
        JSON.stringify([data.questions[0]]),
      );
      const result = await validateQuestionBank(file, "seed");
      expect(errors(result).some((i) => i.rule === "identity")).toBe(true);
      expect(result.issues.some((i) => i.rule === "duplicate-candidate")).toBe(
        true,
      );
    });
  });

  it("rejects unsafe source and asset paths", async () => {
    for (const unsafe of ["../escape", "C:/escape", "/escape", "a\\b"]) {
      const data = seedCorpus();
      data.manifest.sources[0].root = unsafe;
      await fixture(data, async (file) => {
        await expect(validateQuestionBank(file, "seed")).rejects.toThrow(
          /Unsafe/,
        );
      });
    }
    const data = seedCorpus();
    data.assets.push({
      assetId: "escape",
      path: "../outside.png",
      width: 1,
      height: 1,
      mediaType: "image/png",
      sha256: "0".repeat(64),
      provenance,
    });
    await fixture(data, async (file) => {
      await expect(validateQuestionBank(file, "seed")).rejects.toThrow(
        /Unsafe/,
      );
    });
  });

  it("binds source inventory and content to the checksum, not external sign-off", async () => {
    const data = seedCorpus();
    await fixture(data, async (file, root) => {
      const initial = await validateQuestionBank(file, "seed");
      data.manifest.datasetChecksum = initial.checksum;
      data.manifest.signOff = {
        note: "test evidence, not publication authority",
      };
      await writeFile(file, JSON.stringify(data.manifest));
      expect(errors(await validateQuestionBank(file, "seed"))).toEqual([]);
      data.questions[0].explanation = "Changed explanation.";
      await writeFile(
        path.join(root, "questions.json"),
        JSON.stringify(data.questions),
      );
      expect(
        errors(await validateQuestionBank(file, "seed")).some(
          (i) => i.rule === "dataset-checksum",
        ),
      ).toBe(true);
    });
  });

  it("supports multiple complete seed families without independent exam quotas", async () => {
    const data = seedCorpus();
    data.manifest.seedFamilies = [1, 2];
    data.questions.push(
      ...data.questions.map((q) => ({
        ...q,
        questionId: `${q.questionId}-f2`,
        family: 2,
        stem: `${q.stem} Family two.`,
      })),
    );
    await fixture(data, async (file) => {
      const result = await validateQuestionBank(file, "seed");
      expect(errors(result)).toEqual([]);
      expect(result.summary.completeSeedFamilies).toBe(2);
      expect(result.summary.questions).toBe(540);
    });
  });

  it("confines source-local file paths and rejects inventory symlinks", async () => {
    const data = seedCorpus();
    data.manifest.sources[0].questionFiles = ["../questions.json"];
    await fixture(data, async (file) => {
      await expect(validateQuestionBank(file, "seed")).rejects.toThrow(
        /Unsafe/,
      );
    });
    await fixture(seedCorpus(), async (file, root) => {
      await mkdir(path.join(root, "families"));
      try {
        await symlink(
          path.resolve("package.json"),
          path.join(root, "families", "outside.json"),
        );
      } catch (error) {
        if (error.code !== "EPERM") throw error;
        return;
      }
      await expect(validateQuestionBank(file, "seed")).rejects.toThrow(
        /Unsafe inventory symlink/,
      );
    });
  });

  it("uses seed-aware CLI output and refuses unsafe invocation", async () => {
    await fixture(seedCorpus(), async (file) => {
      const cli = (...args) =>
        spawnSync(
          process.execPath,
          ["scripts/validate-question-bank.mjs", ...args],
          { encoding: "utf8" },
        );
      const valid = cli("--manifest", file, "--mode", "seed");
      expect(valid.status).toBe(0);
      expect(valid.stdout).toContain(
        "1 complete seed families; exam readiness not evaluated",
      );
      expect(valid.stdout).not.toContain("paired families");
      const json = cli("--manifest", file, "--mode", "seed", "--json");
      expect(json.status).toBe(0);
      expect(JSON.parse(json.stdout).summary.questions).toBe(270);
      expect(cli("--manifest", file, "--mode", "unknown").status).toBe(2);
      expect(
        cli("--manifest", file, "--mode", "seed", "--mode", "seed").status,
      ).toBe(2);
    });
  });
});

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

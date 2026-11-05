import { readFile } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { validateQuestionBank } from "./validate-question-bank.mjs";
const root = "content/question-bank/family-02";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const questions = (
  await Promise.all(
    manifest.sources[0].questionFiles.map(async (f) =>
      JSON.parse(await readFile(`${root}/${f}`, "utf8")),
    ),
  )
).flat();
const refs = JSON.parse(
  await readFile(`${root}/references/f02-supporting-material.json`, "utf8"),
);
const get = (topic, n, lang = "english") =>
  questions.find(
    (q) =>
      q.questionId === `f02-${topic}-${lang}-${String(n).padStart(2, "0")}`,
  );
const answer = (topic, n) => {
  const q = get(topic, n);
  return q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
};
const permutations = (a) =>
  a.length
    ? a.flatMap((v, i) =>
        permutations(a.filter((_, j) => i !== j)).map((t) => [v, ...t]),
      )
    : [[]];
describe("Family 02 content gates", () => {
  it("passes its independently pinned seed manifest", async () => {
    const result = await validateQuestionBank(`${root}/manifest.json`, "seed");
    expect(result.issues).toEqual([]);
    expect(result.summary.questions).toBe(270);
    expect(result.summary.assets).toBe(10);
  });
  it("links every data question to a registered chart and equivalent source table", async () => {
    const assets = JSON.parse(
      await readFile(`${root}/references/f02-chart-assets.json`, "utf8"),
    );
    expect(assets).toHaveLength(10);
    const consumers = new Map();
    for (const q of questions.filter(
      (q) => q.conceptId === "graphs_charts_and_data",
    )) {
      const ref = refs.find((r) => r.referenceId === q.reference.referenceId);
      const images = ref.blocks.filter((b) => b.type === "image");
      const tables = ref.blocks.filter((b) => b.type === "table");
      expect(images).toHaveLength(1);
      expect(tables).toHaveLength(1);
      const chart = images[0],
        table = tables[0];
      const expectedVersion = [
        "f02-rainfall-chart",
        "f02-produce-chart",
      ].includes(chart.assetId)
        ? 2
        : 3;
      expect(q.version).toBe(
        ["f02-data-english-15", "f02-data-english-16"].includes(q.questionId)
          ? expectedVersion + 1
          : expectedVersion,
      );
      expect(q.reference.referenceVersion).toBe(expectedVersion);
      expect(ref.version).toBe(expectedVersion);
      expect(assets.some((a) => a.assetId === chart.assetId)).toBe(true);
      expect(chart.caption).toBe(table.caption);
      const expected = table.rows
        .map(
          (row) =>
            `${row[0]}: ${table.headers
              .slice(1)
              .map((h, i) => `${h} = ${row[i + 1]}`)
              .join("; ")}.`,
        )
        .join(" ");
      expect(chart.description).toBe(expected);
      consumers.set(chart.assetId, (consumers.get(chart.assetId) || 0) + 1);
    }
    expect([...consumers.values()]).toEqual(Array(10).fill(4));
    for (const asset of assets) {
      const bytes = await readFile(`${root}/${asset.path}`);
      expect(bytes.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
    }
  });
  it("keeps subject-level 30/50/20, all concepts, and language eligibility", () => {
    for (const [id, total] of Object.entries({
      general_information: 40,
      verbal_ability: 50,
      numerical_ability: 60,
      analytical_ability: 80,
      clerical_ability: 40,
    })) {
      const rows = questions.filter((q) => q.subjectId === id);
      expect(rows).toHaveLength(total);
      expect(
        ["easy", "medium", "hard"].map(
          (d) => rows.filter((q) => q.difficulty === d).length,
        ),
      ).toEqual([total * 0.3, total * 0.5, total * 0.2]);
    }
    expect(new Set(questions.map((q) => q.conceptId)).size).toBe(12);
    for (const lang of ["english", "filipino"])
      expect(
        questions.filter(
          (q) => q.subjectId === "verbal_ability" && q.language === lang,
        ),
      ).toHaveLength(25);
    expect(
      questions
        .filter((q) => q.subjectId === "analytical_ability")
        .every(
          (q) => JSON.stringify(q.levelApplicability) === '["professional"]',
        ),
    ).toBe(true);
    expect(
      questions
        .filter((q) => q.subjectId === "clerical_ability")
        .every(
          (q) => JSON.stringify(q.levelApplicability) === '["subprofessional"]',
        ),
    ).toBe(true);
  });
  it("keeps all reading passages and paragraph sets dedicated and exactly version-linked", () => {
    const rows = questions.filter((q) =>
      ["reading", "discourse"].includes(q.subtopicId),
    );
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((q) => q.reference.referenceId)).size).toBe(20);
    for (const q of rows) {
      const r = refs.find((r) => r.referenceId === q.reference.referenceId);
      expect(r.version).toBe(q.reference.referenceVersion);
      expect(r.language).toBe(q.language);
      expect(
        questions.filter(
          (other) => other.reference?.referenceId === r.referenceId,
        ),
      ).toHaveLength(1);
    }
  });
  it("has no reused IDs, exact stems, or passages across Family 01 and 02", async () => {
    const priorRoot = "content/question-bank/family-01",
      prior = JSON.parse(await readFile(`${priorRoot}/manifest.json`, "utf8"));
    const old = (
      await Promise.all(
        prior.sources[0].questionFiles.map(async (f) =>
          JSON.parse(await readFile(`${priorRoot}/${f}`, "utf8")),
        ),
      )
    ).flat();
    const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const ids = new Set(old.map((q) => q.questionId)),
      stems = new Set(old.map((q) => norm(q.stem)));
    for (const q of questions) {
      expect(ids.has(q.questionId)).toBe(false);
      expect(stems.has(norm(q.stem))).toBe(false);
    }
    const oldRefs = (
      await Promise.all(
        prior.sources[0].referenceFiles.map(async (f) =>
          JSON.parse(await readFile(`${priorRoot}/${f}`, "utf8")),
        ),
      )
    ).flat();
    const oldTexts = new Set(
      oldRefs.flatMap((r) =>
        r.blocks.filter((b) => b.type === "text").map((b) => norm(b.text)),
      ),
    );
    for (const r of refs)
      for (const b of r.blocks.filter((b) => b.type === "text"))
        expect(oldTexts.has(norm(b.text))).toBe(false);
  });
  it("checks every numerical key against independently worked results", () => {
    const values = [
      "12",
      "24",
      "75",
      "8",
      "63",
      "24",
      "3/10",
      "PHP 38",
      "12 degrees",
      "0.62",
      "52 cm",
      "7",
      "750",
      "PHP 115",
      "PHP 20",
      "7 kg",
      "2 hours",
      "36 km/h",
      "4 cm",
      "6",
      "5/7",
      "PHP 6000",
      "20 km",
      "9 litres",
      "42",
      "30%",
      "10 days",
      "3:12 p.m.",
      "7/10",
      "20",
      "PHP 460.80",
      "47",
      "7.5 litres",
      "1/2",
      "PHP 1000",
      "83",
      "85",
      "86",
      "282 m²",
      "60 km",
    ];
    expect(values).toHaveLength(40);
    values.forEach((v, i) => expect(answer("numerical", i + 1)).toBe(v));
    expect(1 / (1 / 6 + 1 / 3)).toBe(2);
    expect(180 / (90 / 45 + 90 / 30)).toBe(36);
    expect(1 / (2 / 15 - 1 / 12)).toBeCloseTo(20);
    expect(480 * 0.8 * 1.2).toBeCloseTo(460.8);
    expect(216 + 2 * 35 - 4).toBe(282);
    expect(2.5 / (1 / 40 + 1 / 60)).toBeCloseTo(60, 10);
  });
  it("recomputes the reviewed aggregate, capacity, and packing traps", () => {
    const overflow = [180, 240, 150, 210].reduce(
      (s, n) => s + Math.max(0, n * 0.6 - 100),
      0,
    );
    expect(answer("data", 24)).toBe(`${overflow} litres`);
    expect(answer("data", 22)).toBe(`${780 / (10 + 15 + 12 + 13)} mm`);
    const kits = Math.min(Math.floor(50 / 2), Math.floor(30 / 3));
    const boxes = 3 * Math.ceil((50 - 2 * kits) / 3 / 4);
    expect(answer("data", 32)).toBe(String(boxes));
    expect(boxes).not.toBe(Math.ceil((50 - 2 * kits) / 4));
    const late = [80, 120, 50, 150]
      .map((n, i) => Math.max(0, Math.ceil(n * 0.85) - [60, 102, 45, 120][i]))
      .reduce((a, b) => a + b, 0);
    expect(answer("data", 4)).toBe(String(late));
    const packCosts = [0, 1, 2].map(
      (mixed) =>
        mixed * 35 +
        40 * (Math.ceil((17 - 5 * mixed) / 8) + Math.ceil((9 - 3 * mixed) / 8)),
    );
    expect(packCosts).toEqual([200, 155, 150]);
    expect(answer("data", 16)).toBe(`PHP ${Math.min(...packCosts)}`);
    expect(parseFloat(answer("data", 8))).toBeCloseTo(
      (42 - 30 + (36 - 32)) * 0.8 - 5,
      10,
    );
  });
  it("exhaustively checks hard logic schedules, boxes, truth types and selections", () => {
    const schedules = permutations(["J", "K", "L", "M", "N", "P"]).filter(
      (p) => {
        const at = (x) => p.indexOf(x);
        return (
          at("J") < at("K") &&
          at("L") === at("J") + 1 &&
          at("P") === at("M") - 1 &&
          at("M") < at("N") &&
          at("K") === 2 &&
          at("N") === 5
        );
      },
    );
    expect(schedules).toEqual([["J", "L", "K", "P", "M", "N"]]);
    expect(answer("logic", 34)).toBe(schedules[0][4]);
    const boxCounts = [0, 1, 2, 3, 4].filter((n) => 2 * n + 3 * (4 - n) === 10);
    expect(boxCounts).toEqual([2]);
    expect(answer("logic", 35)).toBe(`PHP ${2 * 2 * 9 + 2 * 3 * 5}`);
    const types = [];
    for (const ivo of [false, true])
      for (const jori of [false, true])
        if (ivo === (!ivo && !jori)) types.push([ivo, jori]);
    expect(types).toEqual([[false, true]]);
    const valid = [];
    for (let bits = 0; bits < 32; bits++) {
      const [A, B, C, D, E] = [0, 1, 2, 3, 4].map((i) =>
        Boolean(bits & (1 << i)),
      );
      if (
        [A, B, C, D, E].filter(Boolean).length === 3 &&
        (!A || B) &&
        (!C || !B) &&
        (!D || E) &&
        C
      )
        valid.push([A, B, C, D, E]);
    }
    expect(valid).toEqual([[false, false, true, true, true]]);
  });
  it("checks all alphabetizing keys and complete permutations using stated conventions", () => {
    for (let n = 1; n <= 10; n++) {
      const q = get("alphabetizing", n),
        lines = q.stem.split("\n"),
        rule = lines[0];
      const entries = lines
        .filter((l) => /^R\d+\./.test(l))
        .map((l) => l.replace(/^R\d+\. /, ""));
      const clean = (s) => {
        let v = s.toLowerCase();
        if (rule.includes("initial")) v = v.replace(/^(the|an|a) /, "");
        if (rule.includes("Dept.")) v = v.replaceAll("dept.", "department");
        if (rule.includes("titles") || rule.includes("Mr."))
          v = v.replace(/^(dr|mr|ms)\. /, "");
        return v.split(",").map((x) => x.replace(/[^a-z]/g, ""));
      };
      const compare = (a, b) => {
        const x = clean(a),
          y = clean(b);
        for (let i = 0; i < Math.max(x.length, y.length); i++) {
          if ((x[i] || "") !== (y[i] || ""))
            return (x[i] || "") < (y[i] || "") ? -1 : 1;
        }
        return 0;
      };
      const labels = entries.map((_, i) => `R${i + 1}`);
      const expected = entries
        .map((s, i) => ({ s, l: labels[i] }))
        .sort((a, b) => compare(a.s, b.s))
        .map((x) => x.l)
        .join("-");
      expect(answer("alphabetizing", n)).toBe(expected);
      for (const c of q.choices)
        expect(c.text.split("-").sort()).toEqual([...labels].sort());
      expect(
        q.choices.every((c) => c.text.split("-")[0] === expected.split("-")[0]),
      ).toBe(true);
    }
  });
  it("checks sufficiency domains, compatibility and definite-no conclusions", () => {
    expect(get("sufficiency", 8).correctChoiceId).toBe("together");
    const even = [2, 4],
      above = [3, 4];
    expect(even.map((n) => n === 2)).toEqual([true, false]);
    expect(above.map((n) => n === 3)).toEqual([true, false]);
    const roots1 = [2, 3],
      roots2 = [3, 4];
    expect(roots1.filter((x) => roots2.includes(x))).toEqual([3]);
    expect(get("sufficiency", 18).correctChoiceId).toBe("together");
    expect(get("sufficiency", 17).correctChoiceId).toBe("two");
    for (const x of [1, 2, 5, 10])
      for (const y of [1, 2, 5, 10])
        if (Math.abs(x / y + y / x - 2) < 1e-10) expect(x).toBe(y);
    expect(get("sufficiency", 20).correctChoiceId).toBe("together");
    for (const reds of [1, 2]) {
      const blues = 3 - reds;
      expect((reds * (reds - 1) + blues * (blues - 1)) / 6).toBeCloseTo(1 / 3);
    }
    expect(72 / 6).toBe(12);
    expect(get("sufficiency", 14).correctChoiceId).toBe("together");
  });
});

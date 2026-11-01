import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = "content/question-bank/family-01";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const questions = (
  await Promise.all(
    manifest.sources[0].questionFiles.map(async (file) =>
      JSON.parse(await readFile(`${root}/${file}`, "utf8")),
    ),
  )
).flat();
const references = (
  await Promise.all(
    manifest.sources[0].referenceFiles.map(async (file) =>
      JSON.parse(await readFile(`${root}/${file}`, "utf8")),
    ),
  )
).flat();
const question = (suffix) =>
  questions.find((q) => q.questionId === `f01-${suffix}`);
const selected = (suffix) => {
  const q = question(suffix);
  return q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
};
function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, i) => i !== index)).map((rest) => [
      value,
      ...rest,
    ]),
  );
}
function worlds(names) {
  return Array.from({ length: 2 ** names.length }, (_, n) =>
    Object.fromEntries(names.map((name, i) => [name, Boolean(n & (1 << i))])),
  );
}

describe("Family 01 substantive difficulty revision", () => {
  it("meets 30/50/20 in every subject without changing subject or language totals", () => {
    const totals = {
      general_information: 40,
      verbal_ability: 50,
      numerical_ability: 60,
      analytical_ability: 80,
      clerical_ability: 40,
    };
    expect(questions).toHaveLength(270);
    for (const [subject, total] of Object.entries(totals)) {
      const rows = questions.filter((q) => q.subjectId === subject);
      expect(rows).toHaveLength(total);
      expect(
        ["easy", "medium", "hard"].map(
          (difficulty) =>
            rows.filter((q) => q.difficulty === difficulty).length,
        ),
      ).toEqual([0.3 * total, 0.5 * total, 0.2 * total]);
    }
    for (const language of ["english", "filipino"]) {
      const verbal = questions.filter(
        (q) => q.subjectId === "verbal_ability" && q.language === language,
      );
      expect(verbal).toHaveLength(25);
      expect(verbal.filter((q) => q.difficulty === "hard")).toHaveLength(5);
    }
  });

  it("retains one dedicated, exactly version-linked passage per reading and paragraph item", () => {
    const rows = questions.filter((q) =>
      [
        "reading_comprehension_test",
        "paragraph_organization_test_questions",
      ].includes(q.conceptId),
    );
    expect(rows).toHaveLength(24);
    const links = rows.map(
      (q) => `${q.reference.referenceId}:${q.reference.referenceVersion}`,
    );
    expect(new Set(links).size).toBe(rows.length);
    for (const q of rows) {
      const ref = references.find(
        (r) =>
          r.referenceId === q.reference.referenceId &&
          r.version === q.reference.referenceVersion,
      );
      expect(ref?.language).toBe(q.language);
      expect(
        questions.filter(
          (other) => other.reference?.referenceId === ref.referenceId,
        ),
      ).toHaveLength(1);
    }
  });

  it("computes the revised code in the specified operation order", () => {
    const shift = (letter, step) =>
      String.fromCharCode(65 + ((letter.charCodeAt(0) - 65 + step + 26) % 26));
    const result = [..."ZONE"]
      .reverse()
      .map((letter, i) => shift(letter, i % 2 ? -1 : 1))
      .join("");
    expect(selected("analogy-logic-01")).toBe(result);
    // Reversing after shifting is the wrong order and must not produce the key.
    expect(
      [..."ZONE"]
        .map((letter, i) => shift(letter, i % 2 ? -1 : 1))
        .reverse()
        .join(""),
    ).not.toBe(result);
  });

  it("exhaustively checks the six-file schedule and the five-seat possibilities", () => {
    const schedules = permutations(["A", "B", "C", "D", "E", "F"]).filter(
      (p) => {
        const at = (name) => p.indexOf(name);
        return (
          at("A") < at("C") &&
          at("E") === at("C") + 1 &&
          at("B") < at("D") &&
          at("F") === at("B") + 1 &&
          at("E") === 4
        );
      },
    );
    expect(schedules).toHaveLength(2);
    expect([...new Set(schedules.map((p) => p[5]))]).toEqual([
      selected("analogy-logic-05"),
    ]);
    const seating = permutations(["A", "B", "C", "D", "E"]).filter((p) => {
      const at = (name) => p.indexOf(name);
      return (
        at("B") === at("A") + 1 &&
        at("C") !== 0 &&
        at("D") < at("C") &&
        at("E") > at("B") &&
        Math.abs(at("D") - at("E")) === 1
      );
    });
    expect(seating).toEqual([
      ["A", "B", "D", "E", "C"],
      ["A", "B", "E", "D", "C"],
    ]);
    expect([...new Set(seating.map((p) => p[2]))].sort()).toEqual(["D", "E"]);
    expect(selected("analogy-logic-07")).toBe("D or E only");
  });

  it("checks necessary parcel conclusions and exposes each distractor's omitted condition", () => {
    const valid = worlds([
      "signed",
      "tested",
      "exempt",
      "suspended",
      "released",
    ]).filter(
      (w) =>
        w.released === (w.signed && (w.tested || w.exempt)) &&
        !(w.suspended && w.released) &&
        w.released &&
        !w.tested,
    );
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({
      signed: true,
      exempt: true,
      suspended: false,
    });
    expect(selected("analogy-logic-06")).toBe(
      "K has a signed form, has an exemption, and is not suspended.",
    );
    expect(valid.some((w) => !w.signed || !w.exempt || w.suspended)).toBe(
      false,
    );
  });

  it("tracks an existential record witness without reversing universal implications", () => {
    const allowed = worlds([
      "logged",
      "encrypted",
      "public",
      "remote",
      "signed",
    ]).filter(
      (w) =>
        (!w.logged || w.encrypted) &&
        !(w.encrypted && w.public) &&
        (!w.remote || w.signed),
    );
    const witnesses = allowed.filter((w) => w.remote && w.public);
    expect(witnesses.length).toBeGreaterThan(0);
    expect(witnesses.every((w) => w.signed && !w.logged)).toBe(true);
    expect(selected("analogy-logic-09")).toBe(
      "Some signed records are not logged.",
    );
    // These admissible extra records defeat the universal distractors.
    expect(allowed.some((w) => w.signed && w.encrypted)).toBe(true);
    expect(allowed.some((w) => !w.logged && !w.public)).toBe(true);
    // A corpus consisting only of one witness has no logged records at all.
    expect(witnesses.every((w) => !w.logged)).toBe(true);
  });

  it("checks the implication chain with contraposition rather than its converse", () => {
    const valid = worlds(["P", "Q", "R", "S", "T"]).filter(
      (w) =>
        w.P !== w.Q && (!w.P || w.R) && (!w.R || w.S) && w.S === w.T && !w.T,
    );
    expect(valid).toEqual([
      { P: false, Q: true, R: false, S: false, T: false },
    ]);
    expect(selected("analogy-logic-11")).toBe(
      "Q is selected; R is not selected.",
    );
  });

  it("independently recomputes the revised chart keys and boundary traps", () => {
    const seedlings = [20, 30, 40, 35, 50, 60];
    const earlierSurvivors =
      seedlings.slice(0, 3).reduce((a, b) => a + b, 0) * 0.8;
    const laterSurvivors = seedlings.slice(3).reduce((a, b) => a + b, 0) * 0.6;
    expect(Number(selected("graphs-b01-03"))).toBe(
      2 * earlierSurvivors - laterSurvivors,
    );
    const packs = seedlings.reduce(
      (sum, n) => sum + Math.floor((n * 0.8) / 5),
      0,
    );
    expect(Number(selected("graphs-b01-04"))).toBe(packs);
    expect(packs).not.toBe(
      Math.floor((seedlings.reduce((a, b) => a + b, 0) * 0.8) / 5),
    );
    const reduction = seedlings.reduce(
      (sum, n) => sum + Math.max(0, n - 40) * (12 - 8),
      0,
    );
    expect(selected("graphs-b01-05")).toBe(`PHP ${reduction}`);
    const mornings = [40, 30, 50, 60];
    const afternoons = [20, 30, 30, 40];
    const fourTotal = [...mornings, ...afternoons].reduce((a, b) => a + b, 0);
    const friday = fourTotal / 4;
    const fridayMorning =
      (fourTotal + friday) * 0.6 - mornings.reduce((a, b) => a + b, 0);
    expect(Number(selected("graphs-b02-21"))).toBe(friday - fridayMorning);
    const water = [100, 120, 90, 150, 140];
    const percentage =
      ((water.reduce((a, b) => a + b, 0) * 0.1) / (water[3] + water[4])) * 100;
    expect(selected("graphs-b02-26")).toBe(`${percentage.toFixed(2)}%`);
    const deliveredD = 4 * 90 - 72 - 90 - 108;
    const planned = [80, 100, 120, 100];
    const delivered = [72, 90, 108, deliveredD];
    const newPacks = planned.reduce(
      (sum, n, i) => sum + Math.max(0, n * 0.95 - delivered[i] * 0.9),
      0,
    );
    expect(Number(selected("graphs-b02-36"))).toBeCloseTo(newPacks, 10);
    expect(newPacks).not.toBe(400 * 0.95 - 360);
  });
});

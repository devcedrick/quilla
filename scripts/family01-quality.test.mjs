import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = "content/question-bank/family-01";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const rows = (
  await Promise.all(
    manifest.sources[0].questionFiles.map(async (p) =>
      JSON.parse(await readFile(`${root}/${p}`, "utf8")),
    ),
  )
).flat();
const q = (id) => rows.find((r) => r.questionId === `f01-${id}`);
const answer = (id) => {
  const r = q(id);
  return r.choices.find((c) => c.choiceId === r.correctChoiceId).text;
};
const permutations = (xs) =>
  xs.length
    ? xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => i !== j)).map((p) => [x, ...p]),
      )
    : [[]];

describe("Family 01 editorial quality repairs", () => {
  it("requires both contextual attitudes rather than one vocabulary match", () => {
    const item = q("vocabulary-english-01");
    const targets = ["apathetic", "apprehensive"];
    const pairs = item.choices.map((c) => ({
      ...c,
      words: c.text.split("; "),
    }));
    expect(
      pairs
        .filter((c) => c.words.every((word, i) => word === targets[i]))
        .map((c) => c.choiceId),
    ).toEqual([item.correctChoiceId]);
    for (let i = 0; i < 2; i++)
      expect(
        pairs.filter((c) => c.words[i] === targets[i]).length,
      ).toBeGreaterThan(1);
  });

  it("keeps explanations independent of displayed choice positions", () => {
    for (const r of rows) {
      expect(r.explanation).not.toMatch(
        /(?:first|second|third|fourth|last) (?:choice|option|sentence)/i,
      );
    }
    expect(q("grammar-filipino-02").explanation).not.toMatch(
      /ikatlong pangungusap|binabaligtad ng ikalawa|isinasama ng ikaapat/i,
    );
  });

  it("uses a two-state recurrence and respects the operation cycle", () => {
    const terms = [2, 3];
    while (terms.length < 6) terms.push(2 * terms.at(-1) - terms.at(-2) + 1);
    expect(Number(answer("numerical-23"))).toBe(terms[5]);
    expect(terms[5]).toBe(17);
    expect(Number(answer("numerical-23"))).not.toBe(terms[4]);
    let value = 10;
    for (let i = 0; i < 5; i++) value = i % 3 === 2 ? value / 2 : value + 6;
    expect(Number(answer("numerical-24"))).toBe(value);
    expect(value).toBe(23);
    let alternating = 10;
    for (let i = 0; i < 5; i++)
      alternating = i % 2 ? alternating / 2 : alternating + 6;
    expect(alternating).toBe(13);
    expect(alternating).not.toBe(value);
  });

  it("replaces chart reskins with range, tied-change, and rate comparisons", () => {
    const seedlings = [20, 30, 40, 35, 50, 60];
    expect(Number(answer("graphs-b01-12"))).toBe(
      Math.max(...seedlings) - Math.min(...seedlings),
    );
    const distances = [24, 32, 48, 40, 56, 72];
    const changes = distances.slice(1).map((v, i) => v - distances[i]);
    expect(changes).toEqual([8, 16, -8, 16, 16]);
    const names = ["January", "February", "March", "April", "May", "June"];
    const qualifies = (text) =>
      text.split(" and ").every((interval) => {
        const [from, to] = interval
          .split("–")
          .map((name) => names.indexOf(name));
        return (
          to === from + 1 &&
          distances[to] - distances[from] === Math.max(...changes)
        );
      });
    expect(
      q("graphs-b01-14")
        .choices.filter((c) => qualifies(c.text))
        .map((c) => c.choiceId),
    ).toEqual([q("graphs-b01-14").correctChoiceId]);
    const rates = [48 / 4, 40 / 4, 56 / 7, 72 / 9];
    expect(answer("graphs-b01-18")).toBe(
      ["March", "April", "May", "June"][rates.indexOf(Math.max(...rates))],
    );
    expect(rates[3]).toBeLessThan(rates[0]); // Largest total is not largest rate.
  });

  it("enumerates every admissible initial line before applying the moves", () => {
    const valid = permutations(["A", "B", "C", "D", "E", "F"]).filter((p) => {
      const at = (x) => p.indexOf(x);
      return (
        at("D") === at("C") + 1 &&
        at("A") < at("E") &&
        at("E") < at("C") &&
        p[5] === "B" &&
        at("F") !== 0 &&
        at("F") !== 5
      );
    });
    expect(valid).toHaveLength(3);
    const thirds = valid.map(
      (p) => ["B", ...p.filter((x) => x !== "B" && x !== "C")][2],
    );
    expect([...new Set(thirds)].sort()).toEqual(["E", "F"]);
    expect(answer("analogy-logic-21")).toBe("E or F only");
    expect(new Set(thirds).size).toBeGreaterThan(1); // A single tracked example cannot prove the answer.
  });

  it("checks truth counts rather than assuming every report is true", () => {
    const valid = permutations([2, 4, 7]).filter((p) => {
      const reports = [p[0] === 2, p.indexOf(4) < p.indexOf(7), p[2] !== 2];
      return p[0] !== 7 && reports.filter((v) => !v).length === 1;
    });
    expect(valid).toEqual([
      [2, 7, 4],
      [4, 2, 7],
    ]);
    expect(answer("analogy-logic-22")).toBe("2 or 7 only");
    expect(valid).not.toContainEqual([2, 4, 7]); // All-true reports violate exactly one false.
  });

  it("proves both possible first departures and excludes the other trains", () => {
    const valid = permutations(["L", "M", "N", "P"]).filter(
      (p) =>
        p.indexOf("N") < p.indexOf("L") &&
        p.indexOf("L") < p.indexOf("M") &&
        p.indexOf("P") < p.indexOf("M"),
    );
    expect([...new Set(valid.map((p) => p[0]))].sort()).toEqual(["N", "P"]);
    expect(answer("analogy-logic-26")).toBe("N or P only");
  });

  it("solves the kit's integer feasibility and rejects every distractor", () => {
    const solutions = [];
    // Price units satisfy 3 notebooks = 2 pens and 5 pens = 2 folders.
    expect(3 * 4).toBe(2 * 6);
    expect(5 * 6).toBe(2 * 15);
    for (let n = 1; n < 8; n++)
      for (let p = 1; p < 8; p++)
        for (let f = 1; f < 8; f++) {
          if (n + p + f === 8 && 4 * n + 6 * p + 15 * f === 60)
            solutions.push([n, p, f]);
        }
    expect(solutions).toEqual([[3, 3, 2]]);
    const eligible = q("analogy-logic-40").choices.filter((c) => {
      const [n, p, f] = c.text.match(/\d+/g).map(Number);
      return n + p + f === 8 && 4 * n + 6 * p + 15 * f === 60;
    });
    expect(eligible.map((c) => c.choiceId)).toEqual([
      q("analogy-logic-40").correctChoiceId,
    ]);
  });

  it("requires both target spellings in the medium pair checks", () => {
    for (const [id, targets] of [
      ["04", ["necessary", "receipt"]],
      ["07", ["questionnaire", "anonymous"]],
      ["08", ["correspondence", "enclosure"]],
    ]) {
      const item = q(`spelling-${id}`);
      const pairs = item.choices.map((c) => ({
        ...c,
        words: c.text.split("; "),
      }));
      expect(
        pairs
          .filter((c) => c.words.every((w, i) => w === targets[i]))
          .map((c) => c.choiceId),
      ).toEqual([item.correctChoiceId]);
      for (let i = 0; i < 2; i++)
        expect(
          pairs.filter((c) => c.words[i] === targets[i]).length,
        ).toBeGreaterThan(1);
    }
    expect(answer("spelling-05")).toBe(
      "Change priviledge to privilege and leave eligible unchanged.",
    );
  });

  it("retains two correct boundary distinctions in the hard Constitution item", () => {
    expect(4 > 4).toBe(false);
    expect(4 + 1 / 365 > 4).toBe(true);
    expect(16 >= (2 / 3) * 24).toBe(true);
    expect(70 <= 60).toBe(false);
    expect(answer("philippine-constitution-36")).toMatch(
      /^Only Nico.*satisfies its vote requirement but exceeds its duration limit/,
    );
  });
});

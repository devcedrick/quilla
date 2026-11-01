import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = "content/question-bank/family-02";
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, "utf8"));
const questions = (
  await Promise.all(
    manifest.sources[0].questionFiles.map(async (file) =>
      JSON.parse(await readFile(`${root}/${file}`, "utf8")),
    ),
  )
).flat();
const references = JSON.parse(
  await readFile(`${root}/references/f02-supporting-material.json`, "utf8"),
);
const get = (topic, number, language = "english") =>
  questions.find(
    (q) =>
      q.questionId ===
      `f02-${topic}-${language}-${String(number).padStart(2, "0")}`,
  );
const answer = (q) =>
  q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const reference = (q) =>
  references.find((r) => r.referenceId === q.reference.referenceId);

describe("Family 02 editorial correction regressions", () => {
  it("retains explicit legal exceptions and fee applicability", () => {
    const packaging = get("general", 14);
    expect(packaging.provenance.sources.join(" ")).toContain("3(bb)");
    expect(packaging.provenance.sources.join(" ")).toContain("3(ee)");
    expect(answer(packaging)).toContain("also deems the activity recycling");
    expect(get("general", 40).stem).toContain("Both collect prescribed fees");
    expect(answer(get("general", 40))).toBe(
      "A is simple and B highly technical; both entries must disclose the applicable fee amounts.",
    );
    // Classification fixtures exercise both conditions, not the legality of acceptance.
    const gifts = [
      { id: "A", unsolicited: true, insignificant: true, favour: false },
      { id: "B", unsolicited: true, insignificant: true, favour: true },
      { id: "C", unsolicited: true, insignificant: false, favour: false },
    ];
    expect(
      gifts
        .filter((g) => g.unsolicited && g.insignificant && !g.favour)
        .map((g) => g.id),
    ).toEqual(["A"]);
    expect(answer(get("general", 10))).toBe("A only");
    const recovered = 20 + 30 + Math.min(30, 20);
    expect(answer(get("general", 20))).toBe(
      `Recover ${recovered} tonnes and provide disposal for ${100 - recovered} tonnes.`,
    );
  });

  it("recomputes revised medium numeracy and the hard tier boundary", () => {
    expect(answer(get("numerical", 15))).toBe(`PHP ${1250 * 0.88 + 40 - 1120}`);
    const remaining = ["G", "G", "G", "G", "G", "Y", "Y"];
    expect(remaining.filter((c) => c === "G").length).toBe(5);
    expect(answer(get("numerical", 21))).toBe("5/7");
    expect(answer(get("numerical", 23))).toBe(`${(7.2 - 1.2 + 2) * 2.5} km`);
    const profit = (units) =>
      Math.min(units, 50) * 40 +
      Math.max(0, units - 50) * 60 -
      900 -
      25 * units;
    const first = Array.from({ length: 150 }, (_, i) => i + 1).find(
      (units) => profit(units) >= 1000,
    );
    expect(first).toBe(83);
    expect(profit(first - 1)).toBe(970);
    expect(profit(first)).toBe(1005);
    expect(answer(get("numerical", 36))).toBe(String(first));
  });

  it("filters stock before aggregating and exhaustively minimizes legal pack purchases", () => {
    const rows = reference(get("data", 15)).blocks.find(
      (b) => b.type === "table",
    ).rows;
    const flagged = rows.filter((row) => Number(row[3]) - Number(row[2]) >= 30);
    expect(flagged.map((row) => row[0])).toEqual(["Bolts", "Nuts"]);
    const total = flagged.reduce(
      (sum, row) => sum + Number(row[1]) + Number(row[2]) - Number(row[3]),
      0,
    );
    expect(answer(get("data", 15))).toBe(`${total} units`);
    const feasible = [];
    for (let mixed = 0; mixed <= 2; mixed++)
      for (let bolts = 0; bolts <= 5; bolts++)
        for (let washers = 0; washers <= 5; washers++)
          if (
            60 + 5 * mixed + 8 * bolts >= 77 &&
            85 + 3 * mixed + 8 * washers >= 94
          )
            feasible.push({
              mixed,
              bolts,
              washers,
              cost: 35 * mixed + 40 * (bolts + washers),
            });
    const best = Math.min(...feasible.map((p) => p.cost));
    expect(feasible.filter((p) => p.cost === best)).toEqual([
      { mixed: 2, bolts: 1, washers: 1, cost: 150 },
    ]);
    expect(answer(get("data", 16))).toBe(`PHP ${best}`);
    expect(get("data", 16).explanation).not.toContain(
      "pooling deficits would undercount",
    );
  });

  it("replaces the three binary-elimination reskins with distinct reasoning", () => {
    const coded = [..."ZAP"]
      .map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 + 1) % 26) + 65))
      .join("");
    expect(answer(get("logic", 8))).toBe(coded);
    expect(get("logic", 12).stem).toContain("logical converse");
    expect(answer(get("logic", 12))).toBe("All labelled parcels are sealed.");
    const cards = [
      { id: "A", current: true, r: true, s: false },
      { id: "B", current: false, r: true, s: true },
      { id: "C", current: true, r: false, s: false },
      { id: "D", current: true, r: false, s: true },
    ];
    expect(
      cards.filter((c) => c.current && (c.r || c.s)).map((c) => c.id),
    ).toEqual(["A", "D"]);
    expect(answer(get("logic", 25))).toBe("A and D only");
    for (const n of [8, 12, 25])
      expect(get("logic", n).stem).not.toMatch(
        /not off|cannot occur on Monday|key does not open/,
      );
  });

  it("checks office decision premises, parallel work, and activity versus cash transfer", () => {
    expect(get("operations", 14).stem).toContain("no decision was reached");
    expect(get("operations", 14).stem).toContain("only after a recorded vote");
    const printerFinish = 10 + 2 * 15 + 10 + 15;
    const coverFinish = 10 + 25;
    const ready = Math.max(printerFinish, coverFinish) + 5;
    expect(ready).toBe(70);
    expect(answer(get("operations", 18))).toBe("10:10");
    expect(printerFinish + 25 + 5).not.toBe(ready);
    const activity = 9000 - 400;
    const deposit = activity - 500;
    expect(answer(get("operations", 20))).toBe(
      `PHP ${activity} net activity; PHP ${deposit} bank deposit`,
    );
  });

  it("pins corrected verbal premises and independently owned reference revisions", () => {
    const grammar = get("grammar", 8, "filipino");
    expect(grammar.stem).toContain(
      "Isinumite ang liham noong Lunes at sinuri noong Martes",
    );
    expect(answer(grammar)).toBe(
      "Isinumite ang liham noong Lunes at sinuri ito noong Martes.",
    );
    const english = get("paragraph", 4);
    expect(reference(english).blocks[0].text).toContain(
      "P2. The committee originally paired",
    );
    const filipino = get("paragraph", 5, "filipino");
    expect(reference(filipino).blocks[0].text).not.toContain("botante");
    const reading = get("reading", 5, "filipino");
    expect(reference(reading).blocks[0].text).toContain(
      "walang naitalang oras para sa may appointment",
    );
    expect(answer(reading)).toContain(
      "kailangan pa ng datos sa dalawang pangkat",
    );
    for (const q of [english, filipino, reading]) {
      expect(q.version).toBe(2);
      expect(q.reference.referenceVersion).toBe(2);
      expect(reference(q).version).toBe(2);
    }
    // Text assertions prevent regressions; bilingual/editorial approval remains separate.
  });
});

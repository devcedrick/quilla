import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = "content/question-bank/family-03/";
const read = (path) => JSON.parse(readFileSync(root + path, "utf8"));
const general = read("content/f03-general.json");
const names = [
  "vocabulary-english",
  "vocabulary-filipino",
  "grammar-english",
  "grammar-filipino",
  "reading-english",
  "reading-filipino",
  "paragraph-english",
  "paragraph-filipino",
];
const verbal = names.flatMap((n) => read(`content/f03-${n}.json`));
const references = read("references/f03-verbal.json");
const get = (id) =>
  [...general, ...verbal].find((q) => q.questionId === `f03-${id}`);
const answer = (q) =>
  q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const passage = (q) =>
  references.find((r) => r.referenceId === q.reference.referenceId);
const text = (r) => r.blocks.map((b) => b.text ?? "").join("\n");
const uniqueLongest = (q) => {
  const keyLength = answer(q).length;
  return q.choices.every(
    (c) => c.choiceId === q.correctChoiceId || c.text.length < keyLength,
  );
};
describe("Family 03 substantive General and Verbal quality repairs", () => {
  it("preserves the subject-level ratio through task revision, not relabeling", () => {
    for (const [items, counts] of [
      [general, [12, 20, 8]],
      [verbal, [15, 25, 10]],
    ]) {
      expect(
        ["easy", "medium", "hard"].map(
          (d) => items.filter((q) => q.difficulty === d).length,
        ),
      ).toEqual(counts);
    }
    expect(verbal.filter((q) => q.language === "english")).toHaveLength(25);
    expect(verbal.filter((q) => q.language === "filipino")).toHaveLength(25);
  });
  it("replaces the prior-family each/of agreement reskin with singular news", () => {
    const q = get("grammar-english-01");
    expect(q.version).toBe(2);
    expect(
      q.choices.every((c) => c.text.startsWith("The news from the islands")),
    ).toBe(true);
    expect(
      q.choices.filter((c) => /is encouraging\.$/.test(c.text)),
    ).toHaveLength(1);
    expect(answer(q)).toBe("The news from the islands is encouraging.");
    expect(q.provenance.sources.some((s) => s.includes("Purdue"))).toBe(true);
  });
  it("requires repair of comparison scope rather than copying a complete stem sentence", () => {
    const q = get("grammar-filipino-07");
    expect(q.version).toBe(2);
    expect(q.stem.includes(answer(q))).toBe(false);
    expect(answer(q)).toBe(
      "Higit ang haba ng tulay sa Malaya kaysa sa tulay sa Ligaya.",
    );
    // The key preserves direction and compares bridge length with bridge length.
    expect(answer(q)).toMatch(/haba ng tulay sa Malaya.*tulay sa Ligaya/);
    expect(
      q.choices.filter((c) =>
        /haba ng tulay sa Malaya.*tulay sa Ligaya/.test(c.text),
      ),
    ).toHaveLength(1);
  });
  it("uses a natural spring-as-source construction and nonliteral rival senses", () => {
    const bukal = get("vocabulary-filipino-03");
    expect(bukal.stem).toMatch(/Sa bukal.*kumuha ng tubig/);
    expect(bukal.stem).not.toContain("Bukal ang tubig");
    expect(answer(bukal)).toContain("Pinanggagalingan ng tubig; kusang-loob");
    const timbang = get("vocabulary-filipino-06");
    expect(
      timbang.choices.every((c) => !/kilo|klinika|tindero/.test(c.text)),
    ).toBe(true);
    expect(answer(timbang)).toBe(
      "Sinuri niya ang bigat o saysay ng mga dahilan.",
    );
    expect(
      get("vocabulary-filipino-05").choices.every((c) => /Pag/.test(c.text)),
    ).toBe(true);
  });
  it("makes warranty coverage an inference from independent tests and the report boundary", () => {
    const q = get("reading-english-04"),
      r = passage(q),
      s = text(r);
    expect([q.version, r.version, q.reference.referenceVersion]).toEqual([
      2, 2, 2,
    ]);
    expect(q.difficulty).toBe("hard");
    expect(s).toContain("No decision on either request has yet been made.");
    expect(s).toContain("the malfunction is reported within 30 days");
    expect(s).not.toContain("the fault is reported within 30 days");
    expect(s).toContain(
      "an installation fault causes the reported malfunction",
    );
    expect(q.explanation).toContain("not merely any installation defect");
    expect(s).not.toMatch(/accepted the first request|declined the second/);
    expect(s).toContain(
      "straight borrowed handle but the original runner, it still jammed",
    );
    expect(s).toContain(
      "correctly fitted runner but the bent handle, it moved freely",
    );
    const reportDay = 28,
      inspectionDay = 34,
      deadline = 30;
    expect(reportDay <= deadline).toBe(true);
    expect(inspectionDay <= deadline).toBe(false);
    expect(answer(q)).toBe(
      "Only the runner adjustment is covered; day 28 meets the reporting deadline.",
    );
  });
  it("makes judging fairness require an evidence-bound conclusion, not a stated recommendation", () => {
    const q = get("reading-filipino-05"),
      r = passage(q),
      s = text(r);
    expect([q.version, r.version, q.reference.referenceVersion]).toEqual([
      2, 2, 2,
    ]);
    expect(q.difficulty).toBe("hard");
    expect(s).not.toContain("Iminungkahi ng pangkat");
    expect(s).toContain("Wala ring paghahambing");
    expect(s).toContain("Hindi pa nila namarkahan nang magkahiwalay");
    expect(answer(q)).toContain("Hindi sapat ang pagtatago ng pangalan");
    expect(q.explanation).toContain(
      "walang paghahambing na may pangalan laban sa walang pangalan",
    );
  });
  it("requires three literary inferences rather than an explicit interpretive gloss", () => {
    const q = get("reading-filipino-06"),
      r = passage(q),
      s = text(r);
    expect([q.version, r.version, q.reference.referenceVersion]).toEqual([
      2, 2, 2,
    ]);
    expect(s).not.toContain("magtanong bago magpangalan");
    expect(s).not.toContain("upang matutong");
    expect(s).toContain("namamaga ang kanyang mga daliri");
    expect(s).toContain("mariin pa rin niyang tinutulan");
    expect(s).toContain("iniwang walang kapalit ang patlang");
    expect(s).toContain("hinihintay ko siyang magsalita");
    expect(answer(q)).toContain("kahandaang makinig bago humatol");
    expect(
      q.choices.every(
        (c) =>
          c.text.includes("pagtanggi") &&
          c.text.includes("tasa") &&
          c.text.includes("kamay"),
      ),
    ).toBe(true);
  });
  it("preserves a dedicated version-pinned reference for each reading and paragraph item", () => {
    const linked = verbal.filter((q) => q.reference);
    expect(linked).toHaveLength(24);
    expect(new Set(linked.map((q) => q.reference.referenceId)).size).toBe(24);
    for (const q of linked)
      expect(passage(q).version).toBe(q.reference.referenceVersion);
    expect(
      references
        .filter((r) => r.version === 2)
        .map((r) => r.referenceId)
        .sort(),
    ).toEqual([
      "f03-reading-english-04-passage",
      "f03-reading-filipino-05-passage",
      "f03-reading-filipino-06-passage",
    ]);
  });
  it("states all gender-mainstreaming stages explicitly and keeps the legal boundaries distinct", () => {
    const q = get("general-36");
    expect(q.version).toBe(2);
    expect(q.stem).toMatch(
      /Office R.*design, implementation, monitoring and evaluation/,
    );
    expect(q.stem).toMatch(/Office Q.*not design, monitoring or evaluation/);
    expect(answer(q)).toContain("P and Q each show partial integration");
    expect(answer(get("general-26"))).toBe(
      "A written waiver with counsel present.",
    );
    expect(get("general-14").explanation).toMatch(
      /Section 3\(m\).*Sections 3\(ii\) and 3\(b\)/,
    );
    expect(get("general-14").explanation).not.toContain("Section 3(g)");
    expect(answer(get("general-40"))).toContain(
      "former-agency matter remains barred for one year",
    );
  });
  it("removes the systematic uniquely-longest cue without making shortest choice a new rule", () => {
    const count = (items) => items.filter(uniqueLongest).length;
    expect(count(general)).toBeLessThanOrEqual(18);
    expect(
      count(verbal.filter((q) => q.questionId.includes("reading-english"))),
    ).toBeLessThanOrEqual(2);
    expect(
      count(verbal.filter((q) => q.questionId.includes("vocabulary-filipino"))),
    ).toBeLessThanOrEqual(2);
    const uniquelyShortest = general.filter((q) =>
      q.choices.every(
        (c) =>
          c.choiceId === q.correctChoiceId || c.text.length > answer(q).length,
      ),
    );
    expect(uniquelyShortest.length).toBeLessThan(15);
  });
});

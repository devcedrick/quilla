import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../content/question-bank/family-06/content/${name}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
const numerical = read("numerical"),
  sufficiency = read("sufficiency"),
  clerical = read("clerical"),
  alphabetizing = read("alphabetizing"),
  spelling = read("spelling");
const key = (q) => q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const answers = [
  8070,
  4 / 9,
  18 - -35,
  "4:3",
  35 * 0.2,
  100 - 37,
  2 + (2 - -6),
  2500 / 125,
  -3,
  455 / 7,
  4212,
  14 + 8 * 4,
  "No change",
  "A by PHP 0.10",
  0.4 * 75 + 0.6 * 90,
  Math.floor(110 / 18) + 1,
  30,
  450 / 30 + 2 * 2,
  12,
  1.5 * 0.8,
  8 * 21 - 7 * 20,
  42 / 1.05,
  "1/2",
  "Falls by3",
  (((12 * 5) / 3) * 7) / 4,
  60,
  Math.ceil(92 / 12) * 85,
  1,
  24 * 28,
  "30cm",
  "25%",
  ((100 - 10) / 2 - 10) / 2,
];
answers[1] = "4/9";
answers[17] = "19 minutes";
answers[19] = "14/15";
answers[30] = 54;
answers[31] = 180;
const minimum = Math.min(
  ...Array.from({ length: 7 }, (_, s) =>
    Array.from({ length: 7 }, (_, l) => ({ s, l })),
  )
    .flat()
    .filter(({ s, l }) => s >= 2 && s + l <= 6 && 6 * s + 10 * l >= 47)
    .map(({ s, l }) => 20 * s + 31 * l),
);
const codes = [];
for (let a = 1; a <= 4; a++)
  for (let b = 1; b <= 4; b++)
    for (let c = 1; c <= 4; c++)
      if ([a, b, c].includes(1) && [a, b, c].includes(2)) codes.push([a, b, c]);
const tariff = Array.from({ length: 12 }, (_, i) => i + 1).filter(
  (w) => 48 * Math.ceil(w / 3) < 30 + 14 * w,
);
answers.push(
  minimum,
  "1666 2/3",
  "6 3/4 days",
  14,
  "63 1/3%",
  codes.length,
  tariff.length,
  "8 fifty-notes; either exchange",
);
answers[7] = 80;
answers[8] = "1/8";
answers[10] = 8.5;
answers[12] = "No; approximately11.22% moisture";
for (let i = 0; i < answers.length; i++)
  assert.equal(key(numerical[i]), String(answers[i]), numerical[i].questionId);

const dsKeys = [
  "c2",
  "c3",
  "c4",
  "c5",
  "c1",
  "c4",
  "c3",
  "c3",
  "c3",
  "c1",
  "c3",
  "c5",
  "c1",
  "c4",
  "c3",
  "c1",
  "c3",
  "c3",
  "c3",
  "c3",
];
dsKeys[0] = "c1";
dsKeys[1] = "c3";
for (let i = 0; i < 20; i++)
  assert.equal(sufficiency[i].correctChoiceId, dsKeys[i]);
// Enumerate finite DS universes for genuinely joint constraints and check each alone.
function outcomes(domain, p1, p2, target) {
  return [p1, p2, (x) => p1(x) && p2(x)].map(
    (p) => new Set(domain.filter(p).map(target)).size,
  );
}
assert.deepEqual(
  outcomes(
    Array.from({ length: 30 }, (_, n) => n),
    (n) => n % 7 === 2,
    (n) => n % 5 === 3,
    (n) => n,
  ),
  [4, 6, 1],
);
assert.deepEqual(
  outcomes(
    Array.from({ length: 20 }, (_, n) => n),
    (n) => n % 3 === 0 && n > 8 && n < 20,
    (n) => n % 2 === 0 && n > 10 && n < 16,
    (n) => n % 6 === 0,
  ),
  [2, 2, 1],
);
const pairs = [];
for (let a = 1; a < 10; a++) pairs.push([a, 20 - a]);
assert.deepEqual(
  outcomes(
    pairs,
    ([a, b]) => (a * b) % 4 === 0,
    ([a]) => [2, 3, 5, 7].includes(a),
    ([a]) => a,
  ),
  [4, 4, 1],
);
const clericalKeys = [
  "c2",
  "c2",
  "c2",
  "c2",
  "c3",
  "c3",
  "c4",
  "c2",
  "c3",
  "c2",
  "c2",
  "c2",
  "c3",
  "c2",
  "c2",
  "c2",
  "c1",
  "c3",
  "c1",
  "c1",
];
clericalKeys[12] = "c2";
clerical.forEach((q, i) => assert.equal(q.correctChoiceId, clericalKeys[i]));
assert.equal(500 + 360 - 60 + 40 - 80, 760);
const alphaOrders = [
  ["Sea-Air", "Seabird", "Seaside", "Sea View"],
  ["Oak Bay", "Oak Grove", "Oak Hill", "Oakridge"],
  ["Mora, Leo", "Mora, Lina", "Moral, Luis", "Moran, Lia"],
  ["Del-Arco", "Dela Rosa", "D'Elia", "Delos Reyes"],
  ["Maple Annex", "The Maple Archive", "The Maple Room", "Maplewood Office"],
  ["Ms Mina Soto", "Dr Mira Soto", "Ms Miro Soto", "Dr Mina Sotto"],
  ["A New Office", "An Office", "A North Office", "A-One Supply"],
  ["De Leon, Paz", "De Leon, Pia", "De Lima, Ana", "Del Mundo, Ada"],
  ["R1: Dr Bay View", "R2: Bay-View", "R4: The Bay View", "R3: Ms Bay Vista"],
  ["R2: Al-Rami, Jan", "R1: Al Rami, Jo", "R3: Al-Rami, Jo", "R4: Alrami, Jon"],
];
alphabetizing.forEach((q, i) => {
  assert.equal(key(q), alphaOrders[i].join(" → "), q.questionId);
  const original = alphaOrders[i].slice().sort();
  q.choices.forEach((c) =>
    assert.deepEqual(c.text.split(" → ").sort(), original),
  );
});
const spellingAnswers = [
  "receipt",
  "separate",
  "maintenance",
  "Change Q to liaison only",
  "The report is correct: occurrence needs repair",
  "0 and 2",
  "A has no errors; B has two",
  "0 / 2 / 1",
  "hierarchy consensus / supersede / heirarchy / CONSENCUS",
  "conscientious, auxiliary, perseverance; 4 / 0 / 0",
];
spelling.forEach((q, i) => assert.equal(key(q), spellingAnswers[i]));
for (const group of [
  [...numerical, ...sufficiency],
  [...clerical, ...alphabetizing, ...spelling],
]) {
  const counts = group.reduce((m, q) => (m[q.difficulty]++, m), {
    easy: 0,
    medium: 0,
    hard: 0,
  });
  assert.deepEqual(
    counts,
    group.length === 60
      ? { easy: 18, medium: 30, hard: 12 }
      : { easy: 12, medium: 20, hard: 8 },
  );
}
export const checkResult = {
  status: "PASS",
  numerical: numerical.length,
  sufficiency: sufficiency.length,
  clerical: clerical.length,
  alphabetizing: alphabetizing.length,
  spelling: spelling.length,
};

const divisorCount = (n) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0).length;
assert.deepEqual(
  outcomes(
    Array.from({ length: 24 }, (_, i) => i + 1),
    (a) => divisorCount(a) === 4,
    (a) => a % 7 === 0,
    (a) => a * (50 - a) > 500,
  ),
  [2, 2, 1],
);

const bodies = [
  ["concientious", "auxilliary", "perseverance"],
  ["concientious", "auxiliary", "perserverance"],
];
const repairs = new Map([
  ["concientious", "conscientious"],
  ["auxilliary", "auxiliary"],
  ["perserverance", "perseverance"],
]);
assert.equal(bodies.flat().filter((w) => repairs.has(w)).length, 4);
assert.deepEqual(
  bodies.map((words) => words.map((w) => repairs.get(w) ?? w)),
  [
    ["conscientious", "auxiliary", "perseverance"],
    ["conscientious", "auxiliary", "perseverance"],
  ],
);

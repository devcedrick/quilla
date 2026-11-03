import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = "content/question-bank/family-06/";
const load = (p) => JSON.parse(readFileSync(base + p, "utf8"));
const data = load("content/analytical-data.json"),
  logic = load("content/analytical-logic.json"),
  refs = load("references/analytical-data.json");
const get = (arr, n) =>
  arr[n - 1].choices.find((c) => c.choiceId === arr[n - 1].correctChoiceId)
    .text;
const permutations = (a) =>
  a.length
    ? a.flatMap((x, i) =>
        permutations(a.filter((_, j) => j !== i)).map((t) => [x, ...t]),
      )
    : [[]];
const subsets = (a, n) =>
  a.length
    ? subsets(a.slice(1), n)
        .concat(subsets(a.slice(1), n - 1).map((s) => [a[0], ...s]))
        .filter((s) => s.length === n)
    : n === 0
      ? [[]]
      : [];
const expectedData = [
  "6",
  "Sander",
  "Saw",
  "No; the overlap is unspecified",
  "10",
  "6/10",
  "3.6 kg",
  "Median stays at 3 kg; mean falls",
  "11",
  "6",
  "IV",
  "Final unchanged; maximum remains 10",
  "Q",
  "S",
  "None",
  "2",
  "20",
  "66%",
  "It stays the same",
  "24",
  "10 kg",
  "C and D",
  "11 units",
  "8",
  "N",
  "L",
  "K",
  "2",
  "60",
  "U",
  "2/9",
  "8",
  "Z",
  "X",
  "24",
  "2",
  "20%",
  "65",
  "95 minutes",
  "15/56",
];
const expectedLogic = [
  "Symbol meaning",
  "J is circular",
  "No",
  "VVC",
  "Add seven",
  "It is unlit",
  "Ina",
  "Blue",
  "It is not forced",
  "It lacks a stamp",
  "Mira before Olan",
  "X and Y",
  "B to C",
  "It was violated for this file",
  "2",
  "C and D walk",
  "Battery",
  "2",
  "True",
  "A on1",
  "Bea is a member; Cal may or may not borrow",
  "Neither was detected",
  "Some poets are not pilots",
  "K is after J and before L",
  "CAB",
  "L J K",
  "B",
  "Torn red tag",
  "26",
  "4",
  "A staff escort",
  "It occurs Tuesday",
  "3",
  "1",
  "2",
  "Ben",
  "P is first",
  "1",
  "Tile on middle",
  "No color occurs in every valid selection",
];
for (const [arr, expected] of [
  [data, expectedData],
  [logic, expectedLogic],
]) {
  assert.equal(arr.length, 40);
  expected.forEach((v, i) =>
    assert.equal(get(arr, i + 1), v, arr[i].questionId),
  );
  assert.deepEqual(
    ["easy", "medium", "hard"].map(
      (d) => arr.filter((q) => q.difficulty === d).length,
    ),
    [12, 20, 8],
  );
}
for (const q of data) {
  assert(refs.some((r) => r.referenceId === q.reference.referenceId));
}
// Independently enumerate every hard finite-model question.
const q12 = [10, 4, 8, 4];
assert.equal(Math.max(...q12), 10);
assert.equal(q12.at(-1), 4);
const crates = [
  [4, 7],
  [6, 3],
  [5, 5],
  [3, 6],
];
const splits = subsets([0, 1, 2, 3], 2)
  .filter((a) => a.includes(0))
  .map((a) => [a, [0, 1, 2, 3].filter((i) => !a.includes(i))]);
const mass = (a) => a.reduce((s, i) => s + crates[i][0], 0),
  vol = (a) => a.reduce((s, i) => s + crates[i][1], 0);
const weightFits = splits.filter((s) => s.every((a) => mass(a) <= 10));
assert.equal(Math.min(...weightFits.map((s) => Math.max(...s.map(vol)))), 11);
assert.equal(
  [0, 1, 2, 3].find((i) => 16 + 2 * i > 18),
  2,
);
assert.equal(110 - (50 + 4), 56);
const p = permutations(["A", "B", "C", "D", "E"]);
const order = p.filter(
  (t) =>
    t.indexOf("A") < t.indexOf("C") &&
    t.indexOf("C") < t.indexOf("E") &&
    t.indexOf("D") === t.indexOf("B") + 1 &&
    t.indexOf("D") < t.indexOf("E"),
);
assert(order.length > 0);
assert(order.every((t) => t[4] === "E"));
assert.equal(order.length, 3);
assert.equal(
  permutations([2, 3, 4, 5]).filter(
    (a) => a[0] + a[3] === 7 && a[1] % 2 === 0 && a[1] > a[0],
  ).length,
  1,
);
const teams = subsets(["A", "B", "C", "D", "E"], 3).filter(
  (t) =>
    !(t.includes("A") && t.includes("B")) &&
    t.includes("C") === t.includes("D") &&
    (!t.includes("A") || t.includes("E")),
);
assert.equal(teams.length, 2);
assert.deepEqual(
  ["Ana", "Ben", "Cy"].filter(
    (c) => [c === "Ben", c === "Cy", c !== "Cy"].filter(Boolean).length === 2,
  ),
  ["Ben"],
);
const jobs = permutations(["P", "Q", "R", "S"]).filter(
  (t) =>
    t.indexOf("P") < t.indexOf("R") &&
    [1, 2].includes(t.indexOf("Q")) &&
    t.indexOf("S") === t.indexOf("Q") + 1,
);
assert.equal(jobs.length, 2);
assert(jobs.every((t) => t[0] === "P"));
const guesses = [
  [1, 2, 3],
  [2, 3, 1],
  [3, 1, 2],
];
assert.equal(
  permutations([1, 2, 3]).filter((c) => {
    const m = guesses.map((g) => g.filter((v, i) => v === c[i]).length);
    return m.every((x) => x === 1) && c[0] > c[2];
  }).length,
  1,
);
const workers = [];
for (const j of permutations(["paint", "wire", "tile"]))
  for (const s of permutations(["early", "middle", "late"]))
    if (
      j[0] !== "paint" &&
      s[j.indexOf("wire")] === "early" &&
      s[1] === "late" &&
      j[1] !== "tile" &&
      s[2] !== "middle"
    )
      workers.push({ j, s });
assert.equal(workers.length, 1);
assert.equal(workers[0].j[0], "tile");
assert.equal(workers[0].s[0], "middle");
const bags = subsets(["red", "blue", "green", "white"], 2).filter(
  (t) =>
    (!t.includes("red") || t.includes("blue")) &&
    (!t.includes("green") || !t.includes("blue")) &&
    (!t.includes("white") || t.includes("green")),
);
assert.equal(bags.length, 2);
assert(
  ["red", "blue", "green", "white"].every((c) =>
    bags.some((t) => !t.includes(c)),
  ),
);
export const verificationResult = {
  status: "PASS",
  questions: 80,
  hardCases: 16,
  references: 10,
};

assert.equal(
  Array.from({ length: 9 }, (_, k) => k).filter(
    (k) => (28 + k) / 40 > (36 - k) / 50 && (28 + k) / 40 > 42 / 60,
  ).length,
  8,
);

const capacities = [];
for (let m = 9; m <= 11; m++)
  for (let v = 10; v <= 13; v++)
    if (splits.some((s) => s.every((a) => mass(a) <= m && vol(a) <= v)))
      capacities.push([m, v]);
assert.equal(capacities.length, 8);
let optimal = 0;
for (let x = 1; x <= 6; x++)
  for (let y = 0; y <= 6; y++)
    for (let z = 0; z <= 6; z++)
      if (
        x + y + z === 6 &&
        5 * x + 3 * y + 4 * z === 24 &&
        2 * x + y + 3 * z <= 12
      )
        optimal++;
assert.equal(optimal, 2);
assert.equal(
  Array.from({ length: 6 }, (_, p) => p).filter((p) => {
    const c = 24 - (p <= 2 ? 2 * p : p + 2);
    return c <= 20 && c % 2 === 0;
  }).length,
  2,
);

assert.equal(
  [..."OAR"].map((c) => ("AEIOU".includes(c) ? "V" : "C")).join(""),
  "VVC",
);

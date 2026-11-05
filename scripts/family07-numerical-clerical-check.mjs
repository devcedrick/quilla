import fs from "node:fs";
import assert from "node:assert/strict";
const dir = "content/question-bank/family-07/content/";
const groups = Object.fromEntries(
  ["numerical", "sufficiency", "clerical", "alphabetizing", "spelling"].map(
    (g) => [g, JSON.parse(fs.readFileSync(dir + g + ".json", "utf8"))],
  ),
);
const all = Object.values(groups).flat();
const answer = (q) =>
  q.choices.find((c) => c.choiceId === q.correctChoiceId)?.text;
const compact = (s) => String(s).replaceAll(/\s/g, "");
const ints = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const fraction = (a, b) => `${a / gcd(a, b)}/${b / gcd(a, b)}`;
const permute = (a) =>
  a.length
    ? a.flatMap((v, i) =>
        permute(a.filter((_, j) => i !== j)).map((p) => [v, ...p]),
      )
    : [[]];
function numeric(i, expected) {
  assert.equal(
    compact(answer(groups.numerical[i - 1])),
    compact(expected),
    `numerical${i}`,
  );
}
assert.equal(all.length, 100);
for (const [subject, count, distribution] of [
  ["numerical_ability", 60, [18, 30, 12]],
  ["clerical_ability", 40, [12, 20, 8]],
]) {
  const rows = all.filter((q) => q.subjectId === subject);
  assert.equal(rows.length, count);
  assert.deepEqual(
    ["easy", "medium", "hard"].map(
      (d) => rows.filter((q) => q.difficulty === d).length,
    ),
    distribution,
  );
  for (const q of rows) {
    assert.equal(q.family, 7);
    assert.equal(q.language, "english");
    assert.equal(
      q.choices.filter((c) => c.choiceId === q.correctChoiceId).length,
      1,
    );
    assert.equal(new Set(q.choices.map((c) => c.text)).size, q.choices.length);
    assert.deepEqual(
      q.levelApplicability,
      subject === "numerical_ability"
        ? ["professional", "subprofessional"]
        : ["subprofessional"],
    );
  }
}
const divisorCounts = [9, 8, 10, 12].map(
  (n) => ints(1, n).filter((d) => n % d === 0).length,
);
numeric(1, [9, 8, 10, 12][divisorCounts.indexOf(3)]);
numeric(2, Number((1.2 - 2 * (1.7 - 1.2)).toFixed(1)));
numeric(3, "1 ÷ 2.5");
numeric(4, fraction(5, 25));
numeric(5, ints(10, 99).filter((n) => n % 25 === 0).length);
const round70 = ints(0, 100).filter(
  (x) => Math.floor(x / 10 + 0.5) * 10 === 70,
);
numeric(6, Math.max(...round70) - Math.min(...round70));
numeric(7, (9 / 3) * 2);
numeric(8, `${0.004 * 100}%`);
numeric(
  9,
  `${String(Math.floor(((23 * 60 + 48 + 25) % 1440) / 60)).padStart(2, "0")}:${String((23 * 60 + 48 + 25) % 60).padStart(2, "0")}`,
);
numeric(10, Math.round(19 / 6));
numeric(11, 17 - 17);
numeric(12, 2 * (11 + 7));
numeric(
  13,
  Math.min(
    ...permute([0, 2, 5, 7])
      .map((p) => Number(p.join("")))
      .filter((n) => n > 5000 && n % 4 === 0),
  ),
);
numeric(14, ints(1, 100).filter((n) => String(n).includes("7")).length);
numeric(15, "3.55 ≤ x < 3.65");
assert.equal(Math.floor(3.55 * 10 + 0.5) / 10, 3.6);
assert.equal(Math.floor(3.65 * 10 + 0.5) / 10, 3.7);
numeric(16, fraction(3 - 5 + 8, 8));
numeric(17, 1 + 2 + 8 + 9 + 10);
numeric(
  18,
  Math.max(
    ...ints(1, 17)
      .filter((a) => a !== 9)
      .map((a) => a * (18 - a)),
  ),
);
numeric(19, (600 - 50) * 0.9 - (600 * 0.9 - 50));
numeric(
  20,
  ints(1, 100).reduce((n, x) => n + String(x).length, 0),
);
numeric(21, "10:12");
assert.equal((24 * 36) / gcd(24, 36), 72);
let twoPaint = 0;
for (let x = 0; x < 4; x++)
  for (let y = 0; y < 4; y++)
    for (let z = 0; z < 4; z++)
      if ([x, y, z].filter((v) => v === 0 || v === 3).length === 2) twoPaint++;
numeric(22, twoPaint);
numeric(23, fraction(2, 2 + 3));
numeric(24, ints(48, 55).filter((n) => n % 3 === 0).length);
numeric(25, `${60 / 2 / 2}%`);
numeric(
  26,
  ints(1, 360).filter((d) => 360 % d === 0 && Number.isInteger(Math.sqrt(d)))
    .length,
);
numeric(27, (17 - 2 - 1) * 3);
numeric(28, (7 * 6) / 2);
numeric(29, 8 + (30 - 12) / ((12 / 8) * 0.8));
numeric(
  30,
  ints(1, 11).filter(
    (n) => n / 12 > 1 / 3 && n / 12 < 2 / 3 && gcd(n, 12) === 1,
  ).length,
);
numeric(31, (5 * 4) / 2 - (3 * 2) / 2);
numeric(32, fraction(4 * 6 - (4 - 2) * (6 - 2), 4 * 6));
const switchResults = permute(["A", "B", "C"]).flatMap((p) => {
  let v = 5;
  for (const s of p) {
    v = s === "A" ? v + 3 : s === "B" ? v * 2 : v - 4;
    if (v < 0) return [];
  }
  return [v];
});
numeric(33, new Set(switchResults).size);
const tray = ints(1, 4)
  .map((h) => ({ base: (14 - 3 * h) * (10 - 2 * h), h }))
  .filter((x) => x.base >= 30);
numeric(34, Math.max(...tray.map((x) => x.base * x.h)));
const products = [];
for (let a = 1; a < 20; a++)
  for (let b = a + 1; b < 20; b++)
    for (let c = b + 1; c < 20; c++)
      if (a + b + c === 20 && [a, b, c].filter((n) => n % 2).length === 2)
        products.push(a * b * c);
numeric(35, Math.max(...products));
const bagModels = [
  [3, 2, 1 / 2],
  [1, 4, 1 / 3],
  [2, 2, 1 / 6],
];
let both = 0,
  atLeast = 0;
for (const [r, b, w] of bagModels) {
  const total = ((r + b) * (r + b - 1)) / 2;
  both += (w * b * (b - 1)) / 2 / total;
  atLeast += w * (1 - (r * (r - 1)) / 2 / total);
}
numeric(36, "25/74");
assert(Math.abs(both / atLeast - 25 / 74) < 1e-12);
const cells = ints(0, 24)
  .filter((i) => i !== 12)
  .map((i) => [i % 5, Math.floor(i / 5)]);
const diffs = [0, 1].flatMap((axis) =>
  ints(1, 4).map((c) =>
    Math.abs(cells.filter((p) => p[axis] < c).length * 2 - cells.length),
  ),
);
numeric(37, Math.min(...diffs));
const medians = [];
for (let a = 0; a < 10; a++)
  for (let b = a; b < 10; b++)
    for (let c = b; c < 10; c++)
      if (a + b + c + 30 === 42) medians.push((c + 10) / 2);
numeric(38, Math.max(...medians));
numeric(
  39,
  fraction(
    ints(1, 30).filter((n) => (n % 2 === 0) !== (n % 3 === 0) && n % 5 !== 0)
      .length,
    30,
  ),
);
const tenPacks = ints(0, 8).filter((x) => 10 * x + 6 * (8 - x) === 64);
assert.deepEqual(tenPacks, [4]);
const subsets = [];
for (let a = 0; a < 7; a++)
  for (let b = a + 1; b < 7; b++)
    for (let c = b + 1; c < 7; c++) subsets.push([a, b, c]);
numeric(
  40,
  fraction(
    subsets.filter((p) => p.reduce((sum, n) => sum + (n < 3 ? 10 : 6), 0) >= 26)
      .length,
    subsets.length,
  ),
);
// DS: full finite domains where bounded; representative witnesses where the ledger gives an algebraic proof.
const dsExpected = [
  "s1",
  "s1",
  "s2",
  "joint",
  "either",
  "neither",
  "joint",
  "joint",
  "either",
  "either",
  "neither",
  "s1",
  "s1",
  "either",
  "joint",
  "s1",
  "joint",
  "joint",
  "joint",
  "joint",
];
function dsCheck(i, domain, s1, s2, task) {
  const a = domain.filter(s1),
    b = domain.filter(s2),
    joint = domain.filter((x) => s1(x) && s2(x));
  assert(joint.length, `DS${i} inconsistent`);
  const sufficient = (xs) => new Set(xs.map(task)).size === 1;
  const x = sufficient(a),
    y = sufficient(b),
    z = sufficient(joint);
  const result =
    x && y ? "either" : x ? "s1" : y ? "s2" : z ? "joint" : "neither";
  assert.equal(result, dsExpected[i - 1], `DS${i} modeled outcome`);
  assert.equal(groups.sufficiency[i - 1].correctChoiceId, result);
  assert.deepEqual(
    groups.sufficiency[i - 1].choices.map((c) => c.choiceId),
    ["s1", "s2", "joint", "either", "neither"],
  );
}
dsCheck(
  1,
  ints(1, 20),
  (n) => n % 4 === 0,
  (n) => n > 10,
  (n) => n % 2 === 0,
);
dsCheck(
  2,
  ints(1, 8).flatMap((value) => ints(1, 6).map((length) => [value, length])),
  (p) => p[0] === 6,
  (p) => p[1] % 2 === 0,
  (p) => p[0],
);
dsCheck(
  3,
  ints(-20, 20),
  (t) => t < 10,
  (t) => t >= 8,
  (t) => t < 0,
);
const fruit = ints(0, 12).flatMap((a) => ints(0, 12).map((b) => [a, b]));
dsCheck(
  4,
  fruit,
  (p) => p[0] === 4,
  (p) => p[1] === 7,
  (p) => p[0] + p[1],
);
const prime = (n) =>
  n >= 2 && ints(2, Math.floor(Math.sqrt(n))).every((d) => n % d);
dsCheck(
  5,
  ints(1, 9),
  (n) => n === 7,
  (n) => n % 2 === 1 && prime(n),
  prime,
);
dsCheck(
  6,
  ints(1, 100),
  (n) => n % 6 === 0,
  (n) => n < 20,
  (n) => ints(1, n).filter((d) => n % d === 0).length,
);
dsCheck(
  7,
  ints(10, 99),
  (n) => Math.floor(n / 10) + (n % 10) === 9,
  (n) => Math.floor(n / 10) === 2 * (n % 10),
  (n) => n,
);
dsCheck(
  8,
  ints(1, 6),
  prime,
  (n) => n % 3 === 0,
  (n) => n > 3,
);
const ab = ints(1, 12).flatMap((a) => ints(a + 1, 16).map((b) => [a, b]));
dsCheck(
  9,
  ab,
  (p) => (p[0] + p[1]) % 2 === 1,
  (p) => p[0] % 2 !== p[1] % 2,
  (p) => (p[0] + p[1]) % 2 === 0,
);
dsCheck(
  10,
  ints(1200, 1400),
  (n) => n >= 1250 && n < 1300,
  (n) => n >= 1270 && n < 1350,
  (n) => Math.floor(n / 100 + 0.5),
);
dsCheck(
  11,
  ints(1, 50).filter((n) => n % 3 === 1),
  (n) => n < 15,
  (n) => n % 2 === 0,
  (n) => n % 4 === 0,
);
const triples = ints(-5, 5).flatMap((a) => ints(7, 12).map((b) => [a, 6, b]));
dsCheck(
  12,
  triples,
  (p) => p.reduce((a, b) => a + b, 0) === 18,
  (p) => p[2] === 9,
  (p) => p.reduce((a, b) => a + b, 0),
);
dsCheck(
  13,
  ints(-10, 10).filter((x) => x),
  (x) => x < -2,
  (x) => x * x === 9,
  (x) => 12 / x > 0,
);
dsCheck(
  14,
  ints(1, 50),
  (n) => n % 10 === 2,
  (n) => (n + 3) % 5 === 0,
  (n) => n % 5,
);
const scores = [];
for (let a = 0; a < 3; a++)
  for (let b = a; b < 3; b++)
    for (let c = b; c < 3; c++)
      for (let d = c; d < 3; d++) scores.push([a, b, c, d]);
dsCheck(
  15,
  scores,
  (p) => p[0] === p[2],
  (p) => p[1] === p[3],
  (p) => p[3] - p[0] === 0,
);
dsCheck(
  16,
  ints(1, 12),
  (n) => 6 % n === 0,
  (n) => n % 2 === 0,
  (n) => 12 % n === 0,
);
const orderedScores = [];
for (let a = 0; a <= 10; a++)
  for (let b = a; b <= 10; b++)
    for (let c = b; c <= 10; c++)
      if (a + b + c === 18) orderedScores.push([a, b, c]);
dsCheck(
  17,
  orderedScores,
  (p) => p[2] - p[0] === 6,
  (p) => p[2] === 10,
  (p) => p[1],
);
const codes = permute([1, 2, 3, 4, 5]).map((p) => p.slice(0, 3));
dsCheck(
  18,
  codes,
  (p) => (100 * p[0] + 10 * p[1] + p[2]) % 12 === 0,
  (p) => p[0] > p[1] && p[2] === 4,
  (p) => 100 * p[0] + 10 * p[1] + p[2],
);
const grids = permute(ints(1, 9));
dsCheck(
  19,
  grids,
  (p) =>
    [0, 1, 2].every(
      (i) =>
        p[i * 3] + p[i * 3 + 1] + p[i * 3 + 2] === 15 &&
        p[i] + p[i + 3] + p[i + 6] === 15,
    ),
  (p) => p[0] + p[4] + p[8] === 15 && p[2] + p[4] + p[6] === 15,
  (p) => p[4],
);
const labels = ints(0, 8)
  .filter((r) => r % 2 === 0)
  .flatMap((r) => ints(0, 12).map((b) => [r, b]));
dsCheck(
  20,
  labels,
  (p) => Math.floor((20 + p[0] + p[1]) / 2 + 0.5) === 17,
  (p) => [4, 5].includes(12 - p[1]),
  (p) => p[0],
);
// Independent filing normalization extracted from each actual stem, not the authoring keys.
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
for (const [i, q] of groups.alphabetizing.entries()) {
  const records = [
    ...q.stem.matchAll(/([P-T]): (.*?)(?=; [P-T]:|\. Which)/g),
  ].map((m) => [m[1], m[2]]);
  assert.equal(records.length, i >= 8 ? 5 : 4);
  const normalize = (s) => {
    s = s.toLowerCase();
    if (i === 1) return s.split(",").map((x) => x.trim());
    if (i === 3) {
      const [a, n] = s.split("-");
      return [a, Number(n)];
    }
    if (i === 5) s = s.replace(/^(the|a) /, "");
    if (i === 6)
      s = s.replace(/st\./g, "saint").replace(/dept\./g, "department");
    if (i === 7)
      return s
        .replace(/^(dr\.|ms\.) /, "")
        .replaceAll(".", "")
        .split(",")
        .flatMap((x) => x.trim().split(" "));
    if (i === 8) {
      const [, name, n] = s.match(/^(.*?) \[id ?(\d+)\]$/);
      return [
        ...name.replace(/^the /, "").replaceAll("&", "and").split(" "),
        "",
        Number(n),
      ];
    }
    if (i === 9) {
      const [name, dept, id] = s.split(";").map((x) => x.trim());
      const [sur, given] = name
        .replace(/^(dr\.|ms\.) /, "")
        .split(",")
        .map((x) => x.trim());
      return [sur.replace(/[ '\-]/g, ""), given, dept, Number(id.slice(2))];
    }
    if (i === 4) return s.split(" ");
    return [s.replace(/[ .\-]/g, "")];
  };
  const order = records
    .toSorted((a, b) => {
      const x = normalize(a[1]),
        y = normalize(b[1]);
      for (let k = 0; k < Math.max(x.length, y.length); k++) {
        if (k >= x.length) return -1;
        if (k >= y.length) return 1;
        const d = compare(x[k], y[k]);
        if (d) return d;
      }
      return 0;
    })
    .map((x) => x[0]);
  assert.equal(answer(q), order.join(" → "), q.questionId);
  for (const c of q.choices)
    assert.deepEqual(
      c.text.split(" → ").toSorted(),
      records.map((r) => r[0]).toSorted(),
    );
}
const clericalExpected = [
  "7 May",
  "Copy18 only",
  "Intake",
  "12",
  "L3",
  "A306; Bnone; C307",
  "Q only",
  "17 June",
  String(40 + 30 - 18 + 4 - 5),
  "AB-007 / AB 007",
  "Privacy → Finance → Director",
  "L=Cash; M=Records; N=third",
  "Z only",
  "B,C,A",
  "PHP350",
  "C only",
  "A then B only",
  "80 / T2,T4,T1-reversal / T3",
  "Names Lia,Mio; amounts45,60; no addresses; phone22 only; total105",
  "A and B",
];
groups.clerical.forEach((q, i) =>
  assert.equal(compact(answer(q)), compact(clericalExpected[i]), q.questionId),
);
// Simulate parallel scheduling and enumerate lexicographic dispatch to test tempting alternatives.
const finish = (order) => {
  let prep = 0;
  const ready = {};
  for (const id of order) {
    prep += id === "A" ? 10 : 15;
    ready[id] = prep;
  }
  return Math.max(Math.max(ready.A, 0) + 20, ready.B) + 5;
};
assert.equal(finish(["A", "B"]), 35);
assert.equal(finish(["B", "A"]), 50);
const packets = [
  ["A", 6, true, 2],
  ["B", 4, true, 1],
  ["C", 3, false, 1],
  ["D", 4, true, 2],
];
const loads = ints(1, 15)
  .map((mask) => packets.filter((_, i) => mask & (1 << i)))
  .filter((p) => p.reduce((s, x) => s + x[1], 0) <= 10)
  .map((p) => ({
    ids: p.map((x) => x[0]).join(","),
    due: p.filter((x) => x[2]).length,
    priority: p.filter((x) => x[2]).reduce((s, x) => s + x[3], 0),
    weight: p.reduce((s, x) => s + x[1], 0),
  }))
  .toSorted(
    (a, b) => b.due - a.due || a.priority - b.priority || b.weight - a.weight,
  );
assert.equal(loads[0].ids, "A,B");
const spellingExpected = [
  "legible",
  "duplicate",
  "concise",
  "expedite",
  "Swap e and i in retreival",
  "1 and4",
  "dispatch curriculum",
  "Replace e with o in directery; delete one s in revission",
  "1,2,5: custodian; pagination; affidavit",
  "attachment stipulation attachment attachment stipulation attachment / 4 / 3",
];
groups.spelling.forEach((q, i) => {
  assert.equal(compact(answer(q)), compact(spellingExpected[i]), q.questionId);
  assert(
    q.provenance.sources.every(
      (s) =>
        s.includes("https://www.merriam-webster.com/dictionary/") &&
        s.includes("2026-11-04"),
    ),
  );
});
const proofreading = [
  "attachement",
  "stipullation",
  "attachement",
  "attachment",
  "stipulation",
  "atachment",
];
const wrong = proofreading.filter(
  (w) => !["attachment", "stipulation"].includes(w),
);
assert.equal(wrong.length, 4);
assert.equal(new Set(wrong).size, 3);
export const checkResult = {
  status: "PASS",
  questions: 100,
  numerical: 60,
  clerical: 40,
  sufficiency: 20,
  filingOrders: 10,
  gridModels: grids.length,
  limitations:
    "Finite domains exhaustively checked where supplied; unbounded DS uses algebraic ledger proof plus counterexample witnesses. Dictionary and editorial judgment remain human-review gates.",
};
if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/family07-numerical-clerical-check.mjs")
)
  console.log(JSON.stringify(checkResult));

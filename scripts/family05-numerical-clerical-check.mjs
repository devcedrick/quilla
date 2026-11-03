// Separate integrating-agent recomputation. Finite samples supplement, not replace,
// the algebraic uniqueness proofs and counterexamples in the item ledger.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) =>
  JSON.parse(
    readFileSync(`content/question-bank/family-05/content/${f}.json`, "utf8"),
  );
const nr = read("numerical"),
  ds = read("sufficiency"),
  ops = read("clerical"),
  alpha = read("alphabetizing"),
  spell = read("spelling");
const key = (q) => q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const vals = [
  2400,
  "3/20",
  "Negative",
  range(1, 49).filter((n) => 49 % n === 0).length,
  "6×(4/3)",
  360 / 8,
  5 ** 3,
  (4 * 3) / 2,
  4,
  (-9 + 5) / 2,
  6 * 3 ** 2,
  (1000 - 4) / 2,
  ((3 * (20 / 60)) / (5 - 3)) * 60,
  4 * 4 * 3,
  range(-20, 20).filter((n) => Math.abs(2 * n - 7) <= 3).length,
  0.01,
  "Two",
  "B by PHP 10",
  (1000 * 1.1 - 400) * 1.1 - 400,
  (1200 * (1 / 6)) / (1 / 4 + 1 / 6 + 1 / 12),
  range(1, 20).filter((n) => n > 3 && n < 13).length,
  2 * (12 + 9),
  400 / 8,
  "91/216",
  "9/10",
  "3/11",
  32 / (2 - 9 / 5),
  90,
  90 / (6 - 0.5),
  14 - Math.hypot(6, 8),
  "(76 2/3,80)",
  (125 * 3) / 5,
  132,
  "8/11",
  4,
  20,
  648,
  50 + (720 - 100) / 5,
  "(40,28,29)",
  "76 minutes 40 seconds",
];
function parsed(s) {
  const t = s
    .replace(/PHP|degrees|minutes|seconds|hours|mL|cm²|cm³|m²|mm|cm|\bm\b/g, "")
    .trim();
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return a / b;
  }
  return /^[-\d.]+$/.test(t) ? Number(t) : s.replace(/\s/g, "");
}
for (let i = 0; i < 40; i++) {
  const a = parsed(key(nr[i])),
    b = typeof vals[i] === "string" ? parsed(vals[i]) : vals[i];
  if (typeof b === "number")
    assert.ok(Math.abs(a - b) < 1e-8, `Numerical${i + 1}: ${a} versus ${b}`);
  else assert.equal(a, b, `Numerical${i + 1}`);
}
assert.equal(1 - (5 / 6) ** 3, 91 / 216);
let maxArea = 0;
for (let x = 1; x <= 26; x++)
  for (let y = 1; y <= 20; y++)
    if (30 * x + 40 * y <= 800) maxArea = Math.max(maxArea, x * y);
assert.equal(maxArea, 132);
let stairs = 0;
function walk(total, lastDouble, doubles, last) {
  if (total === 12) {
    if (doubles === 3 && last === 1) stairs++;
    return;
  }
  for (const step of [1, 2])
    if (
      total + step <= 12 &&
      !(step === 2 && lastDouble) &&
      doubles + (step === 2) <= 3
    )
      walk(total + step, step === 2, doubles + (step === 2), step);
}
walk(0, false, 0, 0);
assert.equal(stairs, 20);
let newMedianMax = 0;
for (let a = 0; a <= 100; a++)
  for (let b = 0; b <= 100; b++) {
    const s = [10, 20, 30, 40, 50, a, b].sort((x, y) => x - y);
    if (s.reduce((a, b) => a + b) === 280 && s[3] === 40)
      newMedianMax = Math.max(newMedianMax, a, b);
  }
assert.equal(newMedianMax, 90);
const assess = (n, cases, s1, s2, target) => {
  const outcomes = (filter) =>
    new Set(
      cases.filter(filter).map((c) => {
        const v = target(c);
        return typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v;
      }),
    );
  const a = outcomes(s1),
    b = outcomes(s2),
    c = outcomes((x) => s1(x) && s2(x));
  assert.ok(c.size > 0, `DS${n} inconsistent`);
  const id =
    a.size === 1
      ? b.size === 1
        ? "either-alone"
        : "s1-only"
      : b.size === 1
        ? "s2-only"
        : c.size === 1
          ? "both-needed"
          : "neither";
  assert.equal(ds[n - 1].correctChoiceId, id, `DS${n}`);
};
const ints = range(1, 100),
  prime = (n) =>
    n > 1 && range(2, Math.floor(Math.sqrt(n))).every((d) => n % d !== 0);
assess(
  1,
  ints,
  (x) => x === 6,
  (x) => 2 * x === 12,
  (x) => 3 * x,
);
assess(
  2,
  ints,
  (x) => x === 2,
  (x) => x % 2 === 0,
  prime,
);
assess(
  3,
  range(1, 60).map((x) => x / 2),
  Number.isInteger,
  (x) => x > 10,
  (x) => x - Math.floor(x),
);
assess(
  4,
  ["HH", "HT", "TH", "TT"],
  (x) => x[0] === "H",
  (x) => x[1] === "T",
  (x) => [...x].filter((c) => c === "H").length,
);
assess(
  5,
  range(1, 9),
  (x) => x < 3,
  (x) => x > 1,
  (x) => x > 5,
);
assess(
  6,
  range(10, 99),
  (x) => Math.floor(x / 10) === 4,
  (x) => x % 10 === 5,
  (x) => Math.max(Math.floor(x / 10), x % 10),
);
assess(
  7,
  range(1, 10).flatMap((m) => range(-4, 4).map((k) => [m, k])),
  (x) => x[0] === 6,
  (x) => x[1] === 3,
  (x) => x[0] + x[1],
);
assess(
  8,
  range(10, 99).filter((n) => Math.floor(n / 10) !== n % 10),
  (n) => Math.floor(n / 10) + (n % 10) === 11,
  (n) => Math.floor(n / 10) < 5,
  (n) => n % 10 > Math.floor(n / 10),
);
assess(
  9,
  range(-20, 20).map((x) => x / 2),
  (x) => x ** 3 < 0,
  (x) => x * x === 9,
  (x) => Math.abs(x + 2) < Math.abs(x - 2),
);
const pairs = range(1, 20).flatMap((a) => range(1, 20).map((b) => [a, b]));
assess(
  10,
  pairs,
  ([a]) => a % 2 === 1,
  ([a, b]) => b === a + 1,
  ([a, b]) => gcd(a, b) === 1,
);
assess(
  11,
  pairs,
  ([a, b]) => a - 2 * b === 5,
  ([a, b]) => a > b,
  ([a, b]) => a > 2 * b,
);
assess(
  12,
  ints,
  (n) => range(1, n).filter((d) => n % d === 0).length % 2 === 1,
  (n) => n % 4 === 0,
  (n) => Number.isInteger(Math.sqrt(n)),
);
assess(
  13,
  pairs.filter(([a, b]) => Math.abs(a - b) === 4),
  ([a, b]) => a + b === 12,
  ([a, b]) => a === 8 || b === 8,
  ([a, b]) => a * b > 25,
);
const signed = range(-5, 5)
  .filter(Boolean)
  .flatMap((a) =>
    range(-5, 5)
      .filter(Boolean)
      .map((b) => [a, b]),
  );
assess(
  14,
  signed,
  ([a, b]) => a + b < 0,
  ([a, b]) => a * a > b * b,
  ([a, b]) => a * b > 0,
);
assess(
  15,
  range(1, 30),
  prime,
  (n) => n % 2 === 0,
  (n) => n >= 3,
);
const masks = range(1, 1023).map((mask) =>
  range(0, 9).filter((d) => mask & (1 << d)),
);
assess(
  16,
  masks,
  (d) => d.length === 3,
  (d) => !d.includes(0),
  (d) => d.length * d.filter((x) => x !== 0).length,
);
const boxes = range(0, 5).flatMap((r) =>
  range(0, 5)
    .filter((b) => r + b > 0)
    .map((b) => [r, b]),
);
assess(
  17,
  boxes.flatMap((a) => boxes.map((b) => [...a, ...b])),
  ([a, b, c, d]) => a + c === b + d,
  ([a, b, c, d]) => a + b === c + d,
  ([a, b, c, d]) => (a / (a + b) + c / (c + d)) / 2 > 0.5 + 1e-9,
);
const reals = [
  0.25,
  0.5,
  1,
  2,
  3,
  4,
  (3 - Math.sqrt(5)) / 2,
  (3 + Math.sqrt(5)) / 2,
];
assess(
  18,
  reals,
  (x) => Math.abs((x - 1 / x) ** 2 - 5) < 1e-8,
  (x) => Math.abs(x * x - 3 * x + 1) < 1e-8,
  (x) => x + 1 / x,
);
assess(
  19,
  range(1, 500).map((a) => [a, 1001 - a]),
  ([a]) => a % 7 === 0,
  ([, b]) => b % 11 === 0,
  ([a, b]) => gcd(a, b),
);
assess(
  20,
  range(10, 99),
  (n) => n % 9 === 4,
  (n) => (n * n) % 10 === 6,
  (n) => n % 7 === 0,
);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const record = (q) =>
  [...q.stem.matchAll(/R(\d+): (.+)/g)].map((m) => ({
    id: "R" + m[1],
    s: m[2],
  }));
for (let n = 0; n < 10; n++) {
  let rows = record(alpha[n]);
  let cmp;
  const folded = (s) => s.toLowerCase();
  if (n === 0)
    cmp = (a, b) =>
      compare(
        a.s.split(" ").reverse().join(" "),
        b.s.split(" ").reverse().join(" "),
      );
  if (n === 1) cmp = (a, b) => compare(a.s.split("—")[1], b.s.split("—")[1]);
  if (n === 2) {
    const k = (s) => {
      let [name, suffix] = s.split("; ");
      let [surname, given] = name.split(", ");
      return [surname, given, { "Sr.": 0, "Jr.": 1, III: 2 }[suffix]];
    };
    cmp = (a, b) => {
      let x = k(a.s),
        y = k(b.s);
      return compare(x[0], y[0]) || compare(x[1], y[1]) || x[2] - y[2];
    };
  }
  if (n === 3)
    cmp = (a, b) =>
      compare(
        a.s.split(" ").reverse().join(" "),
        b.s.split(" ").reverse().join(" "),
      );
  if (n === 4)
    cmp = (a, b) => compare(folded(a.s), folded(b.s)) || compare(a.s, b.s);
  if (n === 5) {
    const k = (s) =>
      folded(s)
        .replaceAll("&", " and ")
        .replaceAll("-", " ")
        .replace(/\s+/g, " ");
    cmp = (a, b) => compare(k(a.s), k(b.s));
  }
  if (n === 6) {
    const alphabet = "abcdefghijklmnñopqrstuvwxyz";
    cmp = (a, b) => {
      let x = folded(a.s),
        y = folded(b.s);
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        let diff = alphabet.indexOf(x[i]) - alphabet.indexOf(y[i]);
        if (diff) return diff;
      }
      return x.length - y.length;
    };
  }
  if (n === 7) {
    const k = (s) => folded(s).replace(/[ -]/g, "");
    cmp = (a, b) => compare(k(b.s), k(a.s));
  }
  if (n === 8) {
    const k = (s) => {
      let [name, code] = s.split("; code");
      name = name
        .replace(/^PERSON: /, "")
        .replace(/^ORG: (The )?/, "")
        .replace(/[ ,.-]/g, "")
        .toLowerCase();
      return [name, Number(code)];
    };
    cmp = (a, b) => {
      let x = k(a.s),
        y = k(b.s);
      return compare(x[0], y[0]) || x[1] - y[1];
    };
  }
  if (n === 9) {
    const k = (s) => {
      let [name, rev] = s.split("; rev"),
        i = name.lastIndexOf(".");
      return [
        name.slice(0, i).replace(/[ -]/g, "").toLowerCase(),
        name.slice(i + 1).toLowerCase(),
        Number(rev),
      ];
    };
    cmp = (a, b) => {
      let x = k(a.s),
        y = k(b.s);
      return compare(x[0], y[0]) || compare(x[1], y[1]) || y[2] - x[2];
    };
  }
  const expected = rows
    .sort(cmp)
    .map((x) => x.id)
    .join(",");
  assert.equal(
    key(alpha[n]).replace(/\s/g, ""),
    expected,
    `Alphabetizing${n + 1}`,
  );
  for (const c of alpha[n].choices)
    assert.deepEqual(
      c.text.match(/R\d+/g).sort(),
      rows.map((x) => x.id).sort(),
    );
}
assert.equal(key(ops[12]), String(10 * 60 + 5 - 9 * 60 - 15));
const perm = (a) =>
  a.length
    ? a.flatMap((v, i) =>
        perm(a.filter((_, j) => j !== i)).map((t) => [v, ...t]),
      )
    : [[]];
const folder = perm([11, 12, 13, 14]).filter(
  (a) => a.every((v, i) => v !== 11 + i) && a[1] + 1 === a[3] && a[0] < a[2],
);
assert.deepEqual(folder, [[13, 11, 14, 12]]);
assert.equal(key(ops[14]).replace(/\s/g, ""), "(13,11,14,12)");
assert.equal(key(ops[16]).replace(/\s/g, ""), "09:20–09:40");
assert.equal(key(ops[17]), "6");
assert.equal(key(ops[18]).replace(/\s/g, ""), "PHP600");
assert.equal(key(ops[19]).replace(/\s/g, ""), "9hours");
assert.equal(1000 - 120 + 20 - (300 - 120 - 80 + 200), 600);
assert.equal(Math.min(7 - 1, 5) + Math.min(5 - 1, 5), 9);
assert.deepEqual(
  spell.map((q) => q.correctChoiceId),
  ["c2", "c4", "c1", "c3", "c1", "c4", "c2", "c1", "c3", "c4"],
);
export const checkResult = {
  status: "PASS",
  numerical: 40,
  sufficiency: 20,
  sorting: 10,
  clerical: 20,
  spelling: 10,
};
console.log(JSON.stringify(checkResult));

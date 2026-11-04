import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const json = (p) =>
  JSON.parse(readFileSync(new URL(p, root), "utf8").replace(/^\uFEFF/, ""));
const base = "content/question-bank/family-07/";
const data = json(base + "content/analytical-data.json"),
  logic = json(base + "content/analytical-logic.json"),
  charts = json("scripts/family07-chart-data.json");
const key = (q) => q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const perms = (a) =>
  a.length
    ? a.flatMap((x, i) =>
        perms(a.filter((_, j) => i !== j)).map((p) => [x, ...p]),
      )
    : [[]];
const product = (a, n) =>
  n ? a.flatMap((x) => product(a, n - 1).map((p) => [x, ...p])) : [[]];
const sum = (a) => a.reduce((x, y) => x + y, 0);
const eq = (q, v) => assert.equal(key(q), String(v), q.questionId);
assert.equal(data.length, 40);
assert.equal(logic.length, 40);
for (const list of [data, logic])
  assert.deepEqual(
    ["easy", "medium", "hard"].map(
      (d) => list.filter((q) => q.difficulty === d).length,
    ),
    [12, 20, 8],
  );
for (const q of [...data, ...logic]) {
  assert.equal(q.module, "analytical");
  assert.deepEqual(q.levelApplicability, ["professional"]);
  assert.equal(q.language, "english");
  assert.equal(q.version, 1);
  assert.equal(new Set(q.choices.map((c) => c.text)).size, 4);
  assert(
    !/\u00e2\u20ac|\u00c3/.test(JSON.stringify(q)),
    q.questionId + " encoding",
  );
}
// Values are recalculated from canonical arrays, independently of author explanations.
const [bins, cum, stacks, idx, points, pie, ranges, flow, projects, matrix] =
  charts.map((c) => c.rows);
const actual = idx.map((r) => [(80 * r[1]) / 100, (120 * r[2]) / 100]);
const expected = [
  bins[2][1],
  "40–<50 seconds",
  "20–<30",
  sum(bins.slice(0, 2).map((r) => r[1])),
  cum[3][1],
  cum[1][1] - cum[0][1],
  "Thursday",
  cum[4][1] - cum[2][1],
  stacks[1][2],
  "South",
  3,
  "West",
  `S by ${actual[1][1] - actual[1][0]}`,
  "III",
  `${sum(actual[2]) / 2}%`,
  (actual[3][1] / 80) * 100,
  "F and H",
  (points[4][2] + points[5][2]) / 2 - (points[1][2] + points[2][2]) / 2,
  "D and E",
  "E",
  `${pie[1][1] / 2 + pie[2][1] / 4}%`,
  `${(((400 * 0.15 + 20) / 420) * 100).toFixed(2)}%`,
  "2/9",
  "3/7",
  Math.min(...ranges.slice(0, 3).map((r) => r[2])) -
    Math.max(...ranges.slice(0, 3).map((r) => r[1])) +
    1,
  Math.min(ranges[0][2], 35 - ranges[1][1]) + " L",
  "36 L",
  "18 L",
  55,
  "37 in;47 out",
  "Closing 65; peak 112",
  5,
];
expected.forEach((v, i) => eq(data[i], v));
assert.deepEqual(actual, [
  [80, 120],
  [96, 132],
  [72, 156],
  [120, 144],
]);
assert.equal(sum(bins.map((r) => r[1])), 35);
assert.equal(sum(pie.map((r) => r[1])), 100);
assert.equal(
  flow[0][1] + sum(flow.slice(1, -1).map((r) => r[1])),
  flow.at(-1)[1],
);
const subsets = product([false, true], 5).map((bits) =>
  projects.filter((_, i) => bits[i]),
);
const tot = (s) => [1, 2, 3].map((j) => sum(s.map((r) => r[j])));
const has = (s, x) => s.some((r) => r[0] === x);
const candidate = (f) => subsets.filter((s) => f(s, tot(s)));
let ss = candidate(
  (s, [c, , t]) =>
    s.length >= 2 &&
    c <= 13 &&
    t <= 7 &&
    !(has(s, "A") && has(s, "E")) &&
    (!has(s, "B") || has(s, "D")),
);
eq(data[32], Math.max(...ss.map((s) => tot(s)[1])) + " points");
ss = candidate(
  (s, [c, b]) =>
    s.length === 3 &&
    c <= 15 &&
    b >= 30 &&
    !(has(s, "C") && has(s, "D")) &&
    (!has(s, "E") || has(s, "A")),
);
eq(data[33], Math.min(...ss.map((s) => tot(s)[2])) + " slots");
ss = candidate((s, [c, , t]) => s.length === 2 && c <= 11 && t <= 6);
let mn = Math.max(...ss.map((s) => Math.min(...s.map((r) => r[2]))));
assert.equal(mn, 9);
assert.deepEqual(
  ss
    .filter((s) => Math.min(...s.map((r) => r[2])) === mn)
    .map((s) => s.map((r) => r[0]).join(""))
    .sort(),
  ["AB", "AC"],
);
eq(data[34], "A and B; or A and C");
ss = candidate(
  (s, [c, , t]) =>
    c <= 14 &&
    t <= 8 &&
    (!has(s, "E") || has(s, "D")) &&
    !(has(s, "A") && has(s, "C")) &&
    !(has(s, "A") && has(s, "D")),
);
assert.equal(Math.max(...ss.map((s) => tot(s)[1])), 32);
const packageScores = [
  [15, 8],
  [14, 9],
  [15, 9],
  [16, 8],
].map(([budget, staff]) =>
  Math.max(
    ...candidate(
      (s, [c, , t]) =>
        c <= budget &&
        t <= staff &&
        (!has(s, "E") || has(s, "D")) &&
        !(has(s, "A") && has(s, "C")) &&
        !(has(s, "A") && has(s, "D")),
    ).map((s) => tot(s)[1]),
  ),
);
assert.deepEqual(packageScores, [32, 32, 35, 32]);
eq(data[35], "Raise cost capacity 15 and staff capacity 9");
const pp = perms([0, 1, 2, 3]),
  cost = (p) => p.map((v, i) => matrix[i][v + 1]);
let ps = pp.filter((p) => p[0] !== 1 && p[3] !== 0);
eq(data[36], Math.min(...ps.map((p) => sum(cost(p)))) + " minutes");
ps = pp.filter((p) => p[2] !== 2 && p[3] !== 0 && cost(p)[0] + cost(p)[3] <= 9);
eq(data[37], Math.min(...ps.map((p) => Math.max(...cost(p)))) + " minutes");
assert(!ps.some((p) => Math.max(...cost(p)) <= 5));
ps = pp.filter((p) => Math.abs(p[1] - p[2]) === 1 && p[0] < p[3]);
eq(data[38], Math.min(...ps.map((p) => sum(cost(p)))) + " minutes");
ps = product([0, 1, 2, 3], 4).filter(
  (p) =>
    new Set(p).size === 2 &&
    p.every((x) => p.filter((y) => y === x).length === 2) &&
    p[0] !== p[1] &&
    p[2] !== p[3],
);
eq(data[39], Math.min(...ps.map((p) => sum(cost(p)) + 6)));
// Non-hard logic: separately keyed editorial conclusions plus finite boundary witnesses.
const expectedLogic = [
  "DISCONNECT",
  "FREQUENCY DOUBLES",
  "Selective filter : excludes entries",
  "Liquid clay : shaping : cup",
  "It is not a circle",
  "The card is face down",
  "(2,5) to (2,8)",
  "31",
  "M -> N",
  "Not R, and S",
  "Three lamps are on",
  "The rule alone does not determine its score",
  "B",
  "Left red/right blue; or left blue/right red",
  "AABA",
  "R, S, P, Q",
  "6 and 8",
  "A chosen shape that is small and plain",
  "A, B, D",
  "Either ON or OFF remains possible",
  "M, K, J, L",
  "{1,3}, {1,5} and {2,4}",
  "B and E",
  "M and N",
  "1 or 2",
  "Y exceeds Z",
  "The reports are consistent, but the true state is not fixed",
  "Every route through H also passes through G",
  "BAB",
  "1",
  "Necessary for acceptance, but not sufficient",
  "Transactions without receipts",
];
expectedLogic.forEach((v, i) => eq(logic[i], v));
assert.equal(
  ["F", "S", "F", "F", "S", "F", "F"].filter((x) => x === "F").length % 4,
  1,
);
assert.equal(
  "XABXA".replaceAll("X", "").replace(/^(.)(.*)$/, "$1$1$2"),
  "AABA",
);
assert.deepEqual(
  perms(["P", "Q", "R", "S"])
    .filter(
      (p) =>
        p.indexOf("Q") === p.indexOf("P") + 1 &&
        p.indexOf("R") < p.indexOf("P") &&
        p.at(-1) !== "S",
    )
    .map((p) => p.join(",")),
  ["R,S,P,Q", "S,R,P,Q"],
);
assert.deepEqual(
  [2, 6, 7, 8].filter((n) => n % 2 === 0 && n > 5),
  [6, 8],
);
let queue = ["J", "K", "L", "M"];
for (let n = 0; n < 2; n++) {
  queue.push(queue.shift());
  [queue[0], queue[1]] = [queue[1], queue[0]];
}
assert.equal(queue.join(", "), "M, K, J, L");
assert.deepEqual(
  perms([1, 2, 3, 4, 5])
    .map((p) => p.slice(0, 2))
    .filter((p) => p[0] < p[1] && (p[0] + p[1]) % 2 === 0 && p[0] * p[1] < 10)
    .map((p) => p.join(""))
    .filter((x, i, a) => a.indexOf(x) === i)
    .sort(),
  ["13", "15", "24"],
);
assert.deepEqual(
  [
    ...new Set(
      product([0, 1, 2, 3, 4], 3)
        .filter((p) => p[0] <= 2 && p[1] <= 3 && p[2] <= 4 && sum(p) === 8)
        .map((p) => p[0]),
    ),
  ].sort(),
  [1, 2],
);
assert.equal(
  ("ABBA".slice(2) + "ABBA".slice(0, 2)).replace(/(.)\1+/g, "$1"),
  "BAB",
);
// Hard logic1: compare all codewords and enforce number AND spacing of errors.
const sent = [
  "0000000",
  "0011110",
  "1100110",
  "1111000",
  "1001101",
  "1010011",
].filter((w) => {
  const e = [...w].flatMap((c, i) => (c !== "1010110"[i] ? [i] : []));
  return e.length === 2 && Math.abs(e[0] - e[1]) !== 1;
});
assert.deepEqual(sent, ["0011110", "1010011"]);
eq(logic[32], sent.join(" and "));
// Hard logic2: knowledge announcements use the information available BEFORE each speech.
const pairs = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 2],
  [3, 3],
  [4, 3],
];
const aUnknown = (p) => pairs.filter((x) => x[0] === p[0]).length > 1;
const after = pairs
  .filter(aUnknown)
  .filter((p) => pairs.filter((x) => x[1] === p[1]).every(aUnknown));
const knows = after.filter(
  (p) => after.filter((x) => x[0] === p[0]).length === 1,
);
assert.deepEqual(knows, [[3, 2]]);
eq(logic[33], "(3,2)");
// Hard logic3: exact-cover enumeration including orientation count.
const cells = Array.from({ length: 12 }, (_, i) => i).filter(
  (i) => i !== 0 && i !== 11,
);
const tile = (remain, h = 0) => {
  if (!remain.length) return [h];
  const a = remain[0];
  return [a % 4 < 3 ? a + 1 : -1, a + 4]
    .filter((b) => remain.includes(b))
    .flatMap((b) =>
      tile(
        remain.filter((x) => x !== a && x !== b),
        h + (Math.floor(a / 4) === Math.floor(b / 4) ? 1 : 0),
      ),
    );
};
const tilings = tile(cells);
assert.equal(tilings.length, 5);
eq(logic[34], tilings.filter((h) => h === 3).length);
// Hard logic4: all agendas; there is a majority cycle, no stable total ranking.
const votes = ["ABC", "ABC", "BCA", "BCA", "CAB"];
const winner = (a, b) =>
  votes.filter((p) => p.indexOf(a) < p.indexOf(b)).length >= 3 ? a : b;
eq(
  logic[35],
  perms(["A", "B", "C"]).filter((p) => winner(winner(p[0], p[1]), p[2]) === "B")
    .length,
);
// Hard logic5: unique multiset strings; rotations canonicalised, reflection untouched.
const strings = [...new Set(perms([..."RRRBBBGG"]).map((p) => p.join("")))];
assert.equal(strings.length, 560);
const rings = strings.filter((s) => {
  let bb = 0;
  for (let i = 0; i < 8; i++) {
    const a = s[i],
      b = s[(i + 1) % 8];
    if (a === b && "RG".includes(a)) return false;
    if (a === b && a === "B") bb++;
  }
  return bb === 1;
});
const canonical = (s) =>
  Array.from({ length: 8 }, (_, i) => s.slice(i) + s.slice(0, i)).sort()[0];
eq(logic[36], new Set(rings.map(canonical)).size);
const catalogue = [
  "BBGRBRGR",
  "BBGRGRBR",
  "BBRBGRGR",
  "BBRBRGRG",
  "BBRGBRGR",
  "BBRGRBGR",
  "BBRGRBRG",
  "BBRGRGBR",
  "BBRRGGBR",
  "BBGRRGBR",
  "RBBGRBRG",
  "BBGRGRRB",
];
assert.equal(
  new Set(catalogue.filter((s) => rings.includes(s)).map(canonical)).size,
  8,
);
// Hard logic6: simulate all distinct permitted strings; operation order matters.
const op = {
  P: (s) => s.slice(0, 3).split("").reverse().join("") + s.slice(3),
  Q: (s) => s.slice(0, 2) + s.slice(2).split("").reverse().join(""),
  R: (s) => s.slice(1) + s[0],
};
const orders = [...new Set(perms([..."PPQQRR"]).map((p) => p.join("")))];
const returns = orders.filter(
  (s) =>
    !/(.)\1/.test(s) && [...s].reduce((v, c) => op[c](v), "ABCDE") === "ABCDE",
);
assert.deepEqual(returns.sort(), ["PRQPRQ", "QPRQPR", "RQPRQP"]);
eq(logic[37], returns.length);
const proposals = [
  "PRQPRQ",
  "QPRQPR",
  "RQPRQP",
  "PQRQPR",
  "RQPRPQ",
  "RQPQPR",
  "QRPQRP",
  "PQPQRR",
];
assert.equal(
  proposals.filter(
    (s) =>
      !/(.)\1/.test(s) &&
      [...s].reduce((v, c) => op[c](v), "ABCDE") === "ABCDE",
  ).length,
  3,
);
// Hard logic7: enumerate every deletion subset and every colouring, including longer odd cycles.
const edges = ["AB", "BC", "CA", "CD", "DE", "EC", "AD"];
let optimal = [];
for (let n = 0; n <= 7; n++) {
  optimal = product([false, true], 7)
    .filter((p) => p.filter(Boolean).length === n)
    .filter((del) =>
      product([0, 1], 5).some((c) =>
        edges.every(
          (e, i) =>
            del[i] || c[e.charCodeAt(0) - 65] !== c[e.charCodeAt(1) - 65],
        ),
      ),
    );
  if (optimal.length) {
    assert.equal(n, 2);
    break;
  }
}
assert.deepEqual(
  optimal.map((del) => edges.filter((_, i) => del[i]).join(",")).sort(),
  ["AB,CD", "BC,CD", "CA,DE", "CA,EC"].sort(),
);
eq(logic[38], optimal.length);
// Hard logic8: exhaustive prefix parsing, no overlapping-substring shortcut.
const parse = (s) =>
  s.length
    ? ["A", "AB", "BA", "ABA"]
        .filter((t) => s.startsWith(t))
        .flatMap((t) => parse(s.slice(t.length)).map((p) => [t, ...p]))
    : [[]];
const valid = parse("ABABAABABA").filter(
  (p) =>
    p.filter((x) => x === "ABA").length === 1 &&
    p.every((x, i) => i === 0 || x !== p[i - 1]),
);
eq(logic[39], valid.length);
// Exact accessible values must derive from the canonical arrays, never from solved keys.
const refs = json(base + "references/analytical-data.json");
assert.equal(refs.length, 10);
for (let i = 0; i < 10; i++) {
  const expected =
    "Exact plotted data. Columns: " +
    charts[i].headers.join("; ") +
    ". Rows: " +
    charts[i].rows.map((r) => r.join(", ")).join("; ") +
    ".";
  assert.equal(
    refs[i].blocks.find((b) => b.type === "image").description,
    expected,
  );
}
export const verificationResult = Object.freeze({
  status: "PASS",
  questionChecks: 80,
  hardCases: 16,
  charts: 10,
  notes:
    "Finite-model calculations and separate editorial keys; no human sign-off or calibration implied.",
});
console.log(JSON.stringify(verificationResult));

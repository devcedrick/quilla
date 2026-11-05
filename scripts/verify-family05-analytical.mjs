import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const root = "content/question-bank/family-05/";
const read = (p) => JSON.parse(readFileSync(root + p, "utf8"));
const data = read("content/analytical-data.json"),
  logic = read("content/analytical-logic.json");
const answer = (kind, n) => {
  const q = (kind === "data" ? data : logic)[n - 1];
  return q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
};
const chartData = JSON.parse(
  readFileSync("scripts/family05-chart-data.json", "utf8"),
);
const table = (id) => chartData["f05-data-" + id].rows;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const permutations = (a) =>
  a.length
    ? a.flatMap((x, i) =>
        permutations(a.filter((_, j) => i !== j)).map((t) => [x, ...t]),
      )
    : [[]];
const evidence = {};
assert.equal(data.length, 40);
assert.equal(logic.length, 40);
for (const items of [data, logic])
  assert.deepEqual(
    ["easy", "medium", "hard"].map(
      (d) => items.filter((q) => q.difficulty === d).length,
    ),
    [12, 20, 8],
  );
const contest = table("contest").map((r) => ({
  name: r[0],
  scores: r.slice(1).map(Number),
}));
const ranking = (s) => [sum(s) - Math.min(...s), Math.max(...s)];
const greater = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
const changes = [];
for (let i = 0; i < 4; i++)
  for (let amount = 1; amount <= 2; amount++) {
    const scores = [...contest[2].scores];
    scores[i] += amount;
    if (
      contest
        .filter((x) => x.name !== "C")
        .every((x) => greater(ranking(scores), ranking(x.scores)))
    )
      changes.push([i + 1, amount]);
  }
assert.deepEqual(changes, [
  [1, 2],
  [2, 2],
  [4, 2],
]);
assert.equal(answer("data", 12), "Event1 +2; Event2 +2; Event4 +2");
evidence.contestChanges = changes;
const occurrence = (day, t) =>
  day % 7 !== 0 &&
  (t === "X" ? day % 4 === 0 : t === "Y" ? day % 3 === 1 : day % 2 === 1);
const calendar = [];
for (let start = 1; start <= 13; start++) {
  const assignments = permutations(["X", "Y", "Z"]).filter((p) =>
    p.every((t, i) => occurrence(start + i, t)),
  );
  if (assignments.length) calendar.push({ start, assignments });
}
assert.deepEqual(
  calendar.map((x) => x.start),
  [8, 10, 11],
);
assert.equal(answer("data", 16), "8, 10, 11");
evidence.calendar = calendar;
const layers = Object.fromEntries(
  table("packing").map(([n, a, b]) => [n, 3 * +a + 5 * +b]),
);
const loadPlans = [];
for (const order of permutations(["P", "Q", "Q", "R"])) {
  const counts = [
    layers[order[0]] + layers[order[1]],
    layers[order[2]] + layers[order[3]],
  ];
  if (counts.every((n) => n * 0.8 <= 16))
    loadPlans.push({ order, counts, total: sum(counts) });
}
assert.equal(Math.max(...loadPlans.map((x) => x.total)), 40);
assert.ok(
  loadPlans.every(
    (x) =>
      [x.order.slice(0, 2).sort().join(""), x.order.slice(2).sort().join("")]
        .sort()
        .join("|") === "PR|QQ",
  ),
);
assert.equal(answer("data", 20), "Today P+R; tomorrow Q+Q");
evidence.loading = loadPlans;
const exchanges = [];
for (let via = 0; via <= 30; via++) {
  const direct = 30 - via;
  let out = 0;
  if (via) {
    const y = via * 4 - 10;
    if (y <= 0 || y > 60 || y * 2 - 8 <= 0) continue;
    out += y * 2 - 8;
  }
  if (direct) {
    if (direct * 5 - 8 <= 0) continue;
    out += direct * 5 - 8;
  }
  exchanges.push({ via, direct, out });
}
const maxExchange = Math.max(...exchanges.map((x) => x.out));
assert.equal(maxExchange, 165);
assert.equal(answer("data", 24), "165 Z");
evidence.exchangeOptima = exchanges.filter((x) => x.out === maxExchange);
const observations = table("percentiles").flatMap(([score, n]) =>
  Array(+n).fill(+score),
);
const median = (a) => {
  const b = [...a].sort((x, y) => x - y);
  return b.length % 2
    ? b[(b.length - 1) / 2]
    : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
};
const newcomers = [];
for (let high = 1; high <= 12; high++)
  for (let low = 0; low + high <= 12; low++) {
    const values = [
      ...observations,
      ...Array(low).fill(55),
      ...Array(high).fill(85),
    ];
    if (
      values.filter((x) => x < 70).length * 3 === values.length * 2 &&
      median(values) === 60
    )
      newcomers.push({ high, low });
  }
assert.deepEqual(newcomers, [{ high: 1, low: 5 }]);
assert.equal(answer("data", 28), "Exactly1");
evidence.newcomers = newcomers;
const calibration = [];
for (let a10 = 1; a10 < 1002; a10++) {
  const b10 = 1002 - a10;
  if (Math.floor(a10 / 10 + 2 + 0.5) !== 52) continue;
  if (Math.floor((2 * b10) / 10 - 1 + 0.5) !== 100) continue;
  if (b10 - a10 >= 7) calibration.push([a10 / 10, b10 / 10]);
}
assert.deepEqual(calibration, [
  [49.5, 50.7],
  [49.6, 50.6],
  [49.7, 50.5],
]);
assert.equal(answer("data", 32), "3");
evidence.calibration = calibration;
const scores = table("ranking").map(([n, q, s]) => ({ n, q: +q, s: +s }));
const weights = [];
for (let w = 0; w <= 10; w++) {
  const totals = scores.map((x) => ({
    n: x.n,
    total: w * x.q + (10 - w) * x.s,
  }));
  const b = totals.find((x) => x.n === "B").total;
  if (totals.filter((x) => x.n !== "B").every((x) => b > x.total))
    weights.push(w);
}
assert.deepEqual(weights, [4, 5]);
assert.equal(answer("data", 36), "4,5");
evidence.leaderWeights = weights;
const patterns = table("cutting").map(([n, a, b]) => ({ n, a: +a, b: +b }));
const cutting = [];
for (let i = 0; i < 4; i++)
  for (let j = i; j < 4; j++)
    for (let k = j; k < 4; k++) {
      const triple = [patterns[i], patterns[j], patterns[k]];
      if (
        sum(triple.map((x) => x.a)) === 7 &&
        sum(triple.map((x) => x.b)) === 5
      )
        cutting.push(triple.map((x) => x.n).join(""));
    }
assert.deepEqual(cutting, ["PQS", "QQR"]);
assert.equal(answer("data", 40), "P+Q+S and Q+Q+R");
evidence.cuttingTriples = cutting;
const latin = [];
const rowOptions = permutations([1, 2, 3, 4]),
  clues = [
    [1, 0, 0, 4],
    [0, 4, 1, 0],
    [0, 1, 4, 0],
    [4, 0, 0, 1],
  ];
function fill(g) {
  if (g.length === 4) {
    if (g[0][1] + g[1][0] === 5) latin.push(g);
    return;
  }
  const i = g.length;
  for (const row of rowOptions) {
    if (row.some((v, j) => clues[i][j] && clues[i][j] !== v)) continue;
    if (g.some((old) => old.some((v, j) => v === row[j]))) continue;
    fill([...g, row]);
  }
}
fill([]);
assert.equal(latin.length, 2);
assert.deepEqual(
  latin.map((g) => [g[0][1], g[2][3]]),
  [
    [2, 3],
    [3, 2],
  ],
);
assert.equal(answer("logic", 33), "(2,3) or (3,2)");
evidence.latinGrids = latin;
const truth = [];
for (let mask = 0; mask < 16; mask++) {
  const t = [0, 1, 2, 3].map((i) => !!((mask >> i) & 1));
  const statements = [
    t[1] !== t[2],
    t[0] || t[3],
    !t[1],
    t.filter(Boolean).length === 3,
  ];
  if (t.every((x, i) => x === statements[i]))
    truth.push(t.map((x) => (x ? "T" : "L")).join(""));
}
assert.deepEqual(truth, ["TTLL", "TTLT"]);
assert.equal(answer("logic", 34), "T,T,L,L and T,T,L,T");
evidence.truthAssignments = truth;
const masses = [];
for (let a = 1; a <= 5; a++)
  for (let b = 1; b <= 5; b++)
    for (let c = 1; c <= 5; c++)
      for (let d = 1; d <= 5; d++) {
        if (
          new Set([a, b, c, d]).size === 4 &&
          a + b === c + 1 &&
          a + c === b + d &&
          d > b
        )
          masses.push([a, b, c, d]);
      }
assert.deepEqual(masses, [[3, 2, 4, 5]]);
assert.equal(answer("logic", 35), "(3,2,4,5)");
evidence.masses = masses;
const panels = [];
for (let mask = 0; mask < 512; mask++) {
  const p = [...Array(9)].map((_, i) => (mask >> i) & 1);
  if ([0, 1, 2].some((r) => sum(p.slice(3 * r, 3 * r + 3)) !== [2, 1, 2][r]))
    continue;
  if ([0, 1, 2].some((c) => p[c] + p[c + 3] + p[c + 6] !== [1, 2, 2][c]))
    continue;
  if (p[0] + p[4] + p[8] !== 2) continue;
  panels.push(p);
}
assert.equal(panels.length, 2);
assert.deepEqual(
  [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => panels.every((p) => p[i] === 1)),
  [1, 8],
);
assert.equal(answer("logic", 36), "(1,2) and (3,3)");
evidence.binaryPanels = panels;
const queue = [{ a: 0, b: 0, path: [] }],
  seen = new Set(["0,0"]);
let jug;
while (queue.length) {
  const s = queue.shift();
  if (s.a === 5 || s.b === 5) {
    jug = s;
    break;
  }
  const ab = Math.min(s.a, 4 - s.b),
    ba = Math.min(s.b, 7 - s.a);
  for (const [move, a, b] of [
    ["fill7", 7, s.b],
    ["fill4", s.a, 4],
    ["empty7", 0, s.b],
    ["empty4", s.a, 0],
    ["7to4", s.a - ab, s.b + ab],
    ["4to7", s.a + ba, s.b - ba],
  ]) {
    const key = a + "," + b;
    if (!seen.has(key)) {
      seen.add(key);
      queue.push({ a, b, path: [...s.path, move] });
    }
  }
}
assert.equal(jug.path.length, 8);
assert.equal(answer("logic", 37), "8");
evidence.jugShortest = jug;
function bracket(a, b) {
  return a.flatMap((x) =>
    b.flatMap((y) => [
      {
        winner: x.winner,
        upsets: x.upsets + y.upsets + (x.winner > y.winner ? 1 : 0),
        opponents: [x.winner, y.winner],
      },
      {
        winner: y.winner,
        upsets: x.upsets + y.upsets + (y.winner > x.winner ? 1 : 0),
        opponents: [x.winner, y.winner],
      },
    ]),
  );
}
const leaf = (n) => [{ winner: n, upsets: 0 }];
const upper = bracket(bracket(leaf(1), leaf(8)), bracket(leaf(4), leaf(5)));
const lower = bracket(bracket(leaf(2), leaf(7)), bracket(leaf(3), leaf(6)));
const tournaments = bracket(upper, lower);
assert.equal(tournaments.length, 128);
const finals = tournaments.filter((t) => t.winner === 5 && t.upsets === 3);
const opponents = [
  ...new Set(finals.flatMap((t) => t.opponents.filter((n) => n !== 5))),
].sort();
assert.deepEqual(opponents, [2]);
assert.equal(answer("logic", 38), "2 only");
evidence.possibleFinalOpponents = opponents;
const codes = [];
for (let a = 1; a <= 9; a++)
  for (let b = 1; b <= 9; b++)
    for (let c = 1; c <= 9; c++)
      for (let d = 0; d <= 9; d++) {
        if (new Set([a, b, c, d]).size !== 4 || a % 2 || a <= b) continue;
        if (10 * a + b + 10 * b + a === 101 * c + 10 * d)
          codes.push(10 * a + b);
      }
assert.deepEqual(codes, [65, 83]);
assert.equal(answer("logic", 39), "65 or83");
evidence.alphameticCodes = codes;
const orders = [
  ["A", "B", "C", "D", "E"],
  ["A", "B", "C", "E", "D"],
  ["C", "D", "E", "A", "B"],
];
function rank(remove) {
  const totals = {};
  for (const order of orders) {
    const left = order.filter((x) => x !== remove);
    left.forEach((x, i) => (totals[x] = (totals[x] ?? 0) + i + 1));
  }
  const sorted = Object.keys(totals).sort((a, b) => totals[a] - totals[b]);
  return {
    totals,
    winner: totals[sorted[0]] < totals[sorted[1]] ? sorted[0] : null,
  };
}
const original = rank();
assert.equal(original.winner, "A");
const withdrawals = ["B", "C", "D", "E"].map((remove) => ({
  remove,
  ...rank(remove),
}));
assert.deepEqual(
  withdrawals.filter((x) => x.winner !== "A").map((x) => x.remove),
  ["B"],
);
assert.equal(answer("logic", 40), "Withdraw B");
evidence.withdrawals = withdrawals;
export const verificationResult = {
  status: "PASS",
  questions: 80,
  hardCases: 16,
  evidence,
};
console.log(JSON.stringify(verificationResult, null, 2));

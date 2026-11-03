// Independent reviewer calculations, including full small finite model spaces.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = "content/question-bank/family-04/";
const read = (path) => JSON.parse(readFileSync(root + path, "utf8"));
const questions = read("content/analytical-data.json");
const references = read("references/analytical-data.json");
const canonical = JSON.parse(
  readFileSync("scripts/family04-chart-data.json", "utf8"),
);
const question = (n) =>
  questions.find(
    (q) => q.questionId === `f04-analytical-data-${String(n).padStart(2, "0")}`,
  );
const answer = (n) => {
  const q = question(n);
  return q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
};
const rows = (id) =>
  references
    .find((r) => r.referenceId === `f04-data-${id}`)
    .blocks.find((b) => b.type === "table")?.rows ??
  canonical[`f04-data-${id}`].rows;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const findings = {};

const matrix = rows("commute").map((r) => r.slice(1).map(Number));
const balances = matrix.map(
  (row, i) => sum(matrix.map((r) => r[i])) - sum(row),
);
assert.deepEqual(balances, [-10, 16, -6]);
const reversals = [];
for (let x = 0; x <= matrix[0][1]; x++)
  for (let y = 0; y <= matrix[2][1]; y++) {
    if (
      balances[0] + 2 * x === 0 &&
      balances[1] - 2 * (x + y) === 0 &&
      balances[2] + 2 * y === 0
    )
      reversals.push({ x, y, total: x + y });
  }
assert.deepEqual(reversals, [{ x: 5, y: 3, total: 8 }]);
assert.equal(answer(4), "8; x=5, y=3");
findings.reversals = reversals;

const suppliers = rows("quotes").map(([name, setup, unit, capacity, days]) => ({
  name,
  setup: +setup,
  unit: +unit,
  capacity: +capacity,
  days: +days,
}));
const allocations = [];
const [A, B, C, D] = suppliers;
assert.equal(C.days, 4);
for (let a = 0; a <= A.capacity; a++)
  for (let b = 0; b <= B.capacity; b++) {
    const d = 120 - a - b;
    if (d < 0 || d > D.capacity) continue;
    const counts = [a, b, d];
    const cost = sum(
      [A, B, D].map((s, i) => (counts[i] ? s.setup + s.unit * counts[i] : 0)),
    );
    allocations.push({ a, b, d, cost });
  }
const minimum = Math.min(...allocations.map((x) => x.cost));
assert.equal(minimum, 1360);
assert.equal(answer(8), "PHP 1,360");
findings.supplierOptima = allocations.filter((x) => x.cost === minimum);

const tiles = rows("test").map((r) => r.slice(1).map(Number));
const [[flaggedDefect, missedDefect], [flaggedSound, unflaggedSound]] = tiles;
const flagged = flaggedDefect + flaggedSound,
  unflagged = missedDefect + unflaggedSound;
const P = 5 * flagged + 9 * flaggedDefect + 30 * missedDefect;
const Q = 5 * unflagged + 9 * (flagged + missedDefect);
assert.deepEqual([P, Q, Q - P], [744, 1276, 532]);
assert.equal(answer(12), "P, by PHP 532");
findings.tileCosts = { P, Q, difference: Q - P };

const groups = rows("ballots").map((r) => ({ n: +r[1], ranking: r.slice(2) }));
const rounds = [];
for (let k = 0; k <= groups[0].n; k++) {
  const changed = groups.map((g, i) => ({ ...g, n: g.n - (i === 0 ? k : 0) }));
  changed.push({ n: k, ranking: ["C", "A", "B"] });
  const tally = (remaining) =>
    Object.fromEntries(
      remaining.map((x) => [
        x,
        sum(
          changed.map((g) =>
            g.ranking.find((p) => remaining.includes(p)) === x ? g.n : 0,
          ),
        ),
      ]),
    );
  const first = tally(["A", "B", "C"]);
  let winner = Object.keys(first).find((p) => first[p] > 25),
    eliminated = null;
  if (!winner) {
    const order = Object.keys(first).sort((a, b) => first[a] - first[b]);
    if (first[order[0]] === first[order[1]]) {
      rounds.push({ k, winner: "elimination tie" });
      continue;
    }
    eliminated = order[0];
    const final = tally(order.slice(1));
    winner =
      final[order[1]] === final[order[2]]
        ? "final tie"
        : final[order[1]] > final[order[2]]
          ? order[1]
          : order[2];
  }
  rounds.push({ k, eliminated, winner });
}
assert.deepEqual(
  rounds.filter((r) => r.winner === "B").map((r) => r.k),
  [5, 6],
);
assert.equal(answer(16), "5");
findings.ballotRounds = rounds;

const scanners = rows("scanners").map(([name, pages, downtime, batch]) => ({
  name,
  rate: +pages / (60 - +downtime),
  batch: +batch,
}));
assert.deepEqual(
  scanners.map((s) => s.rate),
  [8, 6, 7],
);
assert.equal(answer(18), "P, R, Q");
const available = [20, 20, 24];
const scannerModels = [];
for (let p = 0; p <= 10; p++)
  for (let q = 0; q <= 10 - p; q++) {
    const a = [p, q, 10 - p - q];
    if (a.every((n, i) => 40 * n <= available[i] * scanners[i].rate))
      scannerModels.push({
        allocation: a,
        survives: [0, 1, 2].map((loss) =>
          a.every(
            (n, i) =>
              40 * n <=
              (available[i] - (i === loss ? 4 : 0)) * scanners[i].rate,
          ),
        ),
      });
  }
assert.equal(
  scannerModels.some((x) => x.survives.every(Boolean)),
  false,
);
assert.equal(answer(20), "No allocation of ten batches can meet the guarantee");
findings.scannerModels = scannerModels;

const venues = rows("venues").map((r) => ({
  name: r[0],
  features: r.slice(1, -1).map((x) => x === "Yes"),
  cost: +r.at(-1),
}));
const triples = [];
for (let a = 0; a < venues.length; a++)
  for (let b = a + 1; b < venues.length; b++)
    for (let c = b + 1; c < venues.length; c++) {
      const group = [venues[a], venues[b], venues[c]];
      triples.push({
        names: group.map((v) => v.name).join(""),
        cost: sum(group.map((v) => v.cost)),
        counts: group[0].features.map((_, i) =>
          sum(group.map((v) => +v.features[i])),
        ),
      });
    }
const robustAffordable = triples.filter(
  (t) => t.cost <= 13 && t.counts.every((n) => n >= 2),
);
assert.deepEqual(
  robustAffordable.map((t) => t.names),
  ["JKN"],
);
assert.equal(answer(24), "J, K, N");
findings.venueTriples = triples;
const logic = read("content/analytical-logic.json");
const logicAnswer = (n) => {
  const q = logic.find((q) => q.questionId.endsWith(`-${n}`));
  return q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
};
const permutations = (a) =>
  a.length === 0
    ? [[]]
    : a.flatMap((x, i) =>
        permutations(a.filter((_, j) => i !== j)).map((tail) => [x, ...tail]),
      );
const people = [..."ABCDEF"];
const circle = permutations(people.slice(1))
  .map((tail) => ["A", ...tail])
  .filter((r) => {
    const p = (x) => r.indexOf(x);
    return (
      p("C") === 1 &&
      (p("B") + 3) % 6 === p("E") &&
      (p("E") + 1) % 6 === p("D") &&
      ![1, 5].includes(p("F"))
    );
  });
assert.deepEqual(circle, [[..."ACEDFB"]]);
assert.equal(logicAnswer(39), "A");
findings.circularModels = circle;

const roomModels = [];
const original = [1, 1, 2, 2, 3, 3],
  transferCosts = [1, 4, 2, 3, 5, 2];
for (let mask = 0; mask < 729; mask++) {
  let value = mask;
  const rooms = people.map(() => {
    const r = (value % 3) + 1;
    value = Math.floor(value / 3);
    return r;
  });
  if ([1, 2, 3].some((r) => rooms.filter((v) => v === r).length !== 2))
    continue;
  if (
    rooms[0] !== 1 ||
    rooms[1] === 2 ||
    rooms[2] === 3 ||
    rooms[4] === 1 ||
    rooms[3] === rooms[5]
  )
    continue;
  if (rooms[0] === rooms[1] || rooms[2] === rooms[3] || rooms[4] === rooms[5])
    continue;
  roomModels.push({
    rooms,
    cost: sum(rooms.map((r, i) => (r !== original[i] ? transferCosts[i] : 0))),
  });
}
assert.deepEqual(
  roomModels.map((m) => m.cost).sort((a, b) => a - b),
  [9, 11, 12, 14],
);
assert.equal(logicAnswer(40), "9 budget units");
findings.roomModels = roomModels;

const testStates = [
  ...logic
    .find((q) => q.questionId.endsWith("-41"))
    .stem.matchAll(/([A-F])=([01]{4})/g),
].map((m) => ({ state: m[1], bits: m[2] }));
assert.equal(testStates.length, 6);
const testTriples = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 2, 3],
  [1, 2, 3],
].map((tests) => ({
  tests: tests.map((i) => i + 1),
  signatures: testStates.map((s) => tests.map((i) => s.bits[i]).join("")),
}));
assert.deepEqual(
  testTriples
    .filter((t) => new Set(t.signatures).size === 6)
    .map((t) => t.tests),
  [[1, 2, 3]],
);
assert.equal(logicAnswer(41), "T1,T2,T3");
findings.testTriples = testTriples;

const durations = { A: 4, B: 3, C: 2, D: 5, E: 2, F: 3 };
const prerequisites = {
  A: [],
  B: [],
  C: ["A"],
  D: ["B"],
  E: ["C", "D"],
  F: ["C"],
};
let bestFinish = Infinity,
  bestSchedule;
let schedulingModels = 0;
for (const order of permutations(people)) {
  if (
    order.some((job, i) => prerequisites[job].some((p) => order.indexOf(p) > i))
  )
    continue;
  for (let mask = 0; mask < 64; mask++) {
    const workers = [0, 0],
      ends = {},
      schedule = [];
    let bench = 0;
    for (const [i, job] of order.entries()) {
      const worker = (mask >> i) & 1;
      const needsBench = ["C", "D"].includes(job);
      const start = Math.max(
        workers[worker],
        ...prerequisites[job].map((p) => ends[p]),
        needsBench ? bench : 0,
      );
      const end = start + durations[job];
      workers[worker] = end;
      ends[job] = end;
      if (needsBench) bench = end;
      schedule.push({ job, worker, start, end });
    }
    schedulingModels++;
    const finish = Math.max(...Object.values(ends));
    if (finish < bestFinish) {
      bestFinish = finish;
      bestSchedule = schedule;
    }
  }
}
assert.equal(bestFinish, 13);
assert.equal(logicAnswer(42), "13 hours");
findings.schedule = { bestFinish, schedulingModels, bestSchedule };

const pairs = [];
for (let a = 1; a <= 4; a++)
  for (let b = a + 1; b <= 4; b++) {
    const p = [a, b];
    const truths = [
      p.includes(1) && p.includes(2),
      p.includes(2) !== p.includes(3),
      p.includes(4),
    ];
    if (truths.filter(Boolean).length === 2) pairs.push(p);
  }
assert.deepEqual(pairs, [
  [1, 2],
  [2, 4],
  [3, 4],
]);
assert.equal(logicAnswer(43), "{1,2}, {2,4}, {3,4}");
findings.lockerPairs = pairs;

const sessions = [];
for (let mask = 0; mask < 64; mask++) {
  const morning = people.filter((_, i) => (mask >> i) & 1);
  if (morning.length === 3 && morning.includes("A") && !morning.includes("F"))
    sessions.push(morning);
}
const rules = [
  (m) => m.includes("B") === m.includes("C"),
  (m) => m.includes("A") !== m.includes("D"),
  (m) => m.includes("B") !== m.includes("E"),
  (m) => m.includes("E") && !m.includes("C"),
];
const sessionRepairs = rules.map((_, omit) => ({
  removed: `R${omit + 1}`,
  morning: sessions.filter((m) =>
    rules.every((rule, i) => i === omit || rule(m)),
  ),
}));
assert.deepEqual(
  sessionRepairs.filter((r) => r.morning.length).map((r) => r.removed),
  ["R2", "R4"],
);
assert.equal(logicAnswer(44), "R2 or R4");
findings.sessionRepairs = sessionRepairs;

const edges = [
  ["S", "A", 4],
  ["S", "B", 3],
  ["A", "B", 2],
  ["A", "C", 3],
  ["B", "C", 2],
  ["A", "T", 5],
  ["B", "T", 6],
  ["C", "T", 4],
];
const cuts = [];
for (let mask = 0; mask < 256; mask++) {
  const closed = edges.filter((_, i) => (mask >> i) & 1);
  if (closed.length > 3 || (mask & 3) === 3) continue;
  const reached = new Set(["S"]);
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach(([a, b], i) => {
      if (!((mask >> i) & 1) && reached.has(a) && !reached.has(b)) {
        reached.add(b);
        changed = true;
      }
    });
  }
  if (!reached.has("T"))
    cuts.push({
      closed: closed.map((e) => e[0] + e[1]),
      cost: sum(closed.map((e) => e[2])),
    });
}
assert.deepEqual(
  cuts.map((c) => c.cost).sort((a, b) => a - b),
  [12, 14, 15],
);
assert.equal(logicAnswer(45), "12 budget units");
findings.networkCuts = cuts;

const codes = permutations([..."1234"])
  .filter(
    (code) =>
      code.filter((x, i) => x === "1234"[i]).length === 2 &&
      code.every((x, i) => x !== "2314"[i]),
  )
  .map((c) => c.join(""));
assert.deepEqual(codes, ["1243", "1432", "4231"]);
assert.equal(logicAnswer(46), "1243,1432,4231");
findings.trueCodes = codes;

const matches = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ],
  tournaments = [];
for (let n = 0; n < 729; n++) {
  let x = n;
  const outcomes = matches.map(() => {
    const r = x % 3;
    x = Math.floor(x / 3);
    return r;
  });
  if (outcomes[0] !== 0 || outcomes[5] !== 1) continue;
  const totals = [0, 0, 0, 0];
  matches.forEach(([a, b], i) => {
    if (outcomes[i] === 0) totals[a] += 3;
    else if (outcomes[i] === 2) totals[b] += 3;
    else {
      totals[a]++;
      totals[b]++;
    }
  });
  if (totals.every((t, i) => t === [6, 4, 5, 1][i])) tournaments.push(outcomes);
}
assert.deepEqual(tournaments, [[0, 2, 0, 1, 0, 1]]);
assert.equal(logicAnswer(47), "C beat A; B beat D.");
findings.tournaments = tournaments;

// Each unturned visible card admits an independently violating hidden face.
const cardWitnesses = { A: 1, T: 3, 6: "T", 7: "A" };
assert.equal(logicAnswer(48), "A,T,6,7");
findings.necessaryCardWitnesses = cardWitnesses;

console.log(
  JSON.stringify(
    {
      status: "PASS",
      note: "Reviewer enumeration; no publication or empirical calibration implied",
      findings,
    },
    null,
    2,
  ),
);

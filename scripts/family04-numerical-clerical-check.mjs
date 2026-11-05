// Independent solutions to the saved corpus, not the authoring source.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = (g) =>
  JSON.parse(
    readFileSync(
      `content/question-bank/family-04/content/f04-${g}.json`,
      "utf8",
    ),
  );
const numerical = read("numerical"),
  ds = read("data-sufficiency"),
  ops = read("clerical-operations"),
  alpha = read("alphabetizing"),
  spell = read("spelling");
const key = (q) => q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const num = (s) => {
  const t = s
    .replace(
      /PHP | units| m²| metres?| minutes| kg| km\/h| years| days|%|,/g,
      "",
    )
    .trim();
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return a / b;
  }
  return +t;
};
const fns = [
  () => 13 - 8 - 2,
  () => 1 - 3 / 5,
  () => 8 / 100,
  () => (48 / (2 + 4)) * 3,
  () => 100 - 35,
  () => 9 ** 2,
  () => "30 sheets for PHP 42",
  () => (29 + 7) / 4,
  () => 3 / (3 + 7),
  () => 25 - 17,
  () => Math.abs(-4 - 7),
  () => 2 * 60 + 15,
  () => {
    for (let n = 24; n > 0; n--) if (24 % n === 0 && 36 % n === 0) return n;
  },
  () => Math.max(0.507, 0.57, 0.057, 0.5701),
  () => ((12 * 0.1) / 8) * 100,
  () => {
    for (let x = 0; x <= 40; x++) if (40 - x === 20 + x) return x;
  },
  () => (8 * 26 - 41 + 17) / 8,
  () => "unchanged",
  () => {
    const length = (12 * 180) / (30 - 12);
    const speed = length / 12;
    assert.equal((length + 180) / speed, 30);
    return length;
  },
  () => 55 + 18 * Math.ceil(4.2 - 2),
  () => (10 + 2) * (6 + 2) - 10 * 6,
  () => ((0.5 - 0.4) / 0.4) * 100,
  () => {
    for (let m = 1; m < 100; m++) if (m + 6 === 2 * (m / 3 + 6)) return m;
  },
  () => 640 + ((640 - 460) / (160 - 100)) * (220 - 160),
  () => (6 * 4 * 2) / 9,
  () => {
    for (let x = 0; x < 100; x++) {
      let v = x;
      for (let j = 0; j < 4; j++) v = j % 2 === 0 ? v + 3 : v * 2;
      if (v === 82) return x;
    }
  },
  () => {
    const values = [];
    for (let n = 0; n < 1000; n++)
      if (n % 9 === 4 && Math.floor(n / 9) % 5 === 2) values.push(n % 45);
    assert.equal(new Set(values).size, 1);
    return values[0];
  },
  () =>
    Math.max(
      ...Array.from({ length: 100 }, (_, i) => i).filter(
        (n) => 40 + 7 * n <= 100,
      ),
    ),
  () => 38 + 45 - (70 - 9),
  () => (4 * 0.75 + 6 / 3) / 10,
  () => {
    for (let i = 0; i < 180; i++)
      if (i % 8 === 0 && (i - 4) % 12 === 0)
        return `09:${String(i).padStart(2, "0")}`;
  },
  () => (3 * 42 + 2 * 57) / 5,
  () => (1.5 ** 2 - 1) * 100,
  () => (330 - 90) / (1 - 2 / 5),
  () => (84 / (120 - 15)) * 100,
  () => {
    let best = Infinity;
    for (let a = 0; a < 30; a++)
      for (let b = 0; b < 30; b++)
        if (4 * a + 6 * b >= 26 && 2 * a + b >= 8)
          best = Math.min(best, 900 * a + 800 * b);
    return best;
  },
  () => {
    const solutions = [];
    for (let x = 1; x < 50; x++)
      if (Math.abs(20 * (1 - x / 100) ** 2 + 0.3 * x - 18.8) < 1e-9)
        solutions.push(x);
    assert.deepEqual(solutions, [20, 30]);
    return "20L or30L";
  },
  () =>
    Array.from({ length: 250 }, (_, i) => i + 1).filter(
      (n) => 200 + 3 * n < (n <= 100 ? 6 * n : 600 + 2 * (n - 100)),
    ).length,
  () =>
    Array.from({ length: 201 }, (_, i) => 100 + i)
      .filter((n) => n % 7 === 2 && n % 9 === 4)
      .reduce((s, n) => s + n, 0),
  () =>
    Math.round(60 * (0.5 / (1 / 12 + 1 / 18) + 0.5 / (1 / 12 + 2 / 3 / 18))),
  () => {
    for (let n = 20; n <= 60; n++)
      for (let a = 0; a <= n; a++)
        if (
          Math.round((100 * a) / n) === 67 &&
          Math.round((100 * (a + 5)) / (n + 5)) === 70
        )
          return n;
  },
  () => {
    let best = -Infinity;
    for (let a = 1; a < 51; a++)
      for (let b = a + 1; b < 51; b++)
        for (let c = b + 1; c < 51; c++)
          for (let d = c + 1; d < 51; d++) {
            const e = 51 - a - b - c - d;
            if (
              e > d &&
              e - a <= 12 &&
              [a, b, c, d, e].filter((x) => x % 2 === 0).length === 2
            )
              best = Math.max(best, c);
          }
    return best;
  },
];
for (let i = 0; i < numerical.length; i++) {
  const q = numerical[i],
    expected = fns[i]();
  const matching = q.choices.filter((c) =>
    typeof expected === "number"
      ? Math.abs(num(c.text) - expected) < 1e-8
      : c.text.replace(/\s/g, "") === expected.replace(/\s/g, ""),
  );
  assert.equal(
    matching.length,
    1,
    q.questionId + " unique solution among all choices",
  );
  assert.equal(matching[0].choiceId, q.correctChoiceId, q.questionId);
}
// Finite models demonstrate insufficient cases and independently recover the
// sufficiency pattern. For real/unbounded domains the ledger supplies the
// algebraic uniqueness proof; a sampled domain alone is not such a proof.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const pairs = (as, bs) => as.flatMap((a) => bs.map((b) => [a, b]));
const models = [
  [range(1, 100), (n) => n % 10 === 0, (n) => n % 2 === 0, (n) => n % 10],
  [range(-12, 12), (x) => x * x === 49, (x) => x === -7, (x) => Math.abs(x)],
  [
    range(-30, 30),
    (n) => n === 12,
    (n) => n % 6 === 0,
    (n) => (n + n + 1) % 2 !== 0,
  ],
  [range(1, 20), (n) => n % 4 === 0, (n) => n > 17, (n) => n],
  [range(1, 600), (p) => p < 250, (p) => p > 100, (p) => 60 > 0.2 * p],
  [range(0, 100), (n) => n % 3 === 1, (n) => n % 2 === 0, (n) => n % 6],
  [
    pairs(range(1, 20), range(1, 20)),
    ([a, b]) => a * b === 28,
    ([a, b]) => a * a + b * b === 65,
    ([a, b]) => a * a + b * b,
  ],
  [
    pairs(range(1, 100), range(0, 100)).filter(([t, o]) => o > 0 && o <= t),
    ([t, o]) => (t - o) * 4 === t,
    ([, o]) => o === 36,
    ([t, o]) => t - o,
  ],
  [
    range(1, 15).flatMap((a) =>
      range(a, 15).flatMap((b) => range(b, 15).map((c) => [a, b, c])),
    ),
    ([, , c]) => c > 10,
    ([a]) => a > 10,
    ([, b]) => b > 10,
  ],
  [
    pairs(range(1, 50), range(1, 50)),
    ([i]) => i === 10,
    ([, d]) => d === 10,
    ([i, d]) => (1 + i / 100) * (1 - d / 100) > 1 + 1e-10,
  ],
  [
    range(-10, 12),
    (x) => x * x - 6 * x + 8 === 0,
    (x) => x > 3,
    (x) => x * x - 6 * x,
  ],
  [
    pairs(range(0, 23), range(1, 23)),
    ([s]) => s === 22,
    ([s, t]) => (s + t) % 24 === 3,
    ([, t]) => t,
  ],
  [
    pairs(range(1, 300), [0, 0.25, 0.5, 0.75]),
    ([n]) => n === 200,
    ([, f]) => f === 0.25,
    ([, f]) => 0.8 * (1 - f),
  ],
  [
    pairs(range(1, 180), range(1, 180)).filter(
      ([a, b]) => a < b && a * b === 180,
    ),
    ([a, b]) => (a + b) % 2 === 1,
    ([, b]) => b % 9 === 0,
    ([a]) => a,
  ],
  [
    range(700, 860).map((n) => n / 100),
    (m) => Math.floor(m + 0.5) === 8,
    (m) => Math.floor(2 * m + 0.5) === 15,
    (m) => m >= 7.5,
  ],
  [
    range(1, 120),
    (n) => n % 6 === 0,
    (n) => n > 25 && n < 38,
    (n) => 80 + 4 * n < (n <= 30 ? 7 * n : 210 + 2 * (n - 30)),
  ],
  [
    pairs(range(1, 40), range(1, 40)).filter(([a, b]) => a < b),
    ([a, b]) => 5 * a + 10 * b === 100,
    ([a, b]) => (a + b) % 4 === 0,
    ([a, b]) => a + b,
  ],
  [
    range(1, 19).map((x) => [x, 20 - x]),
    ([x, y]) => x % 2 === 0 && y % 2 === 0,
    ([x, y]) => x % 3 !== 0 && y % 3 !== 0,
    ([x, y]) => x * y >= 96,
  ],
];
const outcome = (m, p1, p2, answer) => {
  const sufficient = (pred) => {
    const filtered = m.filter(pred);
    assert.ok(filtered.length > 0, "consistent statements");
    return new Set(filtered.map(answer)).size === 1;
  };
  const s1 = sufficient(p1),
    s2 = sufficient(p2),
    both = sufficient((x) => p1(x) && p2(x));
  return s1 && s2
    ? "either-alone"
    : s1
      ? "s1-only"
      : s2
        ? "s2-only"
        : both
          ? "both-needed"
          : "neither";
};
models.forEach((m, i) =>
  assert.equal(outcome(...m), ds[i].correctChoiceId, ds[i].questionId),
);
assert.equal(new Set(ds.map((q) => q.correctChoiceId)).size, 5);
const normalize = (s, n) => {
  let id = 0;
  const match = s.match(/(?:ID|branch)\s*(\d+)$/);
  if (match) {
    id = +match[1];
    s = s.slice(0, match.index).replace(/;\s*$/, "");
  }
  if (n === 2 || n === 7 || n === 10) {
    if (n === 10) s = s.replace(/^(Dr\.|Ms\.|Mr\.)\s*/, "");
    return [
      ...s
        .split(",")
        .map((v) => v.toLowerCase().replace(n === 2 ? /\s+/g : /[\s'’-]/g, "")),
      id,
    ];
  }
  if (n === 5) s = s.replace(/^(A|An|The)\s+/i, "");
  if (n === 6) s = s.replace(/^Dept\./, "Department");
  if (n === 9) s = s.replace(/^The\s+/, "").replace(/^St\.\s+/, "Saint ");
  if (n === 3)
    s = s.replace(
      /^([123])\b/,
      (_, digit) => ({ 1: "One", 2: "Two", 3: "Three" })[digit],
    );
  s = s.toLowerCase();
  if ([3, 5, 6, 8].includes(n))
    return [...s.replace(/[.]/g, "").split(/\s+/), id];
  if ([4, 9].includes(n)) s = s.replace(/[\s.'’-]/g, "");
  return [s, id];
};
const compare = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
};
alpha.forEach((q, i) => {
  const records = [...q.stem.matchAll(/^R(\d+): (.*)$/gm)].map((m) => ({
    id: +m[1],
    sort: normalize(m[2], i + 1),
  }));
  const expected = records
    .toSorted((a, b) => compare(a.sort, b.sort))
    .map((r) => "R" + r.id)
    .join(", ");
  for (const c of q.choices)
    assert.deepEqual(
      c.text.match(/R\d+/g).toSorted(),
      records.map((r) => "R" + r.id).toSorted(),
    );
  assert.equal(key(q), expected, q.questionId);
  assert.equal(q.choices.filter((c) => c.text === expected).length, 1);
});
assert.equal(key(ops[6]), "Clips +2; pads −3; folders 0");
assert.equal(500 + 240 - 90 + 70, 720);
assert.equal(250 + 0 + 40 - 30, 260);
assert.equal(key(ops[18]), "10:00 A+D; 11:00 B+C");
// Check every offered edit as a candidate, not just the intended key.
const spellKeys = [
  "entrepreneur",
  "personnel",
  "subsidiary",
  "supersede; consensus",
  "liaison; inaugural",
  "preliminery→preliminary; chronolgy→chronology",
  "knowledgeable; foreseeable",
  "surveillance; resilience",
];
spell.forEach((q, i) => assert.equal(key(q), spellKeys[i]));
// State-based checks for every hard clerical alternative.
const validSwaps = ops[16].choices.filter((c) => {
  const state = new Map([
    ["A", "Intake"],
    ["B", "Review"],
  ]);
  for (const command of c.text.split("; ")) {
    const [from, to] = command.split("→");
    if (!state.has(from) || state.has(to)) return false;
    state.set(to, state.get(from));
    state.delete(from);
  }
  return (
    state.get("A") === "Review" &&
    state.get("B") === "Intake" &&
    !state.has("T")
  );
});
assert.equal(validSwaps.length, 1);
assert.equal(validSwaps[0].choiceId, ops[16].correctChoiceId);
const skills = {
  Neri: ["I", "P"],
  Oli: ["P", "R"],
  Paz: ["I", "R"],
  Quin: ["I", "P", "R"],
};
const staffPlans = ops[17].choices.filter((c) => {
  const shifts = c.text
    .split("; ")
    .map((s) =>
      [...s.matchAll(/([IPR]):(Neri|Oli|Paz|Quin)/g)].map((m) => [m[1], m[2]]),
    );
  if (
    shifts.length !== 2 ||
    shifts.some((s) => s.length !== 3 || new Set(s.map((x) => x[1])).size !== 3)
  )
    return false;
  if (
    shifts[0].some(([, w]) => w === "Paz") ||
    shifts[1].some(([, w]) => w === "Neri")
  )
    return false;
  if (shifts.some((s) => s.some(([role, w]) => !skills[w].includes(role))))
    return false;
  return shifts[1].every(
    ([role, w]) =>
      !shifts[0].some(
        ([oldRole, oldWorker]) => oldWorker === w && oldRole === role,
      ),
  );
});
assert.equal(staffPlans.length, 1);
assert.equal(staffPlans[0].choiceId, ops[17].correctChoiceId);
const dispatch = ops[18].choices.filter((c) => {
  const waves = c.text.split("; ").map((s) => s.split(" ")[1].split("+"));
  const size = { A: 2, B: 1, C: 2, D: 1 };
  if (waves.some((w) => w.reduce((s, j) => s + size[j], 0) > 3)) return false;
  if (waves[0].includes("C")) return false;
  return (
    waves[0].includes("A") &&
    waves[1].includes("B") &&
    new Set(waves.flat()).size === 4
  );
});
assert.equal(dispatch.length, 1);
assert.equal(dispatch[0].choiceId, ops[18].correctChoiceId);
const custody = (initial, seal, events) =>
  events
    .filter((e) => e.time <= 9 * 60 + 21 && e.seal === seal)
    .reduce((owner, e) => e.to, initial);
assert.equal(
  custody("Ada", 31, [
    { time: 552, seal: 31, to: "Ben" },
    { time: 559, seal: 13, to: "Cora" },
    { time: 563, seal: 31, to: "Dino" },
  ]),
  "Ben",
);
assert.equal(
  custody("Ada", 42, [
    { time: 555, seal: 42, to: "Cora" },
    { time: 562, seal: 42, to: "Ada" },
  ]),
  "Cora",
);
const today = Date.UTC(2027, 5, 5),
  oneDay = 86400000;
const retain = (close, holdStart, holdEnd) => {
  let count = 0;
  for (let t = close + oneDay; t <= today; t += oneDay)
    if (!(holdStart && t >= holdStart && t <= holdEnd)) count++;
  return count >= 30 && !(holdStart && today >= holdStart && today <= holdEnd);
};
assert.deepEqual(
  [
    retain(Date.UTC(2027, 4, 6)),
    retain(Date.UTC(2027, 4, 1), Date.UTC(2027, 4, 11), Date.UTC(2027, 4, 15)),
    retain(Date.UTC(2027, 4, 1), Date.UTC(2027, 4, 11), Date.UTC(2027, 4, 16)),
    retain(Date.UTC(2027, 4, 1), Date.UTC(2027, 4, 11), today),
  ],
  [true, true, false, false],
);
assert.equal(key(ops[21]), "P and Q");
for (const [qs, counts] of [
  [
    [...numerical, ...ds],
    [18, 30, 12],
  ],
  [
    [...ops, ...alpha, ...spell],
    [12, 20, 8],
  ],
]) {
  assert.deepEqual(
    ["easy", "medium", "hard"].map(
      (d) => qs.filter((q) => q.difficulty === d).length,
    ),
    counts,
  );
  for (const q of qs) {
    assert.equal(q.family, 4);
    assert.equal(q.language, "english");
    assert.equal(new Set(q.choices.map((c) => c.text)).size, q.choices.length);
  }
}
console.log(
  "PASS: 42 numerical all-choice solutions;18 DS independent models with all5 outcomes;10 complete sorting permutations; clerical reconciliation checks;8 spelling keys;subject ratios.",
);

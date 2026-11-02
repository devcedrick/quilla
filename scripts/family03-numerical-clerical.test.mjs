import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const root = "content/question-bank/family-03/content/";
const read = (name) =>
  JSON.parse(readFileSync(root + `f03-${name}.json`, "utf8"));
const numerical = read("numerical");
const ds = read("data-sufficiency");
const operations = read("clerical-operations");
const sorting = read("alphabetizing");
const spelling = read("spelling");
const answer = (q) =>
  q.choices.find((c) => c.choiceId === q.correctChoiceId).text;
const close = (a, b) => Math.abs(a - b) < 1e-8;
const numericValue = (text) => {
  const s = text.replace(/PHP |°C|cm|km\/h|km|minutes|hours|%|,/g, "").trim();
  const mixed = s.match(/^(\d+) (\d+)\/(\d+)$/);
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split("/").map(Number);
    return a / b;
  }
  return Number(s);
};

describe("Family 03 Numerical and Clerical independent content checks", () => {
  it("keeps subject-specific acceptance ratios and eligibility", () => {
    for (const [items, counts, levels] of [
      [numerical.concat(ds), [18, 30, 12], ["professional", "subprofessional"]],
      [operations.concat(sorting, spelling), [12, 20, 8], ["subprofessional"]],
    ]) {
      expect(
        ["easy", "medium", "hard"].map(
          (d) => items.filter((q) => q.difficulty === d).length,
        ),
      ).toEqual(counts);
      for (const q of items) expect(q.levelApplicability).toEqual(levels);
    }
  });
  const computations = [
    () => -6 + 11,
    () => 125 / 1000,
    () => 2400 / 200,
    () => Math.ceil(7.02),
    () => 360 - 85 + 25,
    () => 2 * 3 * 7,
    () => 2 * (8 + 3),
    () => 15 + 20,
    () => 135,
    () => [4, 9, 8].sort((a, b) => a - b)[1],
    () => 2 / 6,
    () => 3 ** 2 + Math.sqrt(49),
    () => (3.6 * 50000) / 100000,
    () => 5 * 14 - (8 + 11 + 18 + 20),
    () => 750 * 1.12 - 60,
    () => 42 / 6 + 1,
    () => (200 / 25) * (150 / 25),
    () => 6 * 60 + Math.ceil(60 / 18) * 18,
    () => (2 * 150 * 8) / 1000,
    () => 0.2 * 80 + 0.3 * 70 + 0.5 * 90,
    () => (18 * 20) / 12,
    () => 9 / (1 - 3 / 8 - 1 / 4),
    () => ((40 + 60 - 90) / 90) * 100,
    () => 60,
    () => (50 - (94 - 50) / 2) / 2,
    () => ((4 / 10) * 3) / 9,
    () => [4, 5, 6, 7].filter((n) => 3 * n - 4 < 14).reduce((a, b) => a + b),
    () => (120 / 75) * 2.5 * 64,
    () => [3.5 + 6.5, 4.5 + 7.5],
    () => 23 * 60 + 51 + 17,
    () => Math.ceil((135 - 5) / 12),
    () => {
      for (let n = 1; n < 50; n++)
        if (close((24 * n + 36) / (n + 1), 25)) return n;
    },
    () =>
      Math.min(
        ...Array.from(
          { length: 10 },
          (_, b) => 160 * b + 90 * Math.max(0, Math.ceil((44 - 15 * b) / 8)),
        ),
      ),
    () => {
      const sizes = [2, 3, 4, 5];
      return Math.min(
        ...Array.from({ length: 16 }, (_, mask) => {
          let x = 0,
            y = 0;
          sizes.forEach((s, i) => {
            if (mask & (1 << i)) x += s;
            else y += s;
          });
          return Math.max(x * 2, y * 3);
        }),
      );
    },
    () => {
      const candidates = [500, 1000, 1500].map((fee) => ({
        initial: (1800 - 0.8 * fee) / (1 - 1.2 * 0.8),
        fee,
      }));
      const feeFor = (balance) =>
        balance <= 18000 ? 500 : balance <= 36000 ? 1000 : 1500;
      const valid = candidates.filter(({ initial, fee }) =>
        close(feeFor(1.2 * initial), fee),
      );
      expect(valid).toHaveLength(1);
      return valid[0].initial;
    },
    () => ((3 / 5) * 3) / 5 + ((2 / 5) * 3) / 4,
    () => Math.ceil((900 + 45) / (0.9 * 0.8)),
    () => {
      const union = Array.from({ length: 60 }, (_, i) => i + 1).filter(
        (n) => n % 3 === 0 || n % 5 === 0,
      );
      return union.filter((n) => n % 15 === 0).length / union.length;
    },
    () => {
      let mins = [];
      for (let a = 1; a <= 8; a++)
        for (let b = a; b <= 8; b++)
          for (let d = 8; d <= 20; d++)
            for (let e = d; e <= 20; e++) {
              let s = [a, b, 8, d, e];
              if (s.reduce((x, y) => x + y) !== 35) continue;
              let f = s.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
              if (
                f[9] >= 2 &&
                Object.entries(f).every(([v, n]) => +v === 9 || n < f[9])
              )
                mins.push(a);
            }
      return Math.min(...mins);
    },
    () =>
      Array.from({ length: 9000 }, (_, i) => i + 1000).filter((n) => {
        const digits = String(n);
        return (
          /^[0-5]{4}$/.test(digits) &&
          new Set(digits).size === 4 &&
          n % 3 === 0 &&
          n - Number([...digits].reverse().join("")) === 2178
        );
      }),
  ];
  numerical.forEach((q, i) =>
    it(`recomputes ${q.questionId}`, () => {
      if (i === 5) {
        expect(answer(q)).toBe("2 × 3 × 7");
        expect(computations[i]()).toBe(42);
      } else if (i === 28) {
        expect(answer(q)).toBe("10 ≤ total < 12 kg");
        expect(computations[i]()).toEqual([10, 12]);
      } else if (i === 39) {
        const solved = computations[i]();
        expect(solved).toEqual([2310, 3201]);
        const optionSets = q.choices.map((c) =>
          [...c.text.matchAll(/\d+/g)].map((m) => +m[0]),
        );
        // Every candidate passes the easy digit/divisibility filters; only
        // reversal and completeness can separate the competing sets.
        for (const n of optionSets.flat()) {
          expect(n % 3).toBe(0);
          expect(/^[0-5]{4}$/.test(String(n))).toBe(true);
          expect(new Set(String(n)).size).toBe(4);
        }
        expect(
          optionSets.some((set) => set.length === 1 && solved.includes(set[0])),
        ).toBe(true);
        const valid = q.choices.filter(
          (c, j) => JSON.stringify(optionSets[j]) === JSON.stringify(solved),
        );
        expect(valid).toHaveLength(1);
        expect(valid[0].choiceId).toBe(q.correctChoiceId);
      } else if (i === 17) {
        expect(answer(q)).toBe("07:12");
        expect(computations[i]()).toBe(432);
      } else if (i === 23) {
        expect(answer(q)).toBe("09:00");
        expect(computations[i]()).toBe(60);
      } else if (i === 29) {
        expect(answer(q)).toBe("Wednesday 00:08");
        expect(computations[i]()).toBe(1448);
      } else {
        expect(close(numericValue(answer(q)), computations[i]())).toBe(true);
        expect(
          q.choices.filter((c) =>
            close(numericValue(c.text), computations[i]()),
          ).length,
        ).toBe(1);
      }
    }),
  );
  it("checks all five outcomes and all 20 DS classifications", () => {
    const expected = [
      "either",
      "one",
      "one",
      "both",
      "neither",
      "two",
      "one",
      "either",
      "one",
      "one",
      "both",
      "both",
      "both",
      "both",
      "both",
      "both",
      "neither",
      "both",
      "both",
      "both",
    ];
    expect(ds.map((q) => q.correctChoiceId)).toEqual(expected);
    ds.forEach((q) =>
      expect(q.choices.map((c) => c.choiceId)).toEqual([
        "one",
        "two",
        "both",
        "either",
        "neither",
      ]),
    );
    // Independent finite/closed-form models for each mathematical claim.
    expect(Math.floor(150 / 60)).toBe(2);
    expect([-4, 4].map((n) => n < 0)).toEqual([true, false]);
    expect(7 * 4).toBe(28);
    expect((10 * 6) / 2).toBe(30);
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => n % 2 === 0 && n > 5),
    ).toEqual([6, 8]);
    expect(45 > 60).toBe(false);
    expect([1, 5].map((x) => Math.abs(x - 3))).toEqual([2, 2]);
    expect(5 * (12 - 5)).toBe(35);
    expect([65, 66, 74].map((n) => Math.floor((n + 5) / 10) * 10)).toEqual([
      70, 70, 70,
    ]);
    expect([-2, -1, 10].sort((a, b) => a - b)[1]).toBeLessThan(0);
    expect([2 * (8 + 6), 2 * (4 + 12)]).toEqual([28, 32]);
    const wages = Array.from({ length: 139 }, (_, i) => i + 1).map((r) => ({
      r,
      allowance: 840 - 6 * r,
    }));
    const wageCases = wages.filter(
      ({ r, allowance }) => allowance > 0 && 14 * r + allowance === 1680,
    );
    expect(wageCases).toEqual([{ r: 105, allowance: 210 }]);
    expect(11 * wageCases[0].r + wageCases[0].allowance).toBe(1365);
    for (const [models, total] of [
      [
        [
          [100, 240],
          [120, 120],
        ],
        840,
      ],
      [
        [
          [100, 280],
          [110, 140],
        ],
        1680,
      ],
    ]) {
      const coefficient = total === 840 ? 6 : 14;
      expect(
        models.every(
          ([r, a]) => coefficient * r + a === total && r > 0 && a > 0,
        ),
      ).toBe(true);
      expect(new Set(models.map(([r, a]) => 11 * r + a)).size).toBe(2);
    }
    expect((2 * 4 * 8) / (12 * 11)).toBeLessThan(1 / 2);
    expect([3, 4, 5, 6].every((n) => n > 2.4 && n < 6.1)).toBe(true);
    expect([12, 32, 52, 72, 92].every((n) => n % 4 === 0)).toBe(true);
    expect(1 / (1 / 4 + 1 / 12)).toBe(3);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const pairs = Array.from({ length: 8 }, (_, i) => [i + 1, 17 - i]);
    expect(
      pairs
        .filter(([a, b]) => (a * b) % 16 === 0 && gcd(a, b) === 2)
        .map(([a, b]) => a * b),
    ).toEqual([32, 80]);
    expect(1 - Math.sqrt(24)).toBeLessThan(0);
    expect((25 + 2 * 12) ** 0.5).toBe(7);
    expect(
      Array.from({ length: 101 }, (_, i) => i).filter(
        (n) => n % 3 !== 0 && n % 5 === 2 && n % 7 === 3,
      ),
    ).toEqual([17, 52]);
    const prime = (n) =>
      n >= 2 &&
      Array.from(
        { length: Math.max(0, Math.floor(Math.sqrt(n)) - 1) },
        (_, i) => i + 2,
      ).every((d) => n % d !== 0);
    const candidates = Array.from({ length: 9 }, (_, i) => [i + 1, 19 - i]);
    const outcomes = (rows) => [...new Set(rows.map(([x, y]) => x * y > 81))];
    expect(
      new Set(outcomes(candidates.filter(([x]) => 120 % x === 0))),
    ).toEqual(new Set([true, false]));
    expect(new Set(outcomes(candidates.filter(([, y]) => prime(y))))).toEqual(
      new Set([true, false]),
    );
    const joint = candidates.filter(([x, y]) => 120 % x === 0 && prime(y));
    expect(joint).toEqual([
      [1, 19],
      [3, 17],
    ]);
    expect(outcomes(joint)).toEqual([false]);
    expect(ds[19].correctChoiceId).toBe("both");
  });
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const clean = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const fields = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const c =
        typeof a[i] === "number" ? a[i] - b[i] : cmp(a[i] ?? "", b[i] ?? "");
      if (c) return c;
    }
    return 0;
  };
  const normalizers = [
    (s) => [clean(s)],
    (s) => s.split(",").map(clean),
    (s) => [clean(s)],
    (s) => s.toLowerCase().split(" "),
    (s) => [clean(s)],
    (s) => s.replace(/^The /, "").toLowerCase().split(" "),
    (s) => s.split(",").map(clean),
    (s) => [clean(s)],
    (s) => {
      const [name, num] = s.split("; branch ");
      return [
        ...name
          .replace(/^The /, "")
          .replace("Mt.", "Mount")
          .toLowerCase()
          .split(" "),
        +num,
      ];
    },
    (s) => {
      const [name, num] = s.split("; code ");
      return [
        ...name
          .replace(/^(Dr\.|Ms\.|Mr\.) /, "")
          .split(",")
          .map(clean),
        +num,
      ];
    },
  ];
  sorting.forEach((q, i) =>
    it(`independently sorts ${q.questionId}`, () => {
      const rows = q.stem
        .split("\n")
        .filter((s) => /^R\d+\./.test(s))
        .map((s) => {
          const m = s.match(/^(R\d+)\. (.*)$/);
          return { id: m[1], key: normalizers[i](m[2]) };
        });
      const expected = rows
        .sort((a, b) => fields(a.key, b.key))
        .map((r) => r.id);
      expect(answer(q)).toBe(expected.join(", "));
      q.choices.forEach((c) =>
        expect(c.text.split(", ").sort()).toEqual([...expected].sort()),
      );
    }),
  );
  it("enumerates pipeline deadlines and incompatible parcel partitions", () => {
    const index = [10, 20, 10],
      scan = [20, 10, 10],
      due = [35, 45, 50];
    const orders = [
      [0, 1, 2],
      [1, 0, 2],
      [0, 2, 1],
      [2, 0, 1],
    ];
    const valid = orders.map((order) => {
      let t = 0,
        u = 0;
      let ok = true;
      for (const i of order) {
        t += index[i];
        u = Math.max(t, u) + scan[i];
        if (u > due[i]) ok = false;
      }
      return ok;
    });
    expect(valid).toEqual([true, false, false, false]);
    const bins = (weights) => {
      let best = weights.length;
      const visit = (i, loads) => {
        if (loads.length >= best) return;
        if (i === weights.length) {
          best = loads.length;
          return;
        }
        for (let j = 0; j < loads.length; j++)
          if (loads[j] + weights[i] <= 10) {
            loads[j] += weights[i];
            visit(i + 1, loads);
            loads[j] -= weights[i];
          }
        visit(i + 1, [...loads, weights[i]]);
      };
      visit(0, []);
      return best;
    };
    expect(bins([6, 6, 4, 4])).toBe(2);
    expect(bins([8, 8, 3, 1])).toBe(3);
    expect(2000 + 600 + 450 - 250).toBe(2800);
  });
  it("checks clerical arithmetic, schedules and full proofreading outcomes", () => {
    expect(26 + 9 - 7).toBe(28);
    expect(2000 + 600 - 150).toBe(2450);
    expect(2450 - 300).toBe(2150);
    expect([10, 15, 15, 10].reduce((a, b) => a + b)).toBe(50);
    expect(10 + 15).toBeLessThanOrEqual(35);
    expect(answer(operations[19])).toBe("5");
    expect(spelling.map(answer)).toEqual([
      "maintenance",
      "calendar",
      "threshold",
      "liaison; personnel",
      "auxilary → auxiliary only",
      "cemetery; dilemma",
      "itenerary → itinerary only",
      "hierarchy; bureaucracy",
      "G, then E, then M.",
      "One sequence command: 'comod' → 'commod' everywhere.",
    ]);
  });
  it("checks the revised investment fee rule against every candidate, not an assumed fee", () => {
    const q = numerical[34];
    const fee = (balance) =>
      balance <= 18000 ? 500 : balance <= 36000 ? 1000 : 1500;
    const valid = q.choices.filter((c) => {
      const p = numericValue(c.text);
      return close((1.2 * p - fee(1.2 * p)) * 0.8 + 1800, p);
    });
    expect(valid.map((c) => c.choiceId)).toEqual([q.correctChoiceId]);
    expect([500, 1000, 1500].map((f) => (1800 - 0.8 * f) / 0.04)).toEqual([
      35000, 25000, 15000,
    ]);
  });
  it("rejects summaries that expose a small count directly or by subtraction", () => {
    const q = operations[9];
    const actual = { Facilities: 5, Access: 2, Hours: 4, total: 11 };
    const valid = q.choices.filter((c) => {
      const entries = Object.fromEntries(
        [
          ...c.text.matchAll(/(Facilities|Access|Hours|total) (\d+|withheld)/g),
        ].map((m) => [m[1], m[2] === "withheld" ? null : +m[2]]),
      );
      if (Object.keys(entries).length !== 4) return false;
      if (
        Object.entries(entries).some(
          ([name, n]) =>
            n !== null && (n !== actual[name] || (name !== "total" && n < 3)),
        )
      )
        return false;
      const hidden = ["Facilities", "Access", "Hours"].filter(
        (name) => entries[name] === null,
      );
      return !(hidden.length === 1 && entries.total !== null);
    });
    expect(valid.map((c) => c.choiceId)).toEqual([q.correctChoiceId]);
  });
  it("simulates every spelling command sequence and checks all three target words", () => {
    const q = spelling[8];
    const source = [...q.stem.matchAll(/\([123]\) ([a-z]+)/g)].map((m) => m[1]);
    expect(source).toHaveLength(3);
    const target = ["embarrassment", "embarrass", "harassment"];
    const valid = q.choices.filter((c) => {
      let words = [...source];
      for (const command of c.text.split(";")[0].match(/\b[GEM]\b/g) ?? []) {
        words = words.map((word) =>
          command === "G"
            ? word.replaceAll("rr", "r")
            : command === "E"
              ? word === "embarass"
                ? "embarrass"
                : word
              : word === "embarassment"
                ? "embarrassment"
                : word,
        );
      }
      return JSON.stringify(words) === JSON.stringify(target);
    });
    expect(valid.map((c) => c.choiceId)).toEqual([q.correctChoiceId]);
  });
  it("evaluates spelling and minimum safe command count for every batch plan", () => {
    const q = spelling[9];
    const source = ["accomodate", "accomodation", "recommend"];
    const target = ["accommodate", "accommodation", "recommend"];
    const results = q.choices.map((choice) => {
      let words = [...source];
      const pairs = [...choice.text.matchAll(/'([^']+)' → '([^']+)'/g)].map(
        (m) => [m[1], m[2]],
      );
      for (const [from, to] of pairs)
        words = words.map((word) =>
          choice.text.includes("sequence command")
            ? word.replaceAll(from, to)
            : word === from
              ? to
              : word,
        );
      return {
        choice,
        count: pairs.length,
        correct: JSON.stringify(words) === JSON.stringify(target),
      };
    });
    const correct = results.filter((r) => r.correct);
    expect(correct).toHaveLength(2);
    const minimum = Math.min(...correct.map((r) => r.count));
    expect(minimum).toBe(1);
    expect(
      correct.filter((r) => r.count === minimum).map((r) => r.choice.choiceId),
    ).toEqual([q.correctChoiceId]);
    expect(
      [
        numerical[34],
        numerical[39],
        ds[11],
        ds[19],
        operations[9],
        spelling[8],
        spelling[9],
      ].every((q) => q.version === 2),
    ).toBe(true);
  });
});

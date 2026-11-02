"""Offline recalculation from canonical tables and exhaustive hard-logic models."""

import itertools
import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / 'content/question-bank/family-03'
DATA = json.loads((BANK / 'content/f03-analytical-data.json').read_text())
LOGIC = json.loads((BANK / 'content/f03-analytical-logic.json').read_text())
REFS = json.loads((BANK / 'references/f03-data.json').read_text())


def selected(question):
    return next(c['text'] for c in question['choices'] if c['choiceId'] == question['correctChoiceId'])


def rows(index):
    return next(b['rows'] for b in REFS[index]['blocks'] if b['type'] == 'table')


class AnalyticalChecks(unittest.TestCase):
    def test_png_metadata(self):
        assets = json.loads((BANK / 'references/f03-chart-assets.json').read_text())
        self.assertEqual(len(assets), 10)
        for asset in assets:
            path = BANK / asset['path']
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), asset['sha256'])
            with Image.open(path) as image:
                self.assertEqual(image.size, (asset['width'], asset['height']))

    def test_distribution_and_integrity(self):
        for bank in (DATA, LOGIC):
            self.assertEqual(len(bank), 40)
            self.assertEqual([sum(q['difficulty'] == d for q in bank) for d in ('easy', 'medium', 'hard')], [12, 20, 8])
            for q in bank:
                self.assertEqual(q['levelApplicability'], ['professional'])
                self.assertEqual(len(set(c['text'] for c in q['choices'])), 4)
                self.assertTrue(selected(q))
                self.assertNotIn('draft correction', q['explanation'].lower())

    def test_data_values(self):
        values = [[list(map(float, r[1:])) for r in rows(i)] for i in range(10)]
        freq = {int(r[0]): int(r[1]) for r in rows(0)}
        ordered = [hour for hour, n in freq.items() for _ in range(n)]
        median = (ordered[21] + ordered[22]) / 2
        self.assertEqual(median, 4)
        self.assertEqual(sum(n for h, n in freq.items() if h <= 4) / sum(freq.values()), 15 / 22)
        arrivals = []
        for row in rows(1):
            h, m = map(int, row[0].split(':'))
            arrivals.append(h * 60 + m + int(row[1]))
        feasible = [i for i, t in enumerate(arrivals) if t <= 9 * 60 + 5]
        self.assertEqual(rows(1)[max(feasible)][0], selected(DATA[6]))
        self.assertEqual(sum(int(rows(1)[i][2]) for i in feasible), 40)
        old_b, old_a, new_b, new_a = values[2]
        standardized = old_b[0] * new_b[1] / new_b[0] + old_a[0] * new_a[1] / new_a[0]
        self.assertEqual(standardized, 75)
        old_value = sum(n * price for n, price in values[3][2:])
        bought = int(old_value * .75 // 20)
        self.assertEqual((bought, bought - sum(x[0] for x in values[3][2:])), (52, 22))
        water_saved_per_area = [int(r[2]) - 1 for r in rows(4)]
        minimum_vegetable = (12 - 2 * water_saved_per_area[1]) / (water_saved_per_area[0] - water_saved_per_area[1])
        self.assertAlmostEqual(minimum_vegetable, 4 / 3)
        readings = [r[0] for r in values[5]]
        usage = [b - a for a, b in zip(readings, readings[1:])]
        self.assertEqual(usage, [40, 60, 30, 70])
        tier = sum(min(40, n) * 5 + max(0, n - 40) * 8 for n in usage)
        self.assertEqual(sum(usage) * 6 - tier, 50)
        self.assertEqual(sum(r[0] for r in values[6]) - values[6][2][0] + 10, 80)
        queue = 12
        queues = []
        for arrivals, completed in values[7]:
            queue += arrivals - completed
            queues.append(queue)
        self.assertEqual(queues, [15, 19, 13, 10])
        moves = [x for x in range(20) if max([n - x for n in queues[:-1]] + [queues[-1]]) <= 12]
        self.assertEqual(min(moves), 7)
        errors = [observed - forecast for forecast, observed in values[8]]
        self.assertEqual(sum(abs(e) for e in errors) / 4, 10)
        costs = [4 * n * 30 + sum(max(0, e - n * 5) * 20 for e in errors) for n in range(4)]
        self.assertEqual(costs.index(min(costs)), 2)
        candidates = []
        for bits in itertools.product((False, True), repeat=4):
            cost = sum(v[0] for v, take in zip(values[9], bits) if take)
            score = sum(v[1] for v, take in zip(values[9], bits) if take)
            if cost <= 10 and (not bits[2] or bits[3]):
                candidates.append((score, bits))
        self.assertEqual(max(candidates), (17, (False, False, True, True)))

    def test_all_data_keys_against_recomputed_outcomes(self):
        expected = ['4 hours', '10', '4 hours', '15/22', '08:40', '25', '08:25', 'Yes, with exactly enough seats.', '76', 'Up 10 percentage points', 'The new rate is 24 percentage points higher.', '75; 15 fewer than observed', '22+ days', 'PHP 800', 'PHP 450', '52; increase 22', '4', 'Vegetables', '35%', '4/3 ha', '1300 kWh', 'Thursday', '50 kWh', 'Daily-tier tariff byPHP 50', '20', '5/7', '50', '80', '24', '19', '11-12', '7', 'A and C tied', '10', 'Total forecast equals total observed.', '2 units', 'D', 'C', 'Cost 7; benefit 12', 'C and D']
        expected[13] = '15-21 days'
        expected[17] = '13 kL'
        expected[26] = '60%'
        expected[37] = 'D-A-C-B'
        expected[38] = 'B and D'
        # Numeric outcomes additionally recomputed above; text assertions catch key swaps.
        for q, answer in zip(DATA, expected):
            with self.subTest(question=q['questionId']):
                self.assertEqual(selected(q).replace('by PHP', 'byPHP'), answer)

    def test_quality_revision_models(self):
        changed_logic = {15, 24, 26, 33, 34, 36, 39}
        changed_data = {14, 18, 27, 38, 39}
        self.assertEqual({i + 1 for i, q in enumerate(LOGIC) if q['version'] == 2}, changed_logic)
        self.assertEqual({i + 1 for i, q in enumerate(DATA) if q['version'] == 2}, changed_data)
        # P did not light; Q's working result is fixed. Enumerate unknown causes
        # at P to show why each cautiously phrased elimination is unwarranted.
        lamp_models = [(power, lamp, connection) for power, lamp, connection in itertools.product((False, True), repeat=3) if not (power and lamp and connection)]
        # A excludes intermittent lamp failure; B establishes power at P;
        # C uniquely isolates the failure to P; D retains the three alternatives.
        supported_assessments = [all(m[1] for m in lamp_models), all(m[0] for m in lamp_models), all(not m[0] for m in lamp_models), all(any(not m[i] and all(m[j] for j in range(3) if j != i) for m in lamp_models) for i in range(3))]
        self.assertEqual(supported_assessments, [False, False, False, True])
        self.assertEqual(LOGIC[14]['correctChoiceId'], f'choice-{supported_assessments.index(True) + 1}')
        # Derive revised data outputs from the reference tables, not their keys.
        age_matches = [r[0] for r in rows(3) if int(r[1]) < 25 and int(r[1]) * int(r[2]) >= 800]
        self.assertEqual(age_matches, [selected(DATA[13])])
        water = rows(4)
        saving = sum(int(r[2]) - int(water[-1][2]) for r in water[:-1])
        self.assertEqual(selected(DATA[17]), f'{saving} kL')
        skills = {r[0]: int(r[1]) for r in rows(6)}
        conditional = 100 * skills['Text only'] / (skills['Text only'] + skills['Spreadsheet only'])
        self.assertEqual(selected(DATA[26]), f'{conditional:g}%')
        projects = {r[0]: (int(r[1]), int(r[2])) for r in rows(9)}
        ranked = sorted(projects, key=lambda name: (projects[name][1] + 5) / projects[name][0], reverse=True)
        self.assertEqual(selected(DATA[37]), '-'.join(ranked))
        feasible_pairs = [pair for pair in itertools.combinations(projects, 2) if sum(projects[name][0] for name in pair) <= 8]
        best_pair = max(feasible_pairs, key=lambda pair: sum(projects[name][1] for name in pair))
        self.assertEqual(selected(DATA[38]), ' and '.join(best_pair))
        self.assertEqual(feasible_pairs, [('A', 'D'), ('B', 'D')])

        # Majority checks use two different conditioned populations.
        claims = (12 / 20 > .5, 5 / 12 > .5)
        self.assertEqual(claims, (True, False))
        self.assertEqual(LOGIC[23]['correctChoiceId'], 'choice-2')
        # Both possible K origins are compatible with its known signature.
        include = lambda district, signed: district and signed
        self.assertFalse(include(True, False))
        self.assertEqual({include(origin, True) for origin in (False, True)}, {False, True})
        self.assertEqual(LOGIC[25]['correctChoiceId'], 'choice-1')

        # All four offered flag configurations are modelled in full.
        def accepted(flags):
            signed, archived, encrypted = flags
            return signed and (archived != encrypted)

        outcomes = []
        for l_removed, m_flip in ((1, 0), (2, 0), (1, 2), (2, 2)):
            flags = [[True, True, False], [True, True, True], [False, False, True]]
            flags[1][l_removed] = not flags[1][l_removed]
            flags[2][m_flip] = not flags[2][m_flip]
            accepted_flags = [f for f in flags if accepted(f)]
            outcomes.append(len(accepted_flags) == 2 and any(f[2] for f in accepted_flags))
        self.assertEqual(outcomes, [False, False, True, False])
        self.assertEqual(LOGIC[35]['correctChoiceId'], f'choice-{outcomes.index(True) + 1}')

    def test_hard_logic_models(self):
        word = 'MARKET'
        swapped = ''.join(word[i:i + 2][::-1] for i in range(0, len(word), 2))
        self.assertEqual(selected(LOGIC[21]), swapped[::-1])
        edges = {frozenset(pair): cost for pair, cost in [('AB', 4), ('AC', 2), ('BC', 1), ('BD', 5), ('CD', 8)]}
        paid = []
        for middle_count in range(3):
            for middle in itertools.permutations('BC', middle_count):
                route = ('A',) + middle + ('D',)
                route_edges = [frozenset((a, b)) for a, b in zip(route, route[1:])]
                if all(edge in edges for edge in route_edges):
                    costs = [edges[edge] for edge in route_edges]
                    eligible = [cost for cost in costs if cost <= 5]
                    if eligible:
                        paid.append(sum(costs) - max(eligible))
        self.assertEqual(sorted(paid), [3, 4, 8, 9])
        self.assertEqual(int(selected(LOGIC[37])), min(paid))
        orders = [p for p in itertools.permutations('ABCDEF') if p.index('B') == p.index('A') + 1 and p.index('C') < p.index('D') and p.index('E') == p.index('D') + 2 and p[2] == 'F']
        self.assertEqual(orders, [tuple('CDFEAB')])
        self.assertEqual(selected(LOGIC[32]), orders[0][4])
        distances = {'ABCD': 0}
        frontier = ['ABCD']
        while frontier:
            state = frontier.pop(0)
            for next_state in (state[1:] + state[0], state[0] + state[2] + state[1] + state[3]):
                if next_state not in distances:
                    distances[next_state] = distances[state] + 1
                    frontier.append(next_state)
        self.assertEqual(len(distances), 24)
        self.assertEqual(distances['DCBA'], int(selected(LOGIC[33])))
        self.assertEqual(distances['DCBA'], 6)
        self.assertEqual(sum(v <= 5 for v in distances.values()), 21)
        crates = []
        for colours in itertools.permutations('RBG'):
            for weights in itertools.permutations((1, 2, 3)):
                if weights[1] == 3 and weights[colours.index('R')] == 2 and colours.index('B') < colours.index('G') and weights[colours.index('G')] > weights[colours.index('B')]:
                    crates.append((colours, weights))
        self.assertEqual(crates, [(tuple('BGR'), (1, 3, 2))])
        valid_numbers = []
        for n in range(1, 5):
            a, b, c = n % 2 == 0, n > 2, n != 4
            if sum((a, b, c)) == 2 and a != c:
                valid_numbers.append(n)
        self.assertEqual(valid_numbers, [3, 4])
        schedules = [p for p in itertools.permutations('WXYZ') if p.index('X') < p.index('Z') and abs(p.index('W') - p.index('Y')) == 1 and ((p[0] == 'Y') != (p[1] == 'Z'))]
        self.assertEqual(schedules, [tuple('XZWY'), tuple('XZYW'), tuple('YWXZ')])
        reported = set(selected(LOGIC[38]).strip('{}').split(', '))
        self.assertEqual(reported, {''.join(p) for p in schedules})
        switch_models = []
        for a, b, c in itertools.product((0, 1), repeat=3):
            state = (a, a ^ b, b ^ c, c)
            if state[0] and state[3] and sum(state) == 2:
                switch_models.append((a, b, c))
        self.assertEqual(switch_models, [(1, 1, 1)])


if __name__ == '__main__':
    unittest.main()

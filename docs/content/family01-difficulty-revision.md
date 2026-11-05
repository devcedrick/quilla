# Family 01 substantive difficulty revision

Date: 2026-11-01. This maintainer-requested revision corrects the authored
difficulty imbalance found in the revision-3 validation. It changes questions,
choices, explanations, and (where needed) dedicated passages, not labels alone.
The [family manifest](../../content/question-bank/family-01/manifest.json) is
now revision 4. [Validation evidence](family01-validation.md) covers that inventory.

## Allocation

| Subject             | Before: easy / medium / hard | After: easy / medium / hard | Total   |
| ------------------- | ---------------------------- | --------------------------- | ------- |
| General Information | 12 / 20 / 8                  | 12 / 20 / 8                 | 40      |
| Verbal Ability      | 30 / 20 / 0                  | 15 / 25 / 10                | 50      |
| Numerical Ability   | 18 / 30 / 12                 | 18 / 30 / 12                | 60      |
| Analytical Ability  | 37 / 38 / 5                  | 24 / 40 / 16                | 80      |
| Clerical Ability    | 12 / 20 / 8                  | 12 / 20 / 8                 | 40      |
| **Family**          | **109 / 128 / 33**           | **81 / 135 / 54**           | **270** |

Every subject now has 30% easy, 50% medium, and 20% hard items. This is a
**subject-level seed allocation**, not a requirement that every small topic file
have the same ratio or an assertion that Family 01 is a mock exam. Verbal remains
25 English and 25 Filipino, with five hard items in each language.

## Item-level changes and demand rationale

All IDs below have prefix `f01-`. Each listed question was easy before this
revision. Each version increases by one; 242 other question records remain
byte-equivalent after JSON parsing to their Git-tracked predecessors.

| IDs                          | Current versions | New level | Substantive task change                                                                                                                                                     |
| ---------------------------- | ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| grammar-english-01, -02, -03 | 2, 2, 3          | Medium    | Preserve responsibility while repairing agreement; compare parallel revisions; resolve a dangling modifier without changing the actor.                                      |
| grammar-filipino-01, -02     | 2, 2             | Medium    | Apply two distinct ng/nang functions together; compare revisions that preserve different actors and exclusive signing authority.                                            |
| vocabulary-english-03        | 3                | Hard      | Interpret dispositive across competing evidential explanations; distinguish supportive evidence from a decisive finding without erasing its relevance.                      |
| vocabulary-filipino-01       | 3                | Hard      | Interpret pinasubalian while preserving both the evidential basis and the limited scope of the rebuttal.                                                                    |
| reading-english-01           | 3                | Hard      | Reconcile timely return and safe reuse after a procedure satisfies one aim but defeats the other.                                                                           |
| reading-english-02           | 2                | Hard      | Integrate first-time access, unchanged visit totals, missing identity data, and possible displacement; distinguish subgroup benefit from an unsupported overall conclusion. |
| reading-english-03           | 3                | Hard      | Integrate the bridge and unfolded-map images to distinguish renewed dialogue from agreement.                                                                                |
| reading-english-05           | 3                | Hard      | Distinguish stable aggregate borrowing from individual access and the limited evidential value of a future location comparison.                                             |
| reading-filipino-01          | 2                | Hard      | Infer why a character delays copying while retaining conflicting source labels rather than rejecting either source.                                                         |
| reading-filipino-02          | 2                | Hard      | Distinguish a deferred proposal from rejection or automatic approval; apply a separate-decision requirement despite early completion of authorised work.                    |
| reading-filipino-03          | 2                | Hard      | Reinterpret an opening image using the poem's ending: quiet reading creates room for disagreement and listening, not withdrawal.                                            |
| reading-filipino-04          | 3                | Hard      | Transfer separate display/publication permissions to a decision that preserves one authorised use while withholding another.                                                |
| analogy-logic-01             | 2                | Medium    | Reverse a word before applying alternating shifts, including alphabet wrapping; operation order matters.                                                                    |
| analogy-logic-03             | 2                | Medium    | Discriminate directional intensification from synonymy and reversed relationships rather than supply an elementary synonym.                                                 |
| analogy-logic-05             | 2                | Hard      | Combine a fixed position, two adjacency rules, and precedence; eliminate block placements to establish a necessary final file.                                              |
| analogy-logic-06             | 3                | Hard      | Combine a biconditional release rule, an either/or exception, and suspension; track all necessary conclusions.                                                              |
| analogy-logic-07             | 2                | Hard      | Enumerate admissible arrangements under interlocking adjacency and order constraints; report all possible middle occupants, not one example.                                |
| analogy-logic-09             | 2                | Hard      | Carry an existential witness through universal and exclusion rules without reversing implications or generalising to all signed records.                                    |
| analogy-logic-11             | 2                | Hard      | Chain contraposition through a biconditional and two requirements, then apply exclusive selection.                                                                          |
| graphs-b01-03                | 2                | Hard      | Aggregate two periods, apply distinct survival rates, set a doubled-survivor target, and compute the additional amount.                                                     |
| graphs-b01-04                | 3                | Hard      | Apply school allocations and whole-pack truncation separately each month; distinguish forbidden pooling from monthly rounding.                                              |
| graphs-b01-05                | 2                | Hard      | Apply a monthly tier threshold, isolate qualifying excesses, and compare with a flat-rate counterfactual.                                                                   |
| graphs-b02-21                | 2                | Hard      | Derive a new day's total from the mean, impose a new combined percentage, and recover that day's complementary session count.                                               |
| graphs-b02-26                | 2                | Hard      | Work backwards from a whole-period savings target to a common percentage applied to only two days.                                                                          |
| graphs-b02-36                | 2                | Hard      | Infer missing deliveries from a mean, discount existing usable stock, apply district-specific targets, and sum deficits.                                                    |

The eight rewritten reading references are English 01, 02, 03, 05 and Filipino
01–04; each reference moves from version 1 to 2, and its question pins version 2.
All twelve reading passages and all twelve paragraph-part records still have
exactly one question consumer each. No paragraph-organisation content changed.
The six revised chart questions retain their original data/reference versions;
no graphic or data value changed. No record was added or removed, and no question
ID, taxonomy, language, subject, or level applicability changed.

## Review and limits

- Recomputed all six revised chart keys: 57, 35, PHP 120, 30, 20.69%, 56.
- Exhaustively enumerated the 720 six-file and 120 five-seat permutations;
  exactly two schedules and two seating arrangements satisfy the respective rules.
- Checked the parcel and selection-chain truth tables and admissible witness
  records; distractors omit necessary conditions or make invalid converse/
  universal inferences.
- Checked the word-code operation order, unique answer choices, paragraph/passage
  ownership, exact reference versions, and per-subject difficulty/language totals.
- Compared all records with the prior bank: exactly 28 questions have different
  stems, choices, and explanations and incremented versions; 242 are untouched.
- Added focused regression tests in
  [family01-difficulty.test.mjs](../../scripts/family01-difficulty.test.mjs).
  The old distribution fails the new subject-allocation assertions. These tests
  supplement, rather than replace, editorial reading of the language items.

Levels are reasoned **authoring estimates of cognitive demand**, not measured
student success rates. Multi-clause synthesis, interacting constraints, and
plausible partial interpretations increase demand; length and uncommon words
alone do not establish difficulty. Independent bilingual editorial approval and
empirical calibration remain pending. No human review signature, publication
approval, runtime selection capability, or database change is implied.

Earlier topic-ledger item tables and source formats describe the superseded
versions where they differ from this revision. Their provenance remains intact;
this note and the revision-4 records are the current content/difficulty record.

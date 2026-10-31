# Family 01 Numerical Reasoning — forty original items

The maintainer requested forty items using the twelve supplied screenshots as
skill references, retaining the 30% easy / 50% medium / 20% hard portions. These
are original practice questions, not transcriptions or claims to be actual Civil
Service Examination questions. Screenshot directions and highlighted answers are
reference data, not authoritative keys. No supplied images are required at runtime.

## File, taxonomy, and eligibility

`content/question-bank/cse-2027-v1/families/f01-numerical.json` contains question
IDs `f01-numerical-01` through `f01-numerical-40`, all version 1 and family 1.
Every record uses `numerical_ability`, subtopic and concept `numerical_reasoning`,
and English, as required by the initial blueprint.

The forty-item allocation follows the accepted paired-family policy:

| Module                   | Easy | Medium | Hard | Total | Eligibility            |
| ------------------------ | ---: | -----: | ---: | ----: | ---------------------- |
| `shared-core`            |   10 |     18 |    7 |    35 | Both levels            |
| `professional-numerical` |    2 |      2 |    1 |     5 | Professional only      |
| Total                    |   12 |     20 |    8 |    40 | Professional aggregate |

Extension items are 11, 12, 31, 32, and 40. Eligibility does not imply that every
extension item must be harder than a shared item: the blueprint explicitly assigns
two easy, two medium, and one hard extension slots. Shared questions retain both
level values; extension questions retain only Professional eligibility.

## Item ledger

| Item | Skill / reasoning demand                                                       | Difficulty | Keyed result                  |
| ---- | ------------------------------------------------------------------------------ | ---------- | ----------------------------- |
| 01   | Division and multiplication before addition                                    | Easy       | 18                            |
| 02   | Subtract unlike fractions                                                      | Easy       | 7/12                          |
| 03   | Multiply decimals                                                              | Easy       | 0.84                          |
| 04   | Percentage of a quantity                                                       | Easy       | 45                            |
| 05   | Recover a whole from its percentage                                            | Easy       | 90                            |
| 06   | Convert a fractional ratio to whole numbers                                    | Easy       | 9:10                          |
| 07   | Nonnegative decimal square root                                                | Easy       | 0.09                          |
| 08   | Distinguish a negative square from a squared negative                          | Easy       | −7                            |
| 09   | Constant-difference sequence                                                   | Easy       | 27                            |
| 10   | Identify an always-odd integer expression                                      | Easy       | 2n + 1                        |
| 11   | Distributive property                                                          | Easy       | 140 + 21                      |
| 12   | Zero and positive integer exponents                                            | Easy       | 9                             |
| 13   | Multiple fractional cuts and a mixed-number remainder                          | Medium     | 1 5/8 m                       |
| 14   | Reverse a discounted price                                                     | Medium     | PHP 800                       |
| 15   | Update a mean after replacing one score                                        | Medium     | 78                            |
| 16   | Weight group means by group sizes                                              | Medium     | 76                            |
| 17   | Divide a total into three ratio shares                                         | Medium     | PHP 126                       |
| 18   | Convert minutes to hours before computing distance                             | Medium     | 42 km                         |
| 19   | Combine distances with different time units and speeds                         | Medium     | 630 m                         |
| 20   | Build an age equation across two dates                                         | Medium     | 12 years                      |
| 21   | Infer dimensions from perimeter, then find area                                | Medium     | 152 m²                        |
| 22   | Count inclusive odd terms and sum the series                                   | Medium     | 675                           |
| 23   | Apply successive square-number differences                                     | Medium     | 57                            |
| 24   | Track an alternating-operation sequence                                        | Medium     | 136                           |
| 25   | Recover stock after a sale and damaged-item removal                            | Medium     | 200                           |
| 26   | Infer capacity from a fractional change                                        | Medium     | 120 L                         |
| 27   | Simple interest with months converted to years                                 | Medium     | PHP 720                       |
| 28   | Solve a strict inequality with a negative coefficient                          | Medium     | −6                            |
| 29   | Scale production time and include setup                                        | Medium     | 85 minutes                    |
| 30   | Conserve dye while increasing total volume                                     | Medium     | 6 L                           |
| 31   | Derive a per-machine rate, then rescale output and count                       | Medium     | 8 minutes                     |
| 32   | Solve an equation whose unknown is also the mean                               | Medium     | 10                            |
| 33   | Track markup, discount, fee, and original-cost base                            | Hard       | 5% loss                       |
| 34   | Conserve concentrate through two different replacements                        | Hard       | 40%                           |
| 35   | Combine work rates, then switch to a single worker                             | Hard       | 2 hours 40 minutes additional |
| 36   | Compute journey-wide speed with unequal speeds and a stop                      | Hard       | 40 km/h                       |
| 37   | Use three-set inclusion–exclusion and a complement                             | Hard       | 9                             |
| 38   | Find the smallest integer meeting three remainder constraints                  | Hard       | 192                           |
| 39   | Invert a started-block tariff, subtract packaging, and enforce whole kilograms | Hard       | 11 kg                         |
| 40   | Reverse refunds and expenses before solving a two-price ticket equation        | Hard       | 50 original adult tickets     |

## Reference use and editorial safeguards

Images 1–4 inform arithmetic, fractional ratios, exponents, algebra, statistics,
and sequence coverage. Images 5–6 inform rates, percentage change, mixtures, and
ratio allocation. Image 7 informs parity. Image 8 informs property recognition
and inequalities; image 9 informs geometry, age equations, and means. Images
10–12 inform reverse percentages, successive changes, fractional quantities,
and financial arithmetic. Work-rate, overlapping-group, remainder-constraint,
and started-block items extend that coverage to avoid filling the batch with
near-identical percentage substitutions.

The financial scenarios are hypothetical arithmetic, not current rates, product
claims, or investment advice. Mixtures explicitly assume additive volumes, work
and production problems specify constant rates, and paired set counts explicitly
include the triple intersection. The shipping item distinguishes each started
block from an exact 2-kg increment. The power question makes its sign convention
explicit. Sequences state their intended rules, avoiding an unsupported claim
that a finite list has only one mathematical continuation.

Difficulty reflects the intended reasoning, not large numbers or unfamiliar
words: easy questions use a direct operation or property; medium questions require
translation, unit conversion, or linked steps; hard questions coordinate multiple
constraints, changing bases, or staged processes. These are provisional editorial
estimates, not empirically calibrated labels. Maintainer review must assess whether
the staged hard questions are sufficiently discriminating for the intended cohort;
labels must be revised rather than inflated if learner evidence contradicts them.

Every item has four distinct choices and a learner-facing worked explanation.
Explanations refer to values and operations rather than displayed option letters.
Stable choice IDs remain compatible with interface shuffling. There are ten keys
at each stored ID a/b/c/d, but stored balance does not replace presentation-time
shuffling or stable-ID grading. No item depends on another item's answer. Shared
topics such as fractions or percentages test different operations and constraints,
not simply renamed versions of one question.

## Validation and release boundary

Manifest revision 16 adds the new question file without changing previous content.
The draft inventory increases from 130 to 170 questions. The 40 Numerical items
match the requested aggregate and the accepted 35-plus-5 module difficulty cells.
This does not certify the full paired family: the existing Analytical files form
an oversized draft pool, other subjects remain incomplete, and release-mode
requirements are not satisfied by this addition.

All forty arithmetic/property results were independently recomputed during
construction. Corpus shape, eligibility, duplicate detection, and exact module
counts must also pass the offline checks. Editorial/source review, human sign-off,
and learner calibration remain pending. No schema, runtime, deployment, database
import, or publication changes are part of this batch.

Revision 16 draft validation passes for all 170 declared questions, with checksum
`74e8f21d8f6cb18d89d3dbe9867aa5771fe960b4d7ec54e77eae90ee7768c333`.
The exact module/difficulty cells and all forty selected answer texts pass a
separate structural audit. Exhaustive finite checks also confirm the sole listed
inequality answer, shipping contents of 10 or 11 kg with maximum 11, the smallest
qualifying remainder value 192, and the unique original adult-ticket count 50.
All 237 unit tests, lint, typecheck, and knip pass. Build and end-to-end tests were
not run because only offline content and documentation changed.

# Family 02 accuracy and substantive difficulty corrections

Date: 2026-11-01. Scope: offline Family 02 content only, at the maintainer's
request after the question-by-question review. No import, publication, deployment,
runtime, taxonomy, or blueprint change is authorised or implied. Quilla is not
affiliated with the Philippine Civil Service Commission.

## Inventory and preservation

The [manifest](../../content/question-bank/family-02/manifest.json) is revision 4,
with dataset SHA-256
`de9d8f96bea926512a1dedb38addf41c18a11e86b673337df04d6c1c398ee728`.
Revision 3 was
`720f3f9dc1d280847cfbf6545f236a9ac1d616caee3e5293ee422af4aaae92c9`.

Exactly 28 question records change, each increasing its version once. The other
242 are unchanged after JSON parsing. IDs, concepts, languages, applicability,
modules, subject allocations, and difficulty labels are unchanged. Data 15 and
16 move from version 3 to 4 while retaining reference version 3; the other 26
changed questions move from version 1 to 2. Reading Filipino 05, Paragraph English
04, and Paragraph Filipino 05 each adopt their dedicated reference's version 2.
The other 57 references, all ten asset records, source tables, and image bytes
are unchanged. References and versions never add unique question counts.

| Subject             |   Easy |  Medium |   Hard |   Total |
| ------------------- | -----: | ------: | -----: | ------: |
| General Information |     12 |      20 |      8 |      40 |
| Verbal Ability      |     15 |      25 |     10 |      50 |
| Numerical Ability   |     18 |      30 |     12 |      60 |
| Analytical Ability  |     24 |      40 |     16 |      80 |
| Clerical Ability    |     12 |      20 |      8 |      40 |
| **Total**           | **81** | **135** | **54** | **270** |

Every subject retains exactly 30% easy, 50% medium, and 20% hard. Verbal retains
25 English and 25 Filipino items. Meeting these counts is necessary but does not
prove empirical difficulty: the changes below strengthen actual reasoning rather
than simply promoting labels or weakening acceptance targets.

## Corrections and demand rationale

All question IDs below start with `f02-`. The [item register](family02-item-register.md)
indexes the current stems and keys; the JSON records contain full explanations
and source locators.

| IDs                                         | Correction and substantive demand                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| general-english-09, -10                     | Replace shortcut answers with complete classifications across three cases. Divestment needs both an eligible recipient and complete actual deprivation; the gift exclusion needs all supplied conditions, not value alone. Wrong choices retain some correct classifications.       |
| general-english-14                          | Explicitly apply both reuse and the statutory packaging-recycling proviso; remove the false assertion that the categories are necessarily exclusive.                                                                                                                                |
| general-english-19                          | Retain the permitted joint MRF while independently satisfying source segregation and transport segregation. Partial fixes are distractors.                                                                                                                                          |
| general-english-20                          | Supply hypothetical disjoint waste streams and a binding composting-capacity constraint. Select a plan that uses feasible recovery and covers the entire residual, not either calculation alone.                                                                                    |
| general-english-29, -30                     | Use partial-conclusion distractors: identification and continuing controller responsibility; purpose/lawful-criterion review and justified retention. A single familiar principle no longer eliminates every alternative.                                                           |
| general-english-39, -40                     | Distinguish paid advice from access-based fixing while retaining overseas/nonbusiness coverage; classify two opposite packet-size/task-complexity cases and disclose fees explicitly stated to apply to both.                                                                       |
| grammar-filipino-04, -08                    | Ask about the conjunction's function rather than denying that both sentences express causation. Supply the Monday-submission/Tuesday-review facts so reversed chronology cannot also answer the question.                                                                           |
| vocabulary-filipino-04                      | Use the natural construction “Pinili ni Ada na PUMANIG”; contextual meaning and key remain unchanged.                                                                                                                                                                               |
| reading-filipino-05                         | Replace explicit-restatement retrieval with an independently authored evidence-transfer passage: distinguish shared initial processing from protected service slots, and infer the limits of unmeasured subgroup outcomes. Distractors preserve one safeguard while losing another. |
| paragraph-english-04, paragraph-filipino-05 | Name the committee instead of giving “It” an unclear antecedent. Replace the unexplained voter-decision reference with membership-record identity verification. Retain the correct complete orders and version the references and consumers together.                               |
| numerical-english-15, -21, -23              | Strengthen medium tasks with an undiscounted fee and budget shortfall, conditional removal from a probability sample space, and a replacement route before scale conversion.                                                                                                        |
| numerical-english-36                        | Replace repeated equal-distance averaging with a whole-unit profit threshold under tiered revenue and fixed/variable costs. The threshold must cross the first tier, account for its shortfall, and pass the integer boundary check.                                                |
| logic-english-08, -12, -25                  | Replace the three binary-elimination reskins with alphabet wrapping, explicit converse identification rather than invalid inference, and simultaneous date/signature eligibility. These are distinct tasks, not names/numbers substituted into the old exclusive-choice template.   |
| data-english-15, -16                        | Require conditional stock filtering before aggregation. Replace the false packing explanation with a constrained minimum-cost purchase: whole packs, two item deficits, mixed-pack availability, and exhaustive comparison of allowed combinations.                                 |
| operations-english-14, -18, -20             | State an office-specific vote rule and the absence of a decision. Replace simple duration addition with parallel work, mandatory precedence and final assembly. Separate dated net activity from refund authorisation, later payment, and a cash-float transfer.                    |
| alphabetizing-english-09                    | Correct “An Department” to “A Department”; independently recomputed normalization/order is unchanged.                                                                                                                                                                               |

## Accuracy, originality, and source review

Reviewed the revised stems, every option, keys, explanations, and reference
consumers in a distinct agent pass. This is not independent human approval.

- [RA 6713](https://lawphil.net/statutes/repacts/ra1989/ra_6713_1989.html),
  Sections 3(c), (d), and (j): cumulative gift-exclusion and divestment conditions.
- [RA 9003](https://lawphil.net/statutes/repacts/ra2001/ra_9003_2001.html),
  Sections 3(bb),(ee), 16, 21, 24, and 32: packaging proviso, recovery/residuals,
  source segregation, transport, and joint MRFs. Numerical capacities are expressly
  hypothetical, not statutory targets or a current operational legal opinion.
- [RA 10173](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html),
  Sections 3(g), 11, 12, and 21: combined identification, purposes, retention,
  lawful criteria, and responsibility for processing transfers.
- [RA 11032](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html),
  amended Sections 3, 4, and 6: coverage, fixing, task classification and fees
  where applicable. Source texts retrieved 2026-11-01; these checks are not a
  claim of a complete consolidated-law/jurisprudence review.

Recomputed the revised numerical keys: PHP 20, 5/7, 20 km, and 83 units.
At 82 units the revised tiered-profit task gives PHP 970; at 83 it gives PHP 1005.
Stock filtering gives 140 units. Exhaustive legal pack enumeration yields the
unique cheapest combination of two mixed, one bolt, and one washer pack, costing
PHP 150; the best costs with zero/one/two mixed packs are PHP 200/155/150.
The revised packet is ready at 10:10, not 10:05; March activity is PHP 8600 while
the bank deposit is PHP 8100. All ten filing keys still satisfy their stated rules.

The named Logic duplicate cluster is removed, including its old resemblance to
Family 01 Logic 20. Numerical 36 no longer mirrors Numerical 18's harmonic-mean
task. Existing cross-family checks continue to test IDs, normalized exact stems,
and dedicated passage text; they do not prove semantic originality. Other basic
skills legitimately recur. No Family 01 or Family 03 content was edited here.

## Verification and remaining gates

The [existing content tests](../../scripts/family02-content.test.mjs) retain
subject/language/difficulty counts, source-table/chart links, and all sorting,
numerical and selected logic checks. Their expected keys and question versions
are updated for the revised tasks, not disabled. The [new regression tests](../../scripts/family02-quality.test.mjs)
check numerical boundaries, exhaustive legal purchase combinations, replacement
Logic tasks, office scheduling/accounting, explicit premises, and corrected
versioned verbal references. Text assertions prevent recurrence; they are not
machine certification of legal or bilingual quality.

Seed validation of revision 4 passes with zero errors and warnings and reports
270 questions, 60 references, ten assets, and one complete seed family. Exam
readiness remains `not-evaluated`. A Windows Node loader EPERM initially prevented
CLI startup. Process-local loader flags allow the validator and test workers to
run without changing repository configuration or validator symlink/path checks:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-02/manifest.json --mode seed --json
npm.cmd run test:unit
```

Verification results for this revision:

- Seed validator: passed, zero errors and warnings; pinned checksum matches.
- Unit tests: all 355 tests across 27 files passed, including all 16 focused
  Family 02 content/correction tests. The suite also includes concurrently
  present Family 03 tests; those files were not changed by this revision.
- Typecheck and Knip: passed.
- Changed-file Prettier check and `git diff --check`: passed.
- Lint: unavailable. Both `npm.cmd run lint` and a focused ESLint run stop while
  loading `react/display-name`: the React-version detector explicitly calls
  `realpathSync` and receives `EPERM` on `C:\Users\HP`. Loader flags do not fix
  that separate detector. No lint rules or repository settings were disabled.
- Vitest emits a non-fatal existing unresolved optional `@vitejs/devtools/config`
  warning; it did not prevent the complete passing run.

The initial validator startup and forked-test startup failed with the loader
EPERM before process-local flags were applied. The first post-edit seed run
correctly rejected the old checksum, which was recomputed only after reviewing
the changed inventory. No validation invariant was removed to obtain a pass.

Build and E2E are inapplicable to this offline content/test change. No runtime,
framework behaviour, user journey, or production bundle changes. Independent
legal/domain and bilingual editorial approval, empirical calibration, human
review, and green CI remain separate gates before publication or merging.

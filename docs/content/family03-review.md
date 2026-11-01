# Family 03 — seed bank and quality review

Date: 2026-11-01. Corpus: `cse-2027-family03`, revision 1. This is original,
AI-assisted, offline authoring, not an import into Convex, a publication decision,
or actual/leaked Civil Service Examination material. Quilla is not affiliated
with the Philippine Civil Service Commission.

## Inventory and difficulty allocation

The [independent manifest](../../content/question-bank/family-03/manifest.json)
lists 16 content files, 34 supporting reference records, and ten chart assets.
These are seeding allocations, not the number of questions served per exam.

| Subject             | Easy | Medium | Hard | Total |
| ------------------- | ---: | -----: | ---: | ----: |
| General Information |   12 |     20 |    8 |    40 |
| Verbal Ability      |   15 |     25 |   10 |    50 |
| Numerical Ability   |   18 |     30 |   12 |    60 |
| Analytical Ability  |   24 |     40 |   16 |    80 |
| Clerical Ability    |   12 |     20 |    8 |    40 |
| Total               |   81 |    135 |   54 |   270 |

Every subject has a 30/50/20 editorial allocation. Verbal contains 25 English
and 25 Filipino items. Numerical contains 40 numerical reasoning and 20 data
sufficiency items. Clerical contains 20 operations, ten alphabetizing and ten
spelling items. Analytical contains 40 data interpretation and 40 logic items.
Analytical is Professional-only; Clerical is Subprofessional-only. All other
items are shared-core. This gives 230 eligible authored items for Professional
and 190 for Subprofessional, not ready-made exam forms.

## Diversity and substantive calibration

Family 03 follows [rules.md](../../content/question-bank/rules.md), the
[taxonomy/blueprint documentation](../exams/cse-taxonomy-and-blueprints.md), and the
[seeding-family policy](seeding-families.md). Its coverage deliberately expands
the pool rather than reproducing earlier questions with new names or numbers:

- General: disaster resilience and preparedness, climate integration, distinct
  rights safeguards, disclosure, private practice and confidential-information
  cases. Volatile officeholder/current-event recall is avoided.
- Verbal: contextual polysemy, grammatical scope, reference and comparison,
  literary interpretation, fairness of evidence, narrative and argument order.
  English/Filipino parallel reskins were replaced during review.
- Numerical: rounding bounds, indivisible work, conditional replacement,
  mean/median/unique-mode feasibility, complete digit-reversal solution sets,
  and sufficiency cases with explicit counterexamples.
- Analytical: turnaround distributions, timetables, changing group composition,
  stock ageing, land/water constraints, cumulative meters, skill membership,
  queues, forecasts, project dependencies, routes and switching systems.
- Clerical: indexing/scanning pipelines, review/approval scheduling, approved
  ledger revisions/reversals, constrained dispatch packing, explicit filing
  conventions, and distinct spelling targets.

Demand was revised at the task level, not by relabelling alone. In particular,
initially routine hard numerical/clerical tasks were rewritten to require
interacting constraints or competing feasible cases. Hard language tasks require
combining evidence or dependencies; hard legal cases retain partially correct
alternatives. Easy retrieval and medium coordination remain represented.
These are reasoned editorial estimates, **not empirically calibrated difficulty**.
Independent subject/bilingual approval and learner-response calibration remain
pending; a numerical ratio does not certify cognitive demand.

## Per-item review records

The following three ledgers together cover all 270 stable question IDs, keyed
answers, solution/evidence and distractor checks. They are the per-item register
for this family; there is no competing consolidated question file.

- [General and Verbal: 90 items](family03-general-verbal-review.md)
- [Numerical and Clerical: 100 items](family03-numerical-clerical-review.md)
- [Analytical: 80 items](family03-analytical-review.md)

Separate authoring agents performed solution passes; the integrator independently
read the content, challenged weak distractors/demand, recalculated data answers,
and checked cross-family recurrence. All are AI-assisted passes, not independent
human signatures. Corrections included mismatched logic options, two inaccurate
logic explanations, unnecessary task duplication, repeated spelling words,
unsupported language nuances and an ambiguous whole-minute condition.

Exact-ID/task/reference-text checks against Families 01 and 02 are automated.
A token-similarity screen and manual comparisons also examined apparent matches.
Shared constructs such as necessary conditions, numerical divisibility and basic
filing remain legitimate coverage; confirmed reskins were replaced. No unresolved
confirmed duplicate was identified in this pass. These checks do not prove
semantic uniqueness or eliminate the need for human editorial review.

## References, images and source limitations

Each of the 12 reading and 12 paragraph questions has its own dedicated, pinned
reference; none of those passages/paragraph sets is shared between questions.
Ten canonical synthetic datasets intentionally support four analytical items
each. Every alphabetizing item supplies its own list and complete local rules.
Each data sufficiency item carries its own five full semantic choices and an
explanation assessing each statement alone and together.

Ten PNG charts are included and linked through checksum-bearing asset metadata.
They were rendered from the canonical data and visually inspected. The meter
uses a labelled line chart and the skills register a labelled pie chart; other
charts use labelled bars/panels with explicit units. There are no ratio-like
series indicators. Colour is supplemented by labels, and canonical text/tables
retain the values and assumptions needed to solve the questions.

The ledgers record primary statute and dictionary URLs and actual retrieval
limitations. General uses retrieved Lawphil Constitution, RA 6713, RA 10121 and
RA 9729 provisions. English vocabulary/spelling uses Merriam-Webster. Filipino
headword retrieval was incomplete for `bigat` and `timbang`; figurative usage
needs independent bilingual review. Blocked Cambridge/UN endpoints are not
represented as verified sources. Original fictional passages and synthetic
mathematics do not imply real-world datasets or official examination provenance.

## Verification and release boundary

The final inventory checksum is
`c6fd2b9e59e0e859c455304aafa444f6c037d7a9ba159c09ba5bea7707c65aa8`,
pinned in the manifest. Seed validation reports 270 questions, 34 references,
ten assets, zero errors and zero warnings. Seed validation checks structure,
allocation, eligibility, identity and reference/asset integrity; it cannot
certify correctness, originality, language quality or measured difficulty.

Local checks completed:

- Full unit suite: 26 files, 349 tests passed, including 58 Family 03
  integration/numerical/clerical tests.
- Analytical Python suite: five tests passed, covering canonical-table
  calculations, exhaustive constraint models and PNG dimensions/checksums.
- `npm run lint`, `npm run typecheck`, and `npm run knip`: passed.
- Formatting, local review-document links and `git diff --check`: passed.
- Build and browser E2E were not run: this change adds offline content,
  documentation and test/rendering scripts, with no application/runtime or user
  journey changes. No production credentials or services were used.

No live database was seeded, no content was published, and no commit/push was
made for this task. Future serving must select only eligible published versions
under the separate pooled exam blueprint and preserve served versions.

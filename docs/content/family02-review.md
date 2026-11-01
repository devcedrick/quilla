# Family 02 authoring and review record

Date: 2026-11-01. Scope: local original practice-content authoring only. Quilla is
not affiliated with the Philippine Civil Service Commission. These are not leaked
or actual CSC examination questions, official CSC weightings, or legal advice.

## Current editorial correction

Revision 4 addresses the maintainer-requested accuracy, originality, and difficulty
review. It revises 28 questions and three dedicated text references, retaining
270 questions and the exact 30/50/20 allocation in every subject. No labels alone
were promoted. See [the correction ledger](family02-quality-revision.md) for
item IDs, substantive demand changes, verification, and pending human gates.
The chronology below describes earlier authoring and chart revisions where stated.

## Inventory

[Family 02 manifest](../../content/question-bank/family-02/manifest.json),
format 2, corpus `cse-2027-family02`, revision 4, declares 16 topic/language files,
270 questions, 60 supporting reference records, and ten PNG chart assets.
All records are new canonical IDs beginning `f02-`, family 2. The 40 data questions
and their references first became version 2 after chart linkage. Removing the
ratio-like series indicators subsequently changes 32 of those questions and their
references to version 3; the eight rainfall/produce items remain at version 2
because their single-series panels already used plain values. The other 230
question versions and 20 text-only reference versions remained 1 at revision 3.
Stems, source data, answer choices, keys, explanations, and difficulty labels did
not change in that chart-label update. Revision 4 deliberately changes the
question/reference versions listed in the correction ledger; chart bytes and
data-reference versions are unchanged.
Taxonomy is `cse-taxonomy-2027-v2`; blueprint metadata is Professional and
Subprofessional v3. All Numerical items are shared-core; this family does not
invent a Professional-extension authoring quota.

| Subject             |   Easy |  Medium |   Hard |   Total |
| ------------------- | -----: | ------: | -----: | ------: |
| General Information |     12 |      20 |      8 |      40 |
| Verbal Ability      |     15 |      25 |     10 |      50 |
| Numerical Ability   |     18 |      30 |     12 |      60 |
| Analytical Ability  |     24 |      40 |     16 |      80 |
| Clerical Ability    |     12 |      20 |      8 |      40 |
| **Total**           | **81** | **135** | **54** | **270** |

Verbal contains 25 English and 25 Filipino items: 10 Vocabulary, 20 Grammar,
10 Reading, and 10 Paragraph Organisation. Numerical contains 40 reasoning and
20 Data Sufficiency. Analytical contains 40 table/data and 40 logic/analogy.
Clerical contains 20 general operations, 10 Alphabetizing, and 10 Spelling.
General contains ten items on each of four civic statutes rather than another
40-item Constitution batch. Every approved concept is represented.

Each of the ten reading items has its own original passage. Each of the ten
paragraph items has its own original paragraph-part set. Each sorting item
supplies its own complete list and normalization convention. Each Data Sufficiency
item includes both statements and five complete semantic choices.

Forty data items use ten synthetic datasets. Each item now links to an original
chart and an equivalent accessible source table. The ten PNGs live in
[`references/assets/`](../../content/question-bank/family-02/references/assets/),
with dimensions and byte hashes in
[`f02-chart-assets.json`](../../content/question-bank/family-02/references/f02-chart-assets.json).
The 40 per-item reference records repeat the applicable chart/table, not another
item's answer. Four questions share each chart; reading and paragraph references
remain dedicated to individual items.

The images were rendered deterministically from the source tables with
[render-family02-charts.py](../../scripts/render-family02-charts.py) and Pillow
12.3.0, using Arial on this Windows host. No AI image generation, external data,
or estimated chart values are involved. Grouped bars show loans, warehouse stock,
and repair tickets; a line graph shows solar generation/use; stacked bars show
training, ferry passengers, donations, and calls. Rainfall and market crates use
separate panels for different units, avoiding a misleading combined scale.
All axes start at zero, values and series are labelled, and text alternatives
contain the source values without derived answers. The renderer can regenerate
PNGs but does not update metadata or authorise overwriting an accepted version;
changed bytes require reviewed asset hashes and manifest/version updates.

The authoring agent inspected all ten final PNGs against the corresponding
table values, axes, legends and units. Initial two-panel legends touched the
preceding panel baseline; redundant single-series legends were removed and both
panels were inspected again. Independent human visual approval remains pending.

Revision 3 removes numeric series indicators from data labels and legends at the
maintainer's request. Labels such as `1:80` were series/value tags, not ratios,
but could reasonably be misread as ratios. Learner-facing marks now show only
plain values, and legends pair descriptive series names with colours. Accessible
tables and descriptions remain intact; genuine time labels such as `08:00` are
unchanged. All eight changed PNGs were visually reinspected after regeneration.
Two additional Python regression tests cover grouped, stacked, and line chart
labels, named legends, and preservation of meaningful time labels. Run with a
Python environment containing Pillow:

```sh
python scripts/test_family02_charts.py
```

The [270-row item register](family02-item-register.md) maps every ID to its task,
concept, language, estimated difficulty, and key. The linked JSON records are
the per-item solution and provenance ledger; they contain explanations, source
sections, source URLs, dates, and reference-version links.

## Source verification

Retrieved 2026-11-01. General Information asks about provisions as written,
not undocumented current implementation, a current officeholder, or a prediction
about an actual legal dispute. Each General question records its precise section.

- [RA 6713](https://lawphil.net/statutes/repacts/ra1989/ra_6713_1989.html):
  definitions, conduct norms, and public-response duties in sections 3–5.
- [RA 9003](https://lawphil.net/statutes/repacts/ra2001/ra_9003_2001.html):
  definitions, planning, source segregation, collection, and recovery-facility
  arrangements in sections 3, 16, 21, 24, and 32.
- [RA 10173](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html):
  definitions, Commission, general principles, lawful criteria, and accountability
  in sections 3, 7–8, 11–12, and 21.
- [RA 11032](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html):
  amended sections 3, 4, and 6 on coverage, definitions, and Citizen's Charters.

These are primary statutory texts reproduced by Lawphil, not claims of a complete
2026 consolidated-law or jurisprudence review. An independent legal/domain check
is required before publication, particularly for operational applications.

English vocabulary uses the applicable contextual senses from publisher entries:
Cambridge for tentative and scrupulous, Merriam-Webster for redundant, impartial,
and feasible. Some initial Cambridge paths returned HTTP 403; accessible indexed
US entries or the Merriam-Webster primary entries were used instead. Each item
records the successful source, not a claim that the blocked page was inspected.

Filipino vocabulary checks use KWF Diksiyonaryo entries for salát, masínop,
lantád, pánig (including pumánig), and salungát. Accent-sensitive queries were
needed: several plain query paths were unavailable. The salát entry contains
distinct senses; the equipment-shortage context selects deficiency, not touch.
The masínop entry includes careful accumulation/order; the context concerns
organised preservation of receipts rather than an unsupported unrelated sense.

Spelling headwords were checked against Merriam-Webster publisher pages. Each
spelling record lists every correct headword used. No dictionary sample sentences
were copied, and the distractors are deliberately misspelled forms, not regional
variants asserted to be wrong. English construction/reference guidance was read
from [Purdue OWL proofreading](https://owl.purdue.edu/owl/general_writing/the_writing_process/proofreading/proofreading_for_errors.html)
and [pronoun reference](https://owl.purdue.edu/owl/general_writing/grammar/pronouns/index.html).
Filipino grammar still requires independent bilingual editorial approval;
DepEd search indexing corroborated aspect terminology but is not represented as
inspection of an entire downloadable module or verification of every sentence.

## Distinct review pass and corrections

The authoring agent conducted a separate solution/distractor/overlap pass. This
is not independent peer or human approval. Findings corrected before final pinning:

- Two different box pairs initially met a target; changed the task to a unique
  22-book pair. The table remains internally consistent.
- Corrected the four-month tank-overflow calculation to 78 litres and explicitly
  retained monthly emptying, so surplus capacity cannot be pooled across months.
- Replaced the parity Data Sufficiency task that was too close to Family 01 with
  a prime/even-domain task requiring a definite-no conclusion from both statements.
- Replaced another direct linear-equation sufficiency task with complementary/
  supplementary angles, and an age-like sum/difference task with product/GCD/LCM.
- Clarified the English ownership-revision stem: its answer repeats a noun and
  therefore must not be described as an example of a pronoun itself referring clearly.
- Replaced implausible Filipino tense distractors with grammatical sentences
  differing in aspect/time; replaced a parallel ownership task with inclusive/
  exclusive first-person reference instead of duplicating the English scenario.
- Strengthened hard logic with joint ordering/adjacency, box-type value recovery,
  and chained classification constraints. Added finite-model checks.
- Changed rainy-day counts so an aggregate rainfall-rate answer cannot be obtained
  merely by reading any one identical monthly rate.
- Strengthened the hard book-table task with limiting kit components, leftovers,
  equal distribution, and separate-library whole-box constraints.

No accepted Family 01 records or versions were changed. Basic mathematical skills
necessarily recur, but Family 02 is not a copied/rescaled Family 01 bank. The
cross-family automated checks rule out identical IDs, normalized exact stems,
and reused passage/paragraph text; they cannot prove semantic uniqueness. A
cross-language and conceptual near-duplicate review by an independent editor
remains a publication gate, not an invented completed review.

## Difficulty rationale and checks

Easy tasks use direct retrieval, one elementary operation, or an explicit rule.
Medium tasks coordinate context, a domain, a denominator, or a small set of
conditions. Hard tasks add interacting constraints, counterfactual/comparative
reasoning, ambiguity control, necessary-versus-sufficient conditions, or competing
partial interpretations. The item explanations identify the actual reasoning.
These are authored demand estimates, not measured learner success rates.
The exact 30/50/20 authoring allocation is checked separately from generic seed
validation; empirical calibration may later justify reclassification.

[Focused regression tests](../../scripts/family02-content.test.mjs) check allocation,
eligibility, dedicated references, cross-family exact overlap, all 40 numerical
keys, selected data calculations and boundary traps, all ten sorting orders and
complete option permutations, and selected sufficiency/logic models. Tests use
the records themselves but do not pretend that answer-key equality alone proves
language or factual correctness. All numerical explanations were worked through
in the solution pass; the tests add independent arithmetic/model checks.

## Reproduce and handoff

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-02/manifest.json --mode seed --json
npx vitest run scripts/family02-content.test.mjs
```

The manifest pins dataset SHA-256
`de9d8f96bea926512a1dedb38addf41c18a11e86b673337df04d6c1c398ee728`.
Chart-label revision 3 had checksum
`720f3f9dc1d280847cfbf6545f236a9ac1d616caee3e5293ee422af4aaae92c9`.
Chart-inclusive revision 2 had checksum
`21124e069e81f176fb07831bc69d1498c86a1be16834842afe7c73038607eab0`.
The table-only revision 1 had checksum
`56c482942030cdecfb1ac96bbc9e76b16a425a923ba35ed8a9f3571ac4e54bf3`.
Its local run passed seed validation with zero errors and zero warnings,
all 280 unit tests across 23 files, lint, typecheck, Knip, changed-file formatting,
284 local documentation-link checks, and `git diff --check`. The nine focused
Family 02 tests are included in the 280. An initial focused run exposed two
floating-point assertion issues (60 represented as 59.99999999999999, and 7.8
as 7.800000000000001); numerical comparisons now use tight decimal tolerances,
without changing the mathematically correct content answers or other assertions.
Family 01 files were unchanged and its preservation regression passed.

Revision-2 verification uses the fresh chart-inclusive run. The new
regression requires ten assets, chart/table equivalence for all 40 data references,
four consumers per chart, and correct version links and PNG dimensions. The seed
validator separately checks actual image byte hashes and registered asset paths.
The revision-2 chart-inclusive run passed all 281 tests across 23 files, seed validation
with zero errors/warnings, lint, typecheck, Knip, formatting, 287 local
documentation links, and `git diff --check`. No question text, answer key,
difficulty distribution, or Family 01 content changed during chart addition.

Revision 3 passes all 281 JavaScript unit tests and both Python label regression
tests (including the three chart-mode subcases), seed validation with zero
errors/warnings, formatting, lint, typecheck, and Knip. The same 270 questions and
81/135/54 authored difficulty totals are retained. Build and E2E remain
inapplicable to this offline chart-label correction.

A structural seed pass reports `examReadiness: "not-evaluated"`.
Publication, empirical calibration, independent bilingual/domain
approval, pooled-exam feasibility, and runtime integration remain separate gates.
No database import, deployment, commit, or push is authorised by this authoring run.
Build and E2E are inapplicable: no application code, UI, backend, or runtime changes.

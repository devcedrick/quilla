# Seeding families and the pooled question bank

This is the current authoring policy, approved 1 November 2026 in
[ADR 0013](../ADR/0013-seeding-families-and-pooled-exam-selection.md). It replaces
the earlier assumption that one family is one paired exam set.

## Definitions and allocation

A **seeding family** (or seeding set) is a 270-question authoring batch. A
**mock-exam set** is a blueprint-constrained selection for one attempt. Final
authored content, publication, technical import, empirical calibration, and exam
availability are separate states. Existing question-level review evidence must
remain truthful.

| Subject             | Each family | Families 01–08 combined | Professional exam | Subprofessional exam |
| ------------------- | ----------: | ----------------------: | ----------------: | -------------------: |
| General Information |          40 |                     320 |                20 |                   20 |
| Verbal Ability      |          50 |                     400 |                50 |                   50 |
| Numerical Ability   |          60 |                     480 |                40 |                   35 |
| Analytical Ability  |          80 |                     640 |                40 |                    0 |
| Clerical Ability    |          40 |                     320 |                 0 |                   40 |
| **Total**           |     **270** |               **2,160** |           **150** |              **145** |

**Family 01 is complete for seeding, as confirmed by the maintainer.** Families
02–08 will each contain another 270 unique questions with these subject totals.
This is not a promise of eight fixed or non-overlapping mocks per level.

Family 01's content breakdown is an inventory, not a new per-exam concept quota
or an additional fixed concept allocation for later seed families:

- General: 40 Philippine Constitution questions.
- Verbal: 14 Vocabulary, 12 Grammar, 12 Reading, and 12 Paragraph Organisation;
  25 English and 25 Filipino overall.
- Numerical: 40 Numerical Reasoning and 20 Data Sufficiency.
- Analytical: 40 Graphs/Charts/Data and 40 Word Analogy/Logic.
- Clerical: 20 general Clerical Operations, 10 Alphabetizing, and 10 Spelling.

A canonical question counts once across seed families. Versions, translations,
or cosmetic rewrites do not count as additional unique questions. New families
need substantively different content, not just changed names or numbers. The
30/50/20 target guides new authoring, with honest labels and calibration taking
priority. Do not reopen completed Family 01 merely because its labels do not
independently match an exam's cells.

## Exam selection

For example, all eight families provide 320 authored General questions. A mock
selects 20 eligible General versions from their combined pool. Apply that same
principle to every subject. Only eligible published versions may be served;
authored count does not mean every question is already published.

Random selection must still satisfy the [blueprint](../exams/cse-taxonomy-and-blueprints.md):
level, subject, language, difficulty, and concept constraints. No single-family
or equal-family quota applies. Professional excludes Clerical; Subprofessional
excludes Analytical. Data Sufficiency must appear within each exam's shared
Numerical selection; all other applicable concepts must also be covered.

One canonical question cannot appear twice in an attempt, but may recur in
different attempts. No cross-attempt repeat guarantee is introduced. Snapshots
retain exact question/blueprint versions, choice order, and seed provenance.
Family IDs identify origin; attempt/exam IDs identify the generated selection.

## Technical status and historical ledgers

Older ledgers retain terms such as draft, candidate, paired family, and per-family
exam shortages. Those are historical notes, not the current definition of seed
completion. This policy supersedes those interpretations, without erasing hashes,
factual corrections, source notes, or question-level review evidence.

The v1/v2 folders are storage/integration locations, not final-versus-draft
content classifications. This documentation does not move, republish, or retag
questions. The v1 validator still applies its old 1,520-question paired-exam gate;
that gate does not determine completion of the new 270-item seed families.

V3 pooled selection and validation require implementation. Initial activation
still requires integration of the planned eight families and an eligible combined
pool satisfying each level's exam cells. Pooled shortages and release checks are
exam-readiness work, not a demand to discard completed seed content.

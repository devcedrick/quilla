# Seeding families and the pooled question bank

This is the current authoring policy, approved 1 November 2026 in
[ADR 0013](../ADR/0013-seeding-families-and-pooled-exam-selection.md). It replaces
the earlier assumption that one family is one paired exam set. The initial scope
is seven families, Families 01–07, under
[ADR 0016](../ADR/0016-seven-family-scope-and-deferred-audit.md).

## Definitions and allocation

A **seeding family** (or seeding set) is a 270-question authoring batch. A
**mock-exam set** is a blueprint-constrained selection for one attempt. Final
authored content, publication, technical import, empirical calibration, and exam
availability are separate states. Existing question-level review evidence must
remain truthful.

| Subject             | Each family | Families 01–07 combined | Professional exam | Subprofessional exam |
| ------------------- | ----------: | ----------------------: | ----------------: | -------------------: |
| General Information |          40 |                     280 |                20 |                   20 |
| Verbal Ability      |          50 |                     350 |                50 |                   50 |
| Numerical Ability   |          60 |                     420 |                40 |                   35 |
| Analytical Ability  |          80 |                     560 |                40 |                    0 |
| Clerical Ability    |          40 |                     280 |                 0 |                   40 |
| **Total**           |     **270** |               **1,890** |           **150** |              **145** |

**Families 01–07 constitute the initial offline seeding delivery**, with 270
questions each. Family 08 is outside this delivery. This is not a promise of
seven fixed or non-overlapping mocks per level.

## Review and acceptance boundaries

Per-family authoring reviews and automated validation support the initial offline
delivery. The maintainer deferred the supplemental exhaustive cross-family audit
to [#98](https://github.com/devcedrick/quilla/issues/98); it is not a merge gate
for that delivery. Saved checkpoints and unresolved findings remain evidence of
unfinished work, not a clean audit acceptance recommendation.

Automated verification checks structural and reproducible properties. AI editorial
review records reasoning, source limitations and defects without claiming human
inspection. Maintainer batch acceptance identifies the exact revision/checksum,
decision, actor, date and remaining exceptions; it is distinct from both review
methods. Empirical difficulty and distractor discrimination require learner data
and remain unmeasured. Editorial 30/50/20 targets still apply.

Offline acceptance does not approve import, publication or learner serving.
General contributor self-review restrictions and backend authorization remain
unchanged. [ADR 0017](../ADR/0017-independent-question-review-policy.md) resolves
#31 with one independent active-admin approval per version and no bootstrap
self-approval exception. A manifest, sign-off file or audit report cannot grant
publication authority. The separate developer bootstrap in
[ADR 0022](../ADR/0022-one-time-seed-bootstrap-publication.md) uses non-login system
identities for this exact corpus only; it does not let a contributor, admin or
maintainer approve their own question.

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

For example, all seven families provide 280 authored General questions. A mock
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

Each seed family now has its own bank, such as
[`family-01/manifest.json`](../../content/question-bank/family-01/manifest.json),
with topic/language question files in `content/` and shared material and images
in `references/`. Future families have separate folders and manifests; there is
no global appended question file. [ADR 0015](../ADR/0015-per-family-content-and-reference-banks.md)
supersedes the earlier single-file interpretation. Taxonomy/blueprint versions
remain metadata; question IDs, versions, and content are unchanged.
Legacy validator modes retain the old paired-exam gate only for historical
fixtures; that gate does not determine current seed completion.

The existing offline validator now supports a separate seed gate:

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed
```

Each family's format-2 inventory declares its content and reference files and validates taxonomy v2, 270 items per
declared family, subject counts, Verbal language totals, and existing record,
asset, reference, and checksum invariants. It reports difficulty rather than
enforcing per-exam cells. See [format and commands](exam-set-corpus.md#combined-seed-inventory-manifest-format-2)
and the [Family 01 validation report](family01-validation.md). Seed success is
structural evidence, not independent editorial sign-off or permission to serve.

V3 pooled selection and exam-feasibility validation still require implementation. Initial activation
still requires integration of the seven initial families and an eligible combined
pool satisfying each level's exam cells. Pooled shortages and release checks are
exam-readiness work, not a demand to discard completed seed content.

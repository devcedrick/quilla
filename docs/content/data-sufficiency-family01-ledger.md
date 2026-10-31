# Family 01 Data Sufficiency — twenty original items

> Current policy: [seeding families](seeding-families.md) and ADR 0013 supersede
> this ledger's historical draft/candidate and exam-family completion wording.
> Family 01 is complete as a 270-question seed batch. Publication and pooled exam
> readiness are separate; source notes, hashes, and review evidence below remain historical records.

The maintainer requested twenty items with individual choices and the usual
30% easy / 50% medium / 20% hard allocation. The batch contains six easy, ten
medium, and four hard items. Every item embeds its own question, two statements,
five full-text choices, and learner-facing explanation. No external directions or
shared choice reference is needed to answer it.

## Location and taxonomy boundary

The JSON is `content/question-bank/cse-2027-v2/families/f01-data-sufficiency.json`.
IDs run from `f01-data-sufficiency-01` through `20`, all family 1,
English, subject `numerical_ability`, subtopic `numerical_reasoning`, concept
`data_sufficiency`. All records are shared-core eligible for both levels.
Items 01, 07, 09, 11, 12, 15, 17, 18, and 19 are version 2 following quality
review; the remaining eleven records retain version 1. Stable question IDs and
semantic choice IDs are preserved. Revised keys belong to the revised versions,
not a reinterpretation of any earlier served version.

These are staged v2 candidates under [ADR 0011](../ADR/0011-numerical-data-sufficiency.md),
not records added to the v1 manifest. The offline v1 validator does not support
this concept yet. The twenty-item bank does not increase either blueprint's
Numerical item total or establish a 20/20 concept split. Final family assembly
must select from the candidate pools within the existing 35 shared and five
Professional-only Numerical slots, their difficulty cells, and concept minima.

## Item ledger

“1 only” and “2 only” mean that just that statement is sufficient on its own;
“together” means neither alone is sufficient. “Either” means each alone works;
“neither” means even the combination remains insufficient.

| Item | Distinct skill / scenario                                            | Difficulty | Sufficiency outcome |
| ---- | -------------------------------------------------------------------- | ---------- | ------------------- |
| 01   | Combine packet mass and packet count                                 | Easy       | Together            |
| 02   | Fixed width with exact versus bounded length                         | Easy       | 2 only              |
| 03   | New price and increase versus missing percentage base                | Easy       | Together            |
| 04   | Two independently determining equations                              | Easy       | Either              |
| 05   | Ratio scale remains free despite a lower bound                       | Easy       | Neither             |
| 06   | Definite yes for parity without an exact integer                     | Easy       | 1 only              |
| 07   | Integer sum and greatest-common-divisor constraints leave two ratios | Medium     | Neither             |
| 08   | Sum and difference of current ages                                   | Medium     | Together            |
| 09   | Recover route-segment distance from different time constraints       | Medium     | Either              |
| 10   | Perimeter with integer and ordering restrictions                     | Medium     | Neither             |
| 11   | Distinguish division remainder from full-box count                   | Medium     | 2 only              |
| 12   | Identify a fixed-plus-variable tariff from two observations          | Medium     | Together            |
| 13   | Fuel efficiency from cost and unit price                             | Medium     | Together            |
| 14   | Equivalent descriptions of overlapping groups                        | Medium     | Either              |
| 15   | Test whether a bound distinguishes the roots of a quadratic          | Medium     | Neither             |
| 16   | Prime-product divisibility with a nondivisible factor                | Medium     | Together            |
| 17   | Infer initial concentration from alternative replacement procedures  | Hard       | Either              |
| 18   | Recover an initial work rate, then account for a slowdown            | Hard       | 1 only              |
| 19   | Infer compound growth, reverse it, and restore an opening fee        | Hard       | 2 only              |
| 20   | Reconcile weighted and unweighted means with relative constraints    | Hard       | Together            |

## Difficulty and originality review

Easy items use direct uniqueness, a single equation, or a straightforward
counterexample. Medium items require linking quantities, assessing a partial
description, or separating redundant information from genuinely new constraints.
Hard items coordinate repeated mixture replacement, inferred and changing work
rates, compound-growth reversal with a fee, or two different averaging structures.
These labels are provisional editorial estimates,
not measured difficulty; no question is hard merely because it has five choices.
Human review and learner calibration may require revision rather than preserving
a quota by inflating labels.

The seven supplied screenshots inform the two-statement format and numerical
skills. They are reference material, not authoritative answer keys. The initial
01, 11, 12, and 17 drafts closely followed book-count, bead-removal, production,
and appointment templates. Review identified these as overly light adaptations;
they have been replaced with packet mass, division remainders, delivery tariffs,
and alternative mixture procedures, not just renamed or renumbered.

The remaining material is reference-inspired educational drafting, not a claim
of exhaustive originality or verified source eligibility. Generic age, set,
ratio, and divisibility formats still overlap the supplied skill coverage;
human source review remains necessary. No actual examination provenance is
asserted. The hypothetical interest item is arithmetic, not current financial
product advice. No questions make claims about actual disasters or organisations.

## Choice and sufficiency safeguards

Each record contains its own five choices with semantic IDs `one`, `two`,
`together`, `either`, and `neither`. Their meaning does not depend on displayed
A–E letters. The same standard outcome wording is intentionally repeated in each
record, rather than hidden in a single batch-wide instruction. Explanations never
refer to a correct visible letter or option position.

Review each statement against only the stem's givens before combining statements.
All pairs must be jointly consistent and have at least one feasible case. The
explanations give a determining relation or differing feasible answers for each
standalone insufficiency, and explain the combined result. Definite yes/no
answers count as sufficient even without determining the underlying number.
Domain restrictions are explicit where relevant. Contradictory premises never
count as sufficient.

## Release boundary

No v1 question versions, manifests, policy code, schemas, or runtime behaviour are
changed by this batch. Staged-file checks are separate from v1 corpus validation.
Source eligibility, human editorial sign-off, v2 validator adoption, and complete
paired-family dry-run evidence remain pending. No import, publication, deployment,
or commit is implied by creation of these files.

## Initial-draft verification (historical)

Before the quality corrections, all twenty keyed outcomes were checked against the analytical explanations and
separate finite case models. The models confirm feasible combined premises and
produce differing answers for each insufficient case; they do not substitute for
proof over unbounded domains. Explicit boundary checks cover the calendar window
from Friday noon inclusive to Saturday noon exclusive. Structural checks confirm
twenty unique IDs, one hundred embedded choices, all five semantic outcomes per
item, exact 6/10/4 difficulty counts, and shared eligibility. These staged checks
are not a claim that the v1 validator accepts taxonomy v2.

The original version-1-only batch had SHA-256
`805f192d1a3be30cd18df35217453088cd54d354137c132491337989e6cb2cb1`.
That checksum and its calendar checks above describe the superseded draft, not
the current revised file. The earlier run passed all 237 repository unit tests
and independently validated v1; neither result alone verifies these revisions.

## Quality corrections

The 6 easy / 10 medium / 4 hard target is retained by substantive changes, not
by preserving unsupported labels. Items 07, 09, and 15 now require integer
constraint checking, a segment-distance time equation, or quadratic-root filtering.
Items 18 and 19 add changing work rates and compound-growth reversal with an
opening fee. Item 17 is a new repeated-mixture sufficiency problem. These are
still editorial estimates pending calibration; observed difficulty takes priority
over the target allocation.

Changed outcomes break the old five-answer cycle in source order. The revised
keys are not forced into an artificial equal distribution. Presentation-time
question randomisation remains desirable; choice shuffling alone would never
remove a predictable semantic outcome sequence. All five full-text choices remain
embedded in every record, with unchanged semantic IDs. No v1 manifest, unrelated
staged spelling content, runtime, or deployment is modified by these corrections.

### Revised-batch verification

All twenty revised analytical outcomes agree with separate finite case models;
each pair has feasible combined premises. Every insufficient case has multiple
modeled answers, and the explanations establish the general determining relation
or provide explicit counterexamples. Finite sampling corroborates these arguments
but is not a proof over unbounded domains. Checks also pass for the nine version
increments, preserved IDs and eligibility, twenty distinct stems, one hundred
embedded choices, the 6/10/4 distribution, and removal of the old five-outcome
cycle. Specific arithmetic checks verify both mixture procedures, packing
remainders, the 22-hour versus 18-hour solo-work cases, and the PHP 5,200 deposit.

The formatted revised JSON has SHA-256
`2064b0540125682de7f1962cc4ef2e1e9c52a69698fc1361dfdf8b8ff943b962`.
All 237 repository unit tests pass. Build and browser tests are not run because
only offline question content and its ledger changed. V2 release validation,
human editorial sign-off, and empirical difficulty calibration remain pending.

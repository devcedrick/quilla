# ADR 0013: Separate Seeding Families from Pooled Mock-Exam Sets

- **Status:** Accepted; implementation pending
- **Date:** 2026-11-01
- **Decision owner:** Quilla maintainer
- **Supersedes:** ADR 0008's paired-family definition, 1,520-question corpus target,
  simultaneous disjoint-exam activation gate, and family-bound reuse rules;
  the exam-family coverage language of ADRs 0011 and 0012.
- **Retains:** Approved concepts, question eligibility, per-exam subject/language/
  difficulty cells, time limits, passing references, and immutable attempts.

## Context

The maintainer defines a seeding family as an authoring batch, not a paired mock.
Family 01 contains 270 final authored questions; later families will have the
same subject totals. The earlier model incorrectly treated this completed batch
as unfinished because it could not independently satisfy an exam's cells.

## Decision

A **seeding family** is a numbered provenance/authoring batch. The **pooled bank**
combines eligible versions across all seeding families. A **mock-exam set** is
one immutable, blueprint-constrained selection from that pool for an attempt.

| Subject             | Each seed family | Eight-family total |
| ------------------- | ---------------: | -----------------: |
| General Information |               40 |                320 |
| Verbal Ability      |               50 |                400 |
| Numerical Ability   |               60 |                480 |
| Analytical Ability  |               80 |                640 |
| Clerical Ability    |               40 |                320 |
| **Total**           |          **270** |          **2,160** |

The initial plan remains eight families. Family 01 is complete for seeding by
maintainer confirmation; Families 02–08 follow this 270-item subject allocation.
Final authored content is not downgraded to draft merely because import,
publication, calibration, or exam assembly is pending. Existing question-level
review evidence remains truthful; this decision does not invent review signatures
or database publication. A version, translation, or cosmetic rewrite does not add
unique corpus coverage. Each canonical question belongs to one seed family.

Randomized exam assembly draws across all eligible families, not one fixed family
or an equal quota from each. Professional retains 20 General, 50 Verbal,
40 Numerical, and 40 Analytical items. Subprofessional retains 20 General,
50 Verbal, 35 Numerical, and 40 Clerical items. Verbal retains 25 English and
25 Filipino items. Numerical's 35 shared and five Professional-extension slots
remain eligibility/difficulty partitions, not matched seed-family pairs.

Each generated exam covers every applicable concept, including Data Sufficiency
in the shared Numerical selection and all three Clerical concepts for
Subprofessional. No extra fixed concept quota is selected here. One canonical
question cannot occur twice within an attempt, but can occur in different exams
and across eligible levels. No disjoint-attempt guarantee or repeat-window policy
is introduced. Preserve served question and blueprint versions, choice order,
and seed provenance; family identity is not an exam-selection constraint.

Use `cse-professional-2027-v3` and `cse-subprofessional-2027-v3` for the changed
selection semantics; retain `cse-taxonomy-2027-v2` for the approved concepts.
Do not rewrite historical v1/v2 manifests, attempts, or accepted ADR text.

## Validation and activation

Separate seed-authoring checks (270 unique items and the subject counts above)
from pooled exam feasibility. New authoring still targets honest 30/50/20
difficulty; do not inflate labels or require every seed family to match an exam's
exact difficulty cells. Family 01's actual labels remain unchanged.

The initial corpus plan is 2,160 unique questions. Activation requires completion
and integration of that plan plus a dry run proving each level's exam can be
generated from eligible published pooled versions with exact cells, concept
coverage, and exclusions. It no longer requires eight simultaneously disjoint
exams per level or an exam from each seed family. An aggregate shortage can block
exam activation without undoing an individual family's seeding completion.
Retain the existing post-activation within-subject difficulty fallback and
actionable shortage reporting, without a family filter.

## Implementation boundary

Current JSON `family` values and `f01` IDs retain seed provenance; `module` fields
still encode eligibility partitions. The legacy v1 validator's family-completeness
and release gates implement the superseded contract, not this policy.

Implement separate seed-count and pooled-blueprint checks, versioned metadata,
selection/negative eligibility tests, snapshots, and publication gates before v3
serving. This ADR changes documentation only: no question JSON, validator code,
schema, database, deployment, or runtime is migrated here.

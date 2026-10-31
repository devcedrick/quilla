# ADR 0011: Add Numerical Data Sufficiency as a Versioned Concept

- **Status:** Accepted; implementation pending
- **Date:** 2026-10-31
- **Decision owner:** Quilla maintainer
- **Related:** [ADR 0008](0008-initial-cse-taxonomy-and-blueprint-policy.md)

## Context

The maintainer wants Numerical Ability to assess whether given information is
sufficient to answer a question, in addition to numerical computation. The v1
taxonomy has only `numerical_reasoning` under Numerical Ability. Treating the new
skill as an indistinguishable computation item would prevent separate concept
coverage and mastery reporting. Adding a required concept also changes the
coverage contract governed by ADR 0008's immutable versioning policy.

## Decision

Add shared concept `data_sufficiency`, display label Data Sufficiency, under
subject `numerical_ability` and subtopic `numerical_reasoning`. Retain the existing
`numerical_reasoning` concept. The new taxonomy is `cse-taxonomy-2027-v2`; its
paired blueprints are `cse-professional-2027-v2` and
`cse-subprofessional-2027-v2`. Do not rewrite ADR 0008, v1 policy snapshots,
historical question classifications, or served attempts.

Require at least one eligible Data Sufficiency item per family in the shared
35-item Numerical core. Professional extension items may assess it too. Retain
all existing subject totals, language rules, difficulty cells, family counts,
and other coverage and release requirements. No fixed concept allocation beyond
the per-concept minimum is approved by this decision.

Use two consistent statements and five fully worded sufficiency outcomes.
Assess each statement independently, then the pair; one answer must hold across
all permitted cases to establish sufficiency. A determinate yes or no is enough
for a yes/no question. Authoring must explicitly state relevant domains and
explain insufficiency and combined constraints. Choice identities must remain
valid after shuffling, consistent with
[ADR 0010](0010-assessment-choice-order-and-scoring.md).

The detailed taxonomy, authoring rules, and unchanged Numerical allocation are
specified in the [taxonomy contract](../exams/cse-taxonomy-and-blueprints.md#approved-addition-numerical-data-sufficiency).
This is a Quilla preparation decision, not a claim about official CSC weighting.

## Consequences and adoption gate

Data Sufficiency will have separate concept coverage and mastery evidence while
remaining eligible for both levels. An existing forty-item computation batch is
not retroactively Data Sufficiency coverage. Questions must be authored or
substantively revised and reviewed, not merely retagged.

This change is documentation only. The offline validator, corpus manifest, and
application are not migrated here. V2 adoption requires synchronized policy and
validator tests, versioned corpus metadata, reviewed questions, and complete
paired-family dry-run evidence. The current v1 validator must not be presented as
validating the new v2 concept. No runtime, schema, deployment, publication, or
production-data change is authorized by this ADR.

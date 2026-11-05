# ADR 0012: Include Alphabetizing and Spelling under Clerical Operations

- **Status:** Accepted; implementation pending
- **Date:** 2026-10-31
- **Decision owner:** Quilla maintainer
- **Related:** [ADR 0008](0008-initial-cse-taxonomy-and-blueprint-policy.md), [ADR 0011](0011-numerical-data-sufficiency.md)

## Context

The maintainer requested explicit Alphabetizing and Spelling coverage under
Clerical Operations. The v1 taxonomy already has Spelling under
`language_accuracy`, but does not identify Alphabetizing as a separate concept.
The pending, unactivated v2 contract provides the version boundary for this
refinement without altering historical v1 classifications.

## Decision

In `cse-taxonomy-2027-v2`, group the following under subject `clerical_ability`
and subtopic `clerical_operations`:

- Retained general concept `clerical_operations`: Clerical Operations.
- New concept `alphabetizing`: Alphabetizing.
- Retained concept `spelling`: Spelling, reparented from `language_accuracy`.

All three remain English and Subprofessional only. The existing per-concept
minimum applies to each in every v2 family. The 40-item Clerical module and its
12 easy / 20 medium / 8 hard cells remain unchanged. No further concept quota is
selected here. This refines the pending v2 contract from ADR 0011; it neither
changes v1 nor introduces a separate activated policy version.

Alphabetizing items must define filing conventions when names, spaces,
punctuation, or other details could produce different valid orders. Spelling
items must avoid treating accepted spelling variants as uniquely incorrect unless
the stem specifies a convention. Difficulty depends on reasoning demand, not
the topic label alone.

## Consequences and adoption gate

The main taxonomy table shows both requested topics under Clerical Operations.
Spelling retains its stable concept identity and existing mastery evidence.
Historical v1 question versions and served attempts keep the original
`language_accuracy` classification; any adopted reclassification must be explicit
and versioned. Do not edit accepted ADR 0008 to conceal that history.

This is documentation only. Offline policy, validators/tests, reference data,
and corpus adoption must be synchronized before v2 activation. Neither these
topics nor any other Clerical questions may be served to Professional learners.
No question generation, schema, migration, publication, or deployment is included.

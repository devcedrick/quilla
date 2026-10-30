# ADR 0008: Adopt Paired CSE Mock-Exam Blueprints and a Versioned Taxonomy

- **Status:** Accepted
- **Date:** 2026-10-30
- **Decision owners:** Quilla maintainers
- **Related issues:** [S16.1 / #28](https://github.com/devcedrick/quilla/issues/28), [E19 / #83](https://github.com/devcedrick/quilla/issues/83)

## Context

Quilla needs stable taxonomy identities and complete, testable mock-exam
blueprints before it can store reference data, validate questions, import an
initial corpus, or create immutable attempt snapshots. The CSC publishes the
supported levels, examination scope, test-proper and EDQ totals, full-session
time limits, and passing grade, but it does not prescribe Quilla's subject
weights, editorial difficulty mix, concept model, corpus size, or shortage
behavior.

Those official facts and product decisions must remain distinguishable. The
policy must also preserve the level and historical-integrity rules in
[ADR 0003](0003-exam-level-selection-policy.md), including shared canonical
concept evidence without making level-specific questions interchangeable.

## Decision

Adopt the versioned reference contract in
[Initial CSE Taxonomy and Mock-Exam Blueprints](../exams/cse-taxonomy-and-blueprints.md).
The initial identifiers are `cse-taxonomy-2027-v1`,
`cse-professional-2027-v1`, and `cse-subprofessional-2027-v1`.

The taxonomy uses the 19 leaves in the official CSC scope as canonical concepts,
grouped into product-defined subtopics. General Information, Verbal Ability, and
Numerical Ability are shared. Analytical Ability is Professional only; Clerical
Ability is Subprofessional only. Stable identifiers, rather than display labels,
are the downstream source of identity.

The initial corpus is certified as eight paired families. Each family combines a
105-item shared core with a five-item Professional Numerical extension, a
40-item Analytical module, and a 40-item Clerical module. It yields one 150-item
Professional mock and one 145-item Subprofessional mock. Shared-core items may
serve both level variants within their family, but no canonical question may be
reused across family numbers. The minimum unique corpus is 1,520 questions.

The initial mock excludes the 20-item EDQ. It uses a Quilla-authored 30/50/20
easy/medium/hard target, fixed subject and language cells, scaled time limits of
168 minutes for Professional and 141 minutes for Subprofessional, and an 80%
scored-item passing reference. These are preparation policies, not claims about
CSC's rating methodology.

The detailed item, EDQ, and time figures come from the latest available official
structural advisory for March 2026 and are carried into the 2027 blueprint
provisionally. The blueprints cannot activate until all applicable 2027 CSC
announcements and advisories confirm or supersede those figures.

Neither blueprint may activate until a dry run proves that all eight paired
families and every level, subject, language, difficulty, concept, and uniqueness
invariant are satisfiable with eligible published question versions. After
activation, a difficulty shortage may relax only within its subject, using the
nearest difficulty and preferring easier on a tie. Level, subject, language, and
concept requirements never relax; unresolved shortages block generation.

Before each exam cycle, maintainers review all applicable official CSC
announcements and advisories. Changed official facts or material product-policy
changes create new immutable versions. An unchanged review is recorded without
creating a needless version. Historical attempt snapshots are never rewritten.

This ADR makes no runtime, schema, deployment, or production-data change.

## Consequences

S16.2 and S16.3 receive explicit identities and validation matrices instead of
inventing them during implementation. S15.2 can validate question applicability,
and E19 can produce a measurable corpus with no ambiguous aggregate target.
Coverage reports can distinguish official eligibility violations from editorial
difficulty shortages.

The policy deliberately requires substantial initial content: eight complete
exams per level and 1,520 unique canonical questions. Sharing the paired core
avoids duplicating 840 questions while retaining separate level attempts and
scores. Disabling the EDQ keeps the initial product focused on scored practice,
but the scaled time limits are product approximations and must be described as
such.

The initial concepts are intentionally broad. Finer mastery concepts, empirical
difficulty calibration, an EDQ-enabled mode, or different subject weights require
versioned follow-up decisions rather than silent edits.

## Alternatives considered

- **Maintain unrelated corpora for each level:** This would duplicate shared
  scope, increase review burden, and weaken the canonical shared-concept model.
- **Use one undifferentiated question bank:** This would not prove that eight
  non-overlapping complete exams can be assembled and would obscure coverage
  shortages.
- **Include the EDQ immediately:** This would add unscored content and data rules
  before the product needs questionnaire behavior.
- **Keep the official full-session limits after removing the EDQ:** This would
  give the scored mock materially more time per item, so the initial policy uses
  transparent proportional scaling instead.
- **Reuse the diagnostic 50/35/15 difficulty target:** The mock blueprint instead
  emphasizes medium difficulty with the approved 30/50/20 editorial mix.
- **Create a detailed proprietary concept hierarchy now:** The official scope
  leaves provide a smaller, traceable starting taxonomy that can be superseded
  when content and learner evidence justify finer concepts.
- **Activate as soon as one complete exam exists:** This would present a thin
  corpus as launch-ready and would not satisfy the eight-family content policy.

## Boundaries and follow-up

S16.2 owns authorized taxonomy storage. S16.3 owns blueprint validation,
activation, dry runs, and immutable snapshots. S15.2 owns question/version
lifecycle behavior. E19 owns creation, review, and guarded import of the initial
corpus. Each must preserve this decision without treating this ADR as deployment
or schema approval.

The accepted policy resolves the open decisions for minimum initial published
coverage, shared-question weighting, initial EDQ treatment, difficulty mix,
shortage behavior, and source/version governance. Changes to this accepted
architecture require a new ADR rather than rewriting this record.

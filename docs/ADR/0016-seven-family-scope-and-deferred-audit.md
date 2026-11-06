# ADR 0016: Deliver Seven Initial Families and Defer the Supplemental Audit

- **Status:** Accepted policy; import and publication remain separate work
- **Date:** 2026-11-06
- **Decision owner:** Quilla maintainer
- **Related:** #94, #83, #31, #98 and PR #91
- **Supersedes:** ADR 0013's eight-family initial inventory target only
- **Retains:** ADR 0013 pooled selection and ADR 0015 independent family storage

## Context

On 4 November 2026 the maintainer limited the initial delivery to seven families.
After per-family authoring and validation, a supplemental exhaustive audit began.
It produced useful findings and repairs but did not finish. The maintainer then
chose to defer that audit rather than make it a prerequisite for merging the
initial offline corpus. Issue #94 synchronizes current policy with those decisions.

## Decision

Deliver Families 01–07 with 270 canonical questions each: 1,890 total. Each family
has 40 General, 50 Verbal, 60 Numerical, 80 Analytical and 40 Clerical questions.
Combined subject totals are 280, 350, 420, 560 and 280. Family 08 is excluded.
Keep the per-subject 30/50/20 editorial targets and 25 English/25 Filipino Verbal
split. Versions, translations and cosmetic rewrites do not add unique questions.

The initial offline delivery relies on its recorded per-family authoring reviews
and validation. The supplemental exhaustive cross-family audit is follow-up work
under #98, not an initial-delivery merge gate. Deferral does not resolve its known
findings, validate its pending repairs, or establish clean exhaustive acceptance.
Accepted historical ADRs and review ledgers remain unchanged.

## Evidence and acceptance

- **Automated verification** checks structure, integrity and reproducible
  calculations. It cannot certify factual accuracy or editorial quality.
- **AI editorial review** records actual reasoning, alternatives, sources,
  limitations and correction dispositions. It is not human inspection.
- **Maintainer batch acceptance** is an explicit decision against exact dataset
  revisions/checksums with actor, date and exceptions. Neither AI output nor a
  validation pass automatically supplies that decision. This ADR records policy,
  not a new item-level acceptance or publication sign-off.
- **Empirical calibration** requires learner data. Actual item difficulty and
  distractor discrimination remain unmeasured; editorial labels are estimates.

The audit checkpoints and repairs were preserved in the local stash named
`WIP: seven-family supplemental audit and repairs 2026-11-06`. It is local-only,
not a durable GitHub backup. Inspect and recover relevant evidence before reuse;
do not apply all question repairs as part of this documentation change. If that
stash is unavailable, record the limitation and reconstruct necessary evidence.

## Authorization and readiness

Offline authorship, import, editorial acceptance, publication and exam availability
remain separate states. This decision authorizes no database writes or deployment
and changes no runtime approval paths. Only eligible published question versions
may be served. General contribution self-review restrictions remain intact,
including for admin contributors; no manifest/sign-off claim grants authority.

Issue #31 must explicitly resolve any initial-maintainer bootstrap approval policy
before such a route is implemented or used. The historical bootstrap proposal in
#83 is not a generic self-approval permission or a substitute for that resolution.

Pooled activation still requires an eligible combined pool satisfying each level's
blueprint and a feasibility dry run. Professional excludes Clerical;
Subprofessional excludes Analytical. Seven families do not guarantee seven fixed
or disjoint exams. Existing blueprint versions and immutable historical attempts
are unchanged.

## Consequences

Current requirements and authoring instructions use seven/1,890. Historical
eight-family statements and legacy validator release-mode fixtures retain their
original meaning; this decision does not rewrite them or change validator code.
Known audit findings stay tracked separately from offline-delivery acceptance.
Future publication, import and learner-release work must meet their own approved
controls and report content limitations without claiming the full bank is verified.

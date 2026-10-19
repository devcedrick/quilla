# ADR 0003: Use a Changeable Preferred Level and Select Level per Attempt

- **Status:** Accepted
- **Date:** 2026-10-20
- **Decision owners:** Quilla maintainers
- **Related issues:** [S02.1 / #20](https://github.com/devcedrick/quilla/issues/20), [S02.4 / #23](https://github.com/devcedrick/quilla/issues/23)

## Context

Quilla supports Professional and Subprofessional preparation. Learners need a useful default during onboarding and may later prepare for the other level or choose it for one activity. The policy must preserve historical attempts and mastery evidence while keeping level-specific coverage, diagnostics, and readiness meaningful.

S02.1 resolves the open level-selection decision in [FEATURES](../FEATURES.md) and provides the policy prerequisite for S02.4. This ADR records approved planned behavior; it does not claim that onboarding or attempts are implemented.

## Decision

Onboarding records a changeable preferred level. Every new attempt explicitly confirms its own level, initially defaulting to that preference. Choosing a different level for one attempt does not update the preference.

Learners without a saved preference complete onboarding level selection and are directed to that level's diagnostic. Later preference changes update future attempt defaults and the default dashboard context while preserving the optional target exam date, historical attempts, and mastery evidence.

Before a preference change is confirmed, explain that progress and history remain available and that guidance and readiness for the other level require its own submitted diagnostic. Clearly label the level on attempt confirmation, active attempts, history, guidance, and readiness. If the requested level lacks a submitted diagnostic, explain the lock and offer its diagnostic.

### Behavioral contracts

- **Profile:** The preferred level supplies defaults; it is not the source of truth for an existing attempt's level.
- **Attempt:** Each attempt owns one immutable Professional or Subprofessional level. Preference changes preserve its served questions, question versions, blueprint snapshot, saved answers, and deadline. Resume, submission, scoring, and review use its stored context.
- **Diagnostic:** Completion belongs to a learner and level. Only a submitted diagnostic for the requested level unlocks its guidance and readiness. Shared mastery and the other level's diagnostic do not satisfy the gate. Returning to a previously assessed level retains eligibility.
- **Mastery:** Evidence belongs to a learner and canonical concept. Reuse evidence for a genuinely shared concept across levels, retaining originating attempt, level, question-version, and served-concept provenance. Distinct concepts remain separate. Preference changes and later diagnostics never reset or delete evidence, and retries never double-count it.
- **Derived views:** Guidance and readiness use the requested level's coverage and blueprint, applicable shared mastery, and, where mock performance is used, only that level's mock results. Relevant submissions refresh affected derived views, including both levels when shared evidence changes, while respecting each diagnostic gate.
- **History and eligibility:** Attempts remain discoverable with their original level and snapshots across preference changes. Professional attempts exclude Clerical Ability; Subprofessional attempts exclude Analytical Ability. Shared concept evidence never makes an otherwise ineligible question eligible.

These contracts guide later schema and API work; this issue introduces no runtime API, schema, migration, or UI implementation.

## Transitions and review scenarios

The following cases are acceptance scenarios for downstream implementation and a review checklist for this decision. Each applies symmetrically to both levels.

| Scenario                                                             | Expected behavior and learner-facing consequence                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New learner or account with no saved preference selects either level | Save the preference, preserve any valid optional target date, and direct the learner to that level's diagnostic. Guidance and readiness stay locked until submission.                                           |
| Learner chooses the other level for one new attempt                  | Show the selected level for confirmation and create the attempt with that level. The saved preference and default dashboard context stay the same.                                                              |
| Learner changes preference while a diagnostic is active              | Update future defaults while preserving the diagnostic's level, snapshots, answers, and deadline. Completing it unlocks its original level, not the newly preferred level.                                      |
| Learner changes preference while a mock exam is active               | Resume and submit the original exam unchanged; record the result against its original level. Do not transfer its score to the newly preferred level.                                                            |
| Learner switches to a level without a submitted diagnostic           | Retain all evidence and history, explain that this level's guidance and readiness are locked, and offer its diagnostic. Shared evidence cannot bypass the gate.                                                 |
| Learner returns to a previously assessed level                       | Retain that level's diagnostic eligibility and recompute its views from applicable current evidence. Do not require another diagnostic solely because the preference changed.                                   |
| Learner practices a concept shared by both levels                    | Reuse submitted evidence for the same canonical concept in both applicable views, retaining provenance. Keep incompatible subjects and the other level's mock scores out of the requested level's calculations. |
| Learner reopens an old attempt after several preference changes      | Show the attempt's original level, result, and exact served snapshots. History remains discoverable across levels; viewing it does not update mastery.                                                          |
| Learner submits another diagnostic or retries a submission           | Add new submitted evidence once without resetting prior mastery. A retry cannot duplicate evidence or change the attempt's original level.                                                                      |

## Consequences

Learners can prepare for either level without another account, preserve relevant learning across a switch, and distinguish a one-time attempt choice from their study preference. Immutable attempt context protects active work and historical results.

Downstream implementation must track diagnostic completion per learner and level rather than with a single account-wide completion flag. Guidance and readiness must identify their level and refresh when applicable shared evidence changes. A learner preparing for both levels must submit two diagnostics even when some concepts overlap.

Mastery sharing depends on canonical concept identity, not matching labels or broadly similar subjects. Sharing evidence does not imply that scores or blueprint weights are interchangeable.

## Alternatives considered

- **Fix level at onboarding:** Simplifies defaults but prevents legitimate changes and one-time practice at the other level without an account or support workaround.
- **Allow a changeable study level only:** Supports switches but makes every one-time attempt choice change the learner's ongoing study context.
- **Use one diagnostic for the account:** Reduces assessment effort but could unlock readiness without assessing the other level's distinct coverage.
- **Separate all mastery by level:** Simplifies isolation but discards useful evidence for the same canonical concept when the learner changes level.

## Boundaries and follow-up

S02.4 must apply this policy to onboarding and feature gates; later attempt and learning work must preserve these contracts. This decision resolves the level-policy dependency only; it does not resolve S02.4's other prerequisites.

The weighting of questions applicable to both levels, final mastery formula and minimum reliable sample size, adaptive review tuning, and retention and resume window for abandoned attempts remain open product decisions in FEATURES. This ADR defines no new expiry, reset, weighting, or retake requirement for them.

Changes to this accepted policy require a new ADR rather than rewriting this decision.

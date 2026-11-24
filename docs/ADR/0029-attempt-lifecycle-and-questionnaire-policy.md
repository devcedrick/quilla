# ADR 0029: Finalize Timed Attempts at the Deadline and Keep Questionnaires Unscored

- **Status:** Accepted
- **Date:** 2026-11-20
- **Decision owners:** Quilla maintainers
- **Related issues:** [S07.1 / #53](https://github.com/devcedrick/quilla/issues/53), blocks [S07.2 / #54](https://github.com/devcedrick/quilla/issues/54), parent [#7](https://github.com/devcedrick/quilla/issues/7)
- **Builds on:** [ADR 0003](0003-exam-level-selection-policy.md), [ADR 0006](0006-application-profiles-and-authorization.md), [ADR 0010](0010-assessment-choice-order-and-scoring.md) and [ADR 0025](0025-versioned-blueprint-activation-and-attempt-snapshots.md)

## Context

S07.1 resolves the open retention and resume decision for abandoned attempts and
decides whether the Examinee Descriptive Questionnaire (EDQ) belongs in Quilla's
timed assessments. [FEATURES](../FEATURES.md) already requires server-authoritative
timing, autosave without pausing, idempotent submission and immutable attempt
snapshots. It leaves the resume and retention window unresolved, and it excludes
the EDQ from initial mocks without fully defining future questionnaire behavior.

The policy must preserve realistic exam conditions, historical integrity and
learner review access while avoiding an empty attempt that can unlock personalized
features or distort readiness. It must also keep the EDQ from ever becoming scored
content, including after a later blueprint enables it.

This ADR decides policy only. It introduces no attempts table, schema, migration,
scheduler, scoring implementation or UI. [#54](https://github.com/devcedrick/quilla/issues/54)
and its dependants implement the contract under their own authorization and review.

## Decision

### Scope

This policy applies to deadline-bearing attempts: the diagnostic assessment and
timed mock exams. Untimed adaptive practice and learner-initiated review sessions
are not given a deadline or auto-submission behavior by this ADR and must not
inherit mock finalization rules.

### Lifecycle states

| State         | Entered when                                                                                              | Resume or answer?                                | Result and evidence                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `in_progress` | The learner starts an assessment and the server stores the immutable configuration and absolute deadline. | Yes, until the server deadline, from any device. | Saved answers only. No mastery, readiness, streak or diagnostic-completion evidence exists before finalization.                                                     |
| `submitted`   | The learner submits before the deadline with at least one saved answer.                                   | No. The result is immutable.                     | The attempt is scored. Unanswered mock items are incorrect; diagnostic mastery comes only from answered items.                                                      |
| `expired`     | The deadline passes with at least one saved answer, and the server finalizes the attempt.                 | No. The result is read-only.                     | The attempt is scored automatically under the same rules as `submitted`. A diagnostic with saved answers counts as submitted.                                       |
| `abandoned`   | The deadline passes with zero saved answers.                                                              | No. No review content exists.                    | No score, mastery, readiness, streak, diagnostic completion or guidance unlock. The record is retained, and the learner may start a new attempt after the deadline. |

The persisted status may lag behind server time. No operation may treat an
over-deadline attempt as `in_progress`; reading, answering or submitting after the
deadline must first finalize it. A scheduled finalizer is a backstop, not the
source of truth.

### Resume and server timing

- Starting an assessment creates the attempt, its immutable configuration and an
  absolute server deadline. The deadline is fixed at start and is never
  recalculated from a later blueprint, preference or client clock.
- There is no pause, inactivity timer, reconnect grace or post-deadline extension.
  Disconnecting, closing the browser, losing connectivity, switching devices,
  signing out, suspension or a level-preference change does not pause or extend
  the deadline.
- Any gap is resumable while the server deadline has not passed. The learner sees
  the same served questions, saved choice order, answers and deadline on every
  authorized device.
- Only server-committed answers count. An answer write that is not committed
  before the deadline is rejected or discarded; the client's clock is never
  authoritative. Answer writes and finalization must resolve consistently when
  they race.
- A confirmation or preview screen is not an attempt. Quilla does not persist an
  attempt until the learner starts it.

### Submission, expiry and abandonment

- A learner submission requires at least one saved answer. A submission with zero
  saved answers is rejected without changing the attempt, which remains
  `in_progress` until its deadline. An empty submission is therefore never a
  pre-deadline cancel and cannot be used to draw a replacement attempt after
  seeing served questions.
- At the deadline, an attempt with saved answers finalizes as `expired`. Saved
  answers are scored; mock items without an answer count as incorrect. For the
  diagnostic, only answered items create mastery evidence, unanswered items remain
  untested, and the attempt satisfies that level's completion gate. A partially
  answered diagnostic is therefore valid but produces low-confidence evidence.
- An attempt with zero saved answers at the deadline finalizes as `abandoned`. It
  creates no score, mastery, readiness, streak or diagnostic-completion evidence,
  does not unlock guidance or readiness, and does not block a new attempt.
- An attempt cannot reach `abandoned` before its deadline. Abandonment is always a
  deadline-driven terminal state.
- Finalization is idempotent. A repeated submission, scheduled finalizer or race
  returns the same terminal result and cannot double-score or double-count
  evidence. The first terminal transition wins.
- An expired or abandoned attempt cannot accept answers, be resumed, be extended
  or be converted back to `in_progress`.

### Retention and deletion

- Terminal attempts, including `submitted`, `expired` and `abandoned`, and their
  immutable question and blueprint snapshots are retained for the life of the
  account and are not deleted by account deletion. The initial release has no
  time-based purge.
- Learners have no delete control for attempts. Admins cannot hard-delete attempts
  or rewrite their results. Historical questions, versions and snapshots remain
  protected by the existing no-hard-delete rules.
- Account deletion or anonymization is a separate approved workflow under
  [ADR 0006](0006-application-profiles-and-authorization.md). It may remove or
  de-identify the learner's identity and personal data, but retained attempt
  records and shared question, reference and blueprint versions remain, and
  historical results are never rewritten. `abandoned` records are not an implicit
  exception to historical integrity. "Life of the account" therefore includes
  de-identified retention after account deletion.
- A future retention change, including any purge or archival policy, requires a new
  ADR. It must not silently delete records under this policy.

### Questionnaire policy

- Initial blueprints, diagnostics and mocks use the `excluded` questionnaire mode.
  They contain no EDQ items, time allocation or responses. The immutable blueprint
  and attempt snapshots record the mode explicitly; an absent value is not a mode.
- This extends
  [ADR 0025](0025-versioned-blueprint-activation-and-attempt-snapshots.md)'s
  blueprint configuration and snapshot contract: the questionnaire mode is a
  required validated field with no implicit default, and validation rejects a
  missing or `scored` value.
- The only permitted future mode is `unscored`, and enabling it requires a new
  immutable blueprint version with an explicit configuration format. It cannot
  modify an existing blueprint or historical attempt.
- EDQ items are optional and skippable. They are not question-bank questions and
  have no correct answer, concept, difficulty, subject allocation or eligibility
  rule. They are stored as a separate response type, never mixed with scored
  answers.
- EDQ responses never affect the score, passing reference, pass/fail result,
  mastery, readiness, streaks, question analytics or adaptive recommendations.
  Unanswered EDQ items are not incorrect answers.
- For the lifecycle, submission and scoring rules above, "saved answer" and
  "mock items" mean scored answers and scored items only. EDQ responses never
  count toward submission eligibility, the expiry-versus-abandonment decision,
  scoring or completion evidence, so an attempt with only EDQ responses is
  treated as having zero saved answers.
- A `scored` questionnaire mode is invalid. Blueprint validation and scoring must
  reject or fail closed on any attempt to treat questionnaire content as scored.
- A future EDQ-enabled blueprint must define its own timing explicitly. EDQ time
  must not reduce the scored-section time or silently reuse a scaled limit that
  assumed the questionnaire was absent.
- EDQ content and responses are personal data. Their purpose, access, retention and
  deletion require a separate privacy review before collection begins.

### Relationship to accepted ADRs

- [ADR 0003](0003-exam-level-selection-policy.md) and
  [ADR 0007](0007-preparation-preferences-and-onboarding.md) describe the
  diagnostic gate as requiring a `submitted` attempt. For that gate, this ADR
  supersedes the submitted-only wording: a diagnostic that expires with saved
  answers counts as submitted. No other level, evidence-sharing or routing rule
  changes.
- This ADR resolves the "retention and resume window for abandoned attempts" item
  that ADR 0003 leaves open. Abandonment is deadline-driven, and terminal attempts
  are retained as described above.
- Accepted ADRs keep their original decision text; their headers and inline
  amendment notes point here rather than rewriting history.

### Downstream contract

- **S07.2 / #54:** snapshot the questionnaire mode; keep EDQ items outside scored
  cells and totals; derive the deadline from the immutable configuration; create no
  attempt before start.
- **S07.3 / #55:** enforce the server deadline, late-write rejection, empty-submission
  rejection, idempotent finalization, the four lifecycle states, zero-answer
  abandonment, unanswered mock scoring and diagnostic-only answered-item mastery.
- **S07.4 / #56:** display server-derived time, block resume after expiry, show
  expired and abandoned states honestly, and never expose answer keys during an
  active attempt.
- **S03.1 / #57:** apply the same lifecycle to diagnostics, including partial
  expiry, zero-answer abandonment, completion-gate behavior and retakes.
- Schema field names may differ, but the state semantics, terminal immutability,
  submission reason, timestamps and snapshot requirements are fixed by this ADR.

## Scenarios

| Scenario                                                  | Expected behavior                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Learner disconnects or closes the tab before the deadline | Resume later with the same answers, choice order, snapshots and deadline. The clock keeps running.                                    |
| Learner returns on another device before the deadline     | Resume the same attempt. No second attempt or deadline is created.                                                                    |
| Learner returns after the deadline                        | No resume and no answer writes. Any access finalizes the attempt and shows the terminal result or abandoned state.                    |
| Deadline passes with saved answers                        | Finalize as `expired`; score saved answers; unanswered mock items are incorrect; a diagnostic counts with answered-item mastery only. |
| Deadline passes with zero saved answers                   | Finalize as `abandoned`; no score, evidence, unlock or review; allow a new attempt.                                                   |
| Learner submits with no saved answers                     | Reject the submission; the attempt stays `in_progress` until the deadline and then finalizes as `abandoned`.                          |
| Manual submission and scheduled finalization race         | Both return one terminal result; no double scoring or evidence.                                                                       |
| Answer write races the deadline                           | Only a server-committed pre-deadline answer counts; no grace period.                                                                  |
| Learner is suspended with an attempt in progress          | Access is blocked, but the deadline is unchanged and finalization still follows this policy.                                          |
| Learner requests deletion of an attempt                   | No learner delete control and no admin hard delete. Account deletion is handled by the separate de-identification workflow.           |
| Future blueprint enables the EDQ                          | Require a new immutable version, `unscored` mode, separate responses and explicit timing; never affect score, mastery or readiness.   |
| Historical attempt predates an EDQ-enabled blueprint      | Keep its recorded `excluded` mode and immutable result; do not add questionnaire content retroactively.                               |

## Consequences

Learners can safely resume work after interruptions without receiving extra time.
An accidental empty start cannot unlock diagnostics or damage readiness, while a
partially answered expired attempt preserves the learner's work. Review history
remains available for the life of the account, and no lifecycle transition deletes
historical content.

The cost is that abandoned zero-answer attempts remain stored and that a learner
who starts a mock cannot discard it before the deadline without an explicit policy
change. That is acceptable for the initial release: the start confirmation is the
guard against accidental starts, and a zero-answer attempt has no learning effect.
An empty submission is rejected rather than treated as a cancel, so the learner
cannot restart after viewing the served questions. If UX testing later shows a need
for a pre-answer cancel action, it can be added without changing the deadline,
retention or evidence rules.

The EDQ remains excluded until there is a concrete product need, content source,
privacy decision and blueprint version. This avoids collecting demographic data
without a defined purpose and prevents a future questionnaire toggle from
silently changing scores or historical attempts.

## Alternatives considered

- **Add a reconnect grace or pause window:** Rejected because it would extend the
  deadline, undermine realistic timing and conflict with server authority.
- **Count every deadline expiry as submitted, including zero answers:** Rejected
  because an empty diagnostic would unlock guidance and readiness, and an empty
  mock would distort readiness without learner engagement.
- **Allow learners to delete or discard attempts:** Rejected because it would permit
  restarting after seeing questions and would conflict with historical integrity.
- **Time-box and purge terminal attempts:** Rejected for the initial release because
  it would break later review access and require a destructive retention workflow
  before storage pressure is demonstrated.
- **Include the EDQ now as an unscored survey:** Rejected because there is no
  approved content source, timing contract, UI or privacy decision, and exclusion is
  the safer initial state.
- **Allow a scored questionnaire:** Rejected because the EDQ is descriptive and the
  product must never count it toward a result.

## Boundaries and follow-up

This ADR resolves the #53 policy decision. It creates no attempt storage, exam
generator, scheduler, scoring function, questionnaire content, UI, deployment,
migration or destructive deletion. The exact diagnostic duration remains an
assessment-configuration decision. Account deletion/anonymization and any future
EDQ content, timing or retention require separate approved work. Changes to this
accepted policy require a new ADR rather than rewriting this decision.

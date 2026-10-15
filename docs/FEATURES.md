# Quilla Feature Specifications

## Purpose and status

This document describes Quilla's planned product features from the user's point of view. It is a product specification, not a claim that every feature is currently available. Implementation should proceed in phases, and a feature is complete only when its definition of done is satisfied.

The initial product supports Professional and Subprofessional Philippine Civil Service Examination preparation. Paid plans, live tutoring, native mobile apps, social feeds, and other civil-service eligibility exams are outside the initial scope.

## 1. Account, authentication, and onboarding

### Problem

Learners need a secure account so Quilla can preserve their exam level, progress, attempts, mastery, and study schedule across sessions and devices.

### User story

As a new learner, I want to create an account, choose my CSE level, and optionally set my exam date so Quilla can personalize my preparation. As a returning learner, I want to sign in and continue where I stopped.

### Edge cases

- A user signs in but has not selected an exam level.
- A user selects a target date in the past or changes levels after studying.
- A suspended account attempts to start an exam or submit content.
- A user's session expires during a saved activity.
- An admin is also a learner and must retain one identity with role-aware access.
- Personalized features are requested before the diagnostic is complete.

### Non-goals

- Building password storage or session infrastructure inside Quilla.
- Supporting roles other than `user` and `admin` in the first release.
- Requiring a paid subscription.
- Providing social profiles, followers, or public activity feeds.

### Definition of done

- Users can register, sign in, sign out, and recover access through the configured identity provider.
- New accounts receive the `user` role by default.
- Preferred level and valid target exam date are persisted.
- First-time users are directed to the diagnostic after choosing a level.
- Personalized plans and readiness are unavailable until the diagnostic is submitted.
- Backend authorization is enforced independently of client-side routing.
- Suspended users cannot take exams or contribute questions.

## 2. Diagnostic assessment

### Problem

Without a baseline, learners do not know which concepts deserve attention, and Quilla cannot provide meaningful personalization.

### User story

As a learner starting Quilla, I want an assessment across my exam coverage so I can see a mastery map and receive an initial study plan without being labeled as having passed or failed.

### Edge cases

- The question bank cannot supply at least three valid items for every subject.
- A concept has no published questions and cannot be measured.
- The learner loses connectivity or closes the browser during the diagnostic.
- The learner changes levels after completing a diagnostic.
- The assessment times out with unanswered questions.
- A served question is edited after the assessment starts.

### Non-goals

- Predicting an official CSE result from the diagnostic alone.
- Showing pass/fail language for the diagnostic.
- Measuring every concept when the question bank has insufficient coverage.
- Replacing a full timed mock exam.

### Definition of done

- The diagnostic serves 30–50 published questions across every subject for the selected level.
- Each subject receives at least three items, or the diagnostic is blocked with an actionable coverage warning.
- The target difficulty mix is approximately 50% easy, 35% medium, and 15% hard.
- Progress is autosaved and submission is idempotent.
- Submission creates initial mastery records for tested concepts, initializes review schedules, and generates a study plan.
- Untested concepts are clearly marked, and content gaps are visible to admins.
- Results present a mastery overview without pass/fail wording.

## 3. Concept mastery tracking

### Problem

Subject-level scores hide specific learning gaps. A learner may appear generally strong while repeatedly missing one important concept.

### User story

As a learner, I want my performance tracked by concept so I can understand exactly what I know, where confidence is low, and what to practice next.

### Edge cases

- A concept has only one or two answered questions, producing low confidence.
- A question is reclassified after an older attempt was submitted.
- The same concept appears across multiple practice modes.
- A submission is retried and could update mastery twice.
- A learner answers unusually quickly, but speed should not change the score in the first release.
- A concept belongs to both levels and the learner changes preferred level.

### Non-goals

- Treating response speed as mastery in the first release.
- Using a single subject score as a substitute for concept mastery.
- Claiming high confidence from a small sample.
- Exposing an opaque score with no status or supporting evidence.

### Definition of done

- Only submitted answers update mastery.
- Every update is associated with the question version and concept served during the attempt.
- Mastery remains between 0 and 1, and confidence grows with meaningful sample size.
- Status is derived consistently as unseen, learning, familiar, proficient, or mastered.
- Duplicate submissions cannot double-count answers.
- Learner views show concept status, confidence, attempt count, and recent direction.

## 4. Spaced-repetition review queue

### Problem

Learners forget material when review is based on convenience instead of timing. Weak concepts need to return sooner, while strong concepts should consume less study time.

### User story

As a learner, I want Quilla to tell me what is due today and adjust future review dates based on my answers so I can retain knowledge efficiently.

### Edge cases

- A due concept has fewer published questions than the session requires.
- Multiple reviews of the same concept are submitted close together.
- The learner misses several days and accumulates a large queue.
- The user's timezone changes.
- A question becomes flagged or archived after entering the queue.
- A concept has graduated but is later answered incorrectly in another mode.

### Non-goals

- Guaranteeing a specific official-exam score.
- Serving unpublished, archived, or excluded questions to fill a quota.
- Scheduling by individual question in the initial design; scheduling is concept-based.
- Allowing intervals outside the configured safety bounds.

### Definition of done

- Today's Review lists active concepts whose `next_review_at` is due in the learner's effective timezone.
- New schedules begin with a one-day interval.
- Correct performance lengthens intervals and incorrect performance shortens them.
- Intervals never exceed 60 days, and ease factors remain between 1.3 and 2.8.
- Completing a review updates mastery and the next schedule exactly once.
- Coverage-limited concepts serve only eligible available items and clearly explain the limitation.
- Backlogs are prioritized without creating an unmanageable single session.

## 5. Adaptive practice

### Problem

Generic practice wastes time on content that is too easy, too hard, already mastered, or irrelevant to the learner's selected exam level.

### User story

As a learner, I want to choose what and how long to practice while Quilla prioritizes due and weak concepts and adjusts difficulty as I perform.

### Edge cases

- The selected filters produce too few eligible questions.
- A concept has no unserved question left in the session.
- Due-review priorities conflict with the learner's chosen subject filters.
- Two correct or incorrect answers span different concepts.
- The learner changes an answer before submission.
- Challenge mode is selected when there are too few hard questions.

### Non-goals

- Repeating questions within the same session.
- Crossing Professional and Subprofessional subject boundaries.
- Serving unpublished, archived, or blocked questions.
- Silently ignoring the learner's explicit subject selection.
- Acting as a timed full-exam simulation.

### Definition of done

- Learners can select level, subjects, optional concepts, and session length.
- Generation prioritizes due reviews, then low mastery, then blueprint weight within selected filters.
- No question repeats within a session.
- Two consecutive correct answers step difficulty up when eligible content exists; two incorrect answers step it down.
- Challenge mode fixes the target difficulty to hard and clearly reports coverage limits.
- Submission records answer history and updates mastery and review schedules.

## 6. Timed mock exams

### Problem

Learners need realistic practice with full coverage and time pressure to understand readiness and build exam-day discipline.

### User story

As a learner, I want to take a timed exam that follows my level's blueprint so I can rehearse realistic conditions and receive an honest result.

### Edge cases

- A subject-by-difficulty blueprint cell has insufficient eligible questions.
- Connectivity is lost, the tab closes, or the browser crashes during the exam.
- The timer expires while an answer write is in flight.
- The same submission reaches the server more than once.
- A question is edited or archived while the attempt is active.
- Unanswered items remain at timeout.
- Examination Day Questionnaire items are enabled later but must remain unscored.

### Non-goals

- Pausing a full mock exam.
- Showing correctness or explanations before submission.
- Substituting invalid subjects across exam levels.
- Claiming affiliation with or reproducing an official CSC examination.
- Using the mock score as the sole readiness measure.

### Definition of done

- Exams are generated from an active blueprint using only eligible published question versions.
- Professional exams exclude Clerical Ability; Subprofessional exams exclude Analytical Ability.
- Subject distribution, difficulty mix, randomization, time limit, and passing reference come from an immutable blueprint snapshot.
- The server is authoritative for timing and auto-submits expired attempts.
- Progress is autosaved and can survive a browser interruption without extending the deadline.
- Difficulty may be relaxed when a blueprint cell is short; if coverage remains insufficient, start is blocked with an actionable message.
- Unanswered scored items count as incorrect.
- Results show overall score, pass/fail against the blueprint reference, and subject and concept breakdowns.

## 7. Post-exam review

### Problem

A score alone does not teach. Learners need to understand each mistake and connect it to the concept they should practice next.

### User story

As a learner who completed an exam, I want to review the exact questions I saw, compare answers, read explanations, and practice weak concepts.

### Edge cases

- The underlying question has been edited, unpublished, or archived.
- A source citation or distractor rationale is unavailable.
- The learner did not answer a question.
- A flagged-for-later action is repeated.
- The learner tries to open another user's attempt.

### Non-goals

- Revealing answers before an attempt is submitted.
- Reconstructing review content from the latest question version.
- Allowing review actions to change the submitted score.
- Making distractor rationales mandatory when they were not available in the served version.

### Definition of done

- Review is accessible only to the attempt owner or an authorized admin.
- Every item uses the exact served question-version snapshot.
- Review shows the learner's answer, correct answer, explanation, concept, and source citation where applicable.
- Available distractor rationales are shown without fabricating missing content.
- Learners can flag and unflag an item idempotently.
- Concept links start an eligible focused-practice flow.

## 8. Personalized daily study plan

### Problem

Learners often know they should study but not what to do next, how much to do, or why a particular activity matters.

### User story

As a learner, I want a short, explainable plan for today so I can spend my available time on the activities most likely to improve my readiness.

### Edge cases

- The learner has no target date.
- The target date is fewer than 30 days away or has passed.
- The learner skips a day or completes work outside the plan.
- Due reviews exceed the learner's reasonable daily workload.
- A recommended concept has insufficient eligible questions.
- The plan is regenerated after partial completion.

### Non-goals

- Creating a rigid calendar that punishes missed days.
- Recommending content unrelated to the selected level.
- Hiding why an activity was selected.
- Promising that plan completion guarantees passing.

### Definition of done

- One plan per learner per date is generated after the diagnostic.
- Plans consider due reviews, low mastery, blueprint weight, and target exam date.
- Plans without a target date remain balanced.
- Plans within 30 days of the target prioritize high-weight weak concepts and compressed review needs.
- Every item includes activity type, scope, item count or duration estimate, and a human-readable rationale.
- Completing or skipping an item is persisted and informs regeneration without erasing completed work.

## 9. Readiness score

### Problem

Learners need a concise view of preparedness, but a single unexplained percentage can create false confidence or unnecessary discouragement.

### User story

As a learner, I want an explainable readiness score with a confidence range and weak areas so I can decide what to improve before exam day.

### Edge cases

- The diagnostic is incomplete.
- There are too few attempts for a confident estimate.
- Recent mock performance conflicts with longer-term mastery.
- One heavily weighted subject is much weaker than the others.
- A level or blueprint changes after prior study.
- Cached readiness data becomes stale after a submission.

### Non-goals

- Guaranteeing an official outcome.
- Showing readiness before a diagnostic is complete.
- Storing an unexplained permanent score as source-of-truth data.
- Ranking learners against one another.

### Definition of done

- Readiness is unavailable until the diagnostic is submitted.
- The score combines blueprint-weighted concept mastery, recent mock performance, and review compliance.
- The view includes a confidence range, subject breakdown, weakest concepts, and plain-language explanation.
- Low evidence produces visibly low confidence.
- The score is computed from source data; any cache is invalidated by relevant updates.
- Changing level recomputes applicable analytics without deleting prior mastery.

## 10. Streaks and progress visualization

### Problem

Long preparation periods make improvement difficult to notice, which can reduce consistency and motivation.

### User story

As a learner, I want to see study consistency and mastery progress so I can recognize momentum without being pressured by competition.

### Edge cases

- Activity occurs around midnight or after a timezone change.
- Answers are saved but the attempt is never submitted.
- A learner completes several activities on one day.
- Mastery falls after previously reaching a higher state.
- A learner has no activity or insufficient mastery data.

### Non-goals

- Speed-based or public leaderboards.
- Rewarding empty logins or unsubmitted answers.
- Hiding regressions in mastery.
- Turning streak loss into a blocker for learning.

### Definition of done

- A streak day requires at least one submitted answer.
- Multiple qualifying activities on one local date count once.
- Streak calculation uses a documented effective timezone.
- Subject progress is derived from applicable concept mastery and indicates confidence or missing coverage.
- Empty and regressed states are communicated honestly and accessibly.
- Visualizations include text equivalents and do not rely on color alone.

## 11. Question contribution

### Problem

Quilla needs a growing supply of original, well-explained questions, while protecting learners from incorrect, copied, leaked, or poorly classified content.

### User story

As a learner, I want to contribute an original practice question, track its review status, respond to revision requests, and receive credit if it is published.

### Edge cases

- A contribution duplicates an existing or recently submitted question.
- A Professional question is classified as Clerical Ability or a Subprofessional question as Analytical Ability.
- The contributor is suspended during review.
- The contributor is also an admin.
- Required General Information sourcing is missing.
- The explanation simply repeats the correct option.
- The contributor edits and resubmits after a revision request.

### Non-goals

- Publishing user submissions automatically.
- Accepting leaked or actual CSE questions.
- Allowing contributors to review their own work.
- Adding comments, likes, public voting, or a contributor leaderboard in the initial release.
- Supporting multi-select questions in the first version.

### Definition of done

- The contributor accepts a versioned agreement, and acceptance time is recorded.
- The form captures level, subject, subtopic, concept, difficulty, stem, 2–6 unique options, one correct answer, explanation, and required source information.
- Submission validates taxonomy alignment, required content, suspension status, and duplicate risk.
- Valid submissions enter `pending_review` and appear in the contributor's history.
- Admins can approve, request revision with notes, or reject with a reason.
- Self-review is blocked, including when the contributor is an admin.
- Status changes notify the contributor, and published content credits them according to policy.

## 12. Question reporting and personal flags

### Problem

Learners need separate ways to bookmark difficult questions for themselves and alert Quilla about possible content-quality problems.

### User story

As a learner, I want to flag a question for my own review or report a possible error so I can revisit it and help keep the question bank trustworthy.

### Edge cases

- The same user reports the same question twice.
- Several reports arrive simultaneously and cross the auto-flag threshold.
- The question is archived while a report remains open.
- A user reports their own contribution.
- A report contains no optional comment.
- An admin dismisses one report while others remain open.

### Non-goals

- Treating a personal flag as a quality report.
- Allowing reports to edit content directly.
- Automatically declaring a reported question incorrect.
- Showing reporter identity publicly.

### Definition of done

- Personal flags persist in a private My Flags list and can be removed.
- Logged-in users can report published questions using supported reason codes.
- One report per user per question is enforced.
- Reports are grouped by question for admin review.
- Reaching the configured threshold atomically auto-flags the question and notifies admins.
- Auto-flagged questions are excluded from new sessions when that policy is enabled.
- Admins can dismiss or resolve reports with an auditable action.

## 13. Notifications

### Problem

Users and admins need timely awareness of contribution decisions, account events, and question-quality issues without repeatedly checking every screen.

### User story

As a user, I want in-app and appropriate email notifications for actions that require my attention. As an admin, I want alerts for reports and auto-flagged questions.

### Edge cases

- Email delivery fails after an in-app notification is created.
- The same domain event is retried.
- A user disables an optional email type.
- A notification links to an entity the user can no longer access.
- A template changes while queued messages exist.

### Non-goals

- Marketing campaigns or promotional messaging.
- SMS and push notifications in the first release.
- Using email delivery success as the source of truth for the domain event.
- Exposing inaccessible data through notification payloads.

### Definition of done

- In-app notifications are created for specified contribution and moderation events.
- Required security and account-status emails cannot be disabled; configurable product emails respect settings.
- Email delivery is retriable and recorded independently from the in-app notification.
- Event idempotency prevents duplicate notifications.
- Users can mark notifications read and links re-check authorization.
- Admins can configure supported email event types and versioned templates.

## 14. Admin question bank and moderation

### Problem

High-quality exams require a controlled workflow for creating, classifying, reviewing, versioning, publishing, monitoring, and retiring questions.

### User story

As an admin, I want to manage questions and contributions through explicit states and quality checks so only appropriate, explainable content reaches learners.

### Edge cases

- An edit occurs while the question is part of an in-progress attempt.
- Two admins attempt conflicting moderation actions.
- A bulk action includes items the admin cannot transition.
- A near-duplicate has different punctuation or wording.
- A published question receives a material correction.
- An admin tries to hard-delete a question.

### Non-goals

- Hard-deleting questions or rewriting historical attempt content.
- Publishing without required explanation, classification, sourcing, and quality score.
- Allowing contributors to approve their own questions.
- Treating automated duplicate detection as a final editorial decision.

### Definition of done

- Admins can search and combine filters for status, taxonomy, difficulty, level, origin, contributor, reports, and flags.
- Lifecycle transitions follow draft, pending review, needs revision, approved, published, rejected, and archived rules.
- Rejection requires a reason, and self-review is blocked.
- Editing material content creates an incremented immutable version; attempts retain their served snapshot.
- Pre-publish checks validate options, answer, explanation, taxonomy, level alignment, sourcing, quality score, and duplicate risk.
- Bulk actions validate each item and report partial failures without bypassing permissions.
- Every mutation records actor, action, entity, before state, after state, and time.

## 15. Admin blueprints and reference data

### Problem

Exam structure and content taxonomy must be centrally managed and validated so practice remains aligned with each CSE level as coverage evolves.

### User story

As an admin, I want to manage levels, subjects, subtopics, concepts, and exam blueprints so generated assessments are valid and content gaps are visible.

### Edge cases

- A blueprint's difficulty percentages do not total 100.
- Subject counts do not equal total scored items.
- A blueprint assigns Clerical Ability to Professional or Analytical Ability to Subprofessional.
- A referenced concept or subject is removed.
- A dry run exposes insufficient question coverage.
- A blueprint changes while attempts use an older version.

### Non-goals

- Hardcoding taxonomy into the client.
- Mutating configuration snapshots for existing attempts.
- Deleting referenced data without reassignment.
- Silently activating a blueprint that cannot produce a valid exam.

### Definition of done

- Authorized admins can manage levels, subjects, subtopics, concepts, and blueprints.
- Taxonomy relationships and level applicability are validated on every write.
- Referenced records cannot be deleted without an explicit safe reassignment or archival workflow.
- Blueprint totals, difficulty mix, subject eligibility, time limit, and passing reference are validated.
- Dry run displays sampled questions, subject counts, relaxed cells, and blocking coverage gaps.
- Only a valid blueprint can be activated, and attempts retain an immutable configuration snapshot.
- Gap reporting shows concepts with zero or low published-item counts.

## 16. Admin user management, settings, and audit log

### Problem

Quilla needs accountable operational controls for access, safety, policy, configuration, and incident investigation.

### User story

As an admin, I want to manage users and system settings and inspect a complete audit trail so I can operate the platform safely and explain consequential actions.

### Edge cases

- An admin attempts to suspend or demote themselves.
- The last remaining admin would lose admin access.
- A suspended user has an in-progress attempt.
- A setting changes while a workflow is already in progress.
- An audit export is large or contains sensitive fields.
- A user requests account deletion while authored contributions must be retained anonymously.

### Non-goals

- Allowing unaudited admin mutations.
- Giving admins plaintext credentials or direct access to authentication secrets.
- Hard-deleting historical attempts required by retention policy.
- Using mutable display names as audit identity.

### Definition of done

- Admins can search users and view authorized summaries of attempts, mastery, and contributions.
- Suspend, unsuspend, and role-change operations enforce safety rules and record before and after values.
- Suspended users are blocked from exams and contributions at the backend.
- Settings include disclaimer text, contribution rules, default exam settings, notification templates, and report threshold.
- Workflows snapshot settings whose later changes must not affect in-progress records.
- Every admin mutation appears in a filterable, append-only audit log.
- Audit exports enforce authorization, minimize sensitive data, and handle large result sets safely.

## 17. Learning and question analytics

### Problem

Admins need evidence about difficult concepts, review engagement, question quality, and coverage gaps to improve the learning system rather than relying on anecdotes.

### User story

As an admin, I want aggregate learning and item-quality analytics so I can prioritize content, investigate bad questions, and measure whether learners are progressing.

### Edge cases

- A question has too few answers for reliable statistics.
- Bot-like or repeated attempts distort results.
- An edited question version has different performance from prior versions.
- Small cohorts create privacy risks.
- A question has a high correct rate because it is easy, not defective.
- Analytics lag behind recent submissions.

### Non-goals

- Exposing individual learner performance publicly.
- Treating low or high correct rate alone as proof of a bad question.
- Combining materially different question versions into one misleading statistic.
- Building predictive surveillance or speed leaderboards.

### Definition of done

- Admins can view hardest concepts, review compliance, coverage gaps, and question performance.
- Item statistics include served count, answer count, correct rate, average time, and discrimination where supported.
- Metrics distinguish question versions or clearly define aggregation behavior.
- Low-sample results display confidence warnings and do not trigger definitive conclusions.
- Configured thresholds flag very easy, very hard, negative-discrimination, and heavily reported items for review.
- Aggregate views enforce privacy thresholds and authorized access.
- Analytics calculations are reproducible and document their freshness.

## Cross-feature requirements

These requirements apply to every feature above:

- **Accessibility:** target WCAG 2.1 AA, support keyboard navigation, visible focus, semantic controls, and reduced motion.
- **Reliability:** autosave exam work and make submissions idempotent where retries are possible.
- **Security:** authorize every backend operation, validate every public input, rate-limit abuse-prone workflows, and follow OWASP guidance.
- **Privacy:** comply with the Philippine Data Privacy Act, minimize personal data, and support appropriate export and deletion requests.
- **Auditability:** log every admin mutation with durable actor and entity identifiers.
- **Historical integrity:** preserve the question and blueprint versions used by submitted and in-progress attempts.
- **Content integrity:** never serve unpublished, archived, or policy-excluded questions.
- **Level integrity:** never serve Clerical Ability to Professional exams or Analytical Ability to Subprofessional exams.
- **Language:** use English for the initial interface while allowing English and Filipino question content.
- **Legal:** display the non-affiliation disclaimer and prohibit leaked or actual CSE questions.

## Open product decisions

The following remain intentionally unresolved and require explicit product decisions before their dependent work is finalized:

- minimum published-question coverage required per level and concept;
- whether contributions are visible before approval;
- final report threshold and auto-exclusion policy;
- whether a second reviewer is required beyond self-review prevention;
- retention and resume window for abandoned attempts;
- whether contributor rankings will ever be introduced;
- whether preferred level is fixed during onboarding or selectable per attempt;
- weighting of questions applicable to both levels;
- minimum sample size for reliable mastery;
- whether review scheduling will later include question-level schedules;
- whether Examination Day Questionnaire items appear in mock exams;
- final mastery update formula and spaced-repetition tuning.

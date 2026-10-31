# Quilla Feature Specifications

## Purpose and status

This document describes Quilla's planned product features from the user's point of view. It is a product specification, not a claim that every feature is currently available. Implementation should proceed in phases, and a feature is complete only when its definition of done is satisfied.

The initial product supports Professional and Subprofessional Philippine Civil Service Examination preparation. Paid plans, live tutoring, native mobile apps, social feeds, and other civil-service eligibility exams are outside the initial scope.

## 1. Public landing page and guided entry

### Problem

First-time visitors need to understand what Quilla does, why its learning approach is useful, which CSE levels it supports, and what to do next before they will create an account. A static explanation is easy to ignore, while animation without a clear narrative can distract from the decision to begin.

### User story

As a visitor, I want an engaging, guided introduction to Quilla so I can understand how it will help me prepare, trust its limitations, and confidently start my learning journey. As a returning learner, I want the same entry point to recognize me and lead me back to my next meaningful action.

### Edge cases

- A signed-in learner opens the public home page instead of the application dashboard.
- JavaScript is delayed, fails to load, or GSAP is unavailable.
- The visitor prefers reduced motion or uses an assistive technology.
- A low-powered device, narrow viewport, slow connection, or browser resize cannot sustain the full animation treatment.
- Fonts, images, or dynamic content load after scroll positions have been calculated.
- The visitor navigates away during a timeline or pinned scroll sequence.
- Authentication is temporarily unavailable after the visitor selects the primary call to action.
- A search crawler or link preview requests the page without running client-side code.

### Non-goals

- Using dark patterns, artificial urgency, misleading testimonials, or guaranteed-exam-result claims to increase registration.
- Implying affiliation with or endorsement by the Philippine Civil Service Commission.
- Hiding essential information, navigation, or calls to action behind animation completion.
- Requiring motion, pointer input, or a particular scroll behavior to understand or use the page.
- Adding continuous decorative motion, autoplay audio, or animation that competes with reading and decision-making.
- Duplicating the authenticated dashboard or exposing personalized learner data on the public page.
- Collecting landing-page conversion analytics in the initial release.
- Introducing a future analytics provider, identifier, consent interface, or event beyond the contract in [ADR 0002](ADR/0002-defer-landing-page-analytics.md) without a separate human-approved product and architecture decision.

### Definition of done

- The landing page presents a clear value proposition, supported exam levels, the diagnostic-to-guidance learning journey, adaptive learner-initiated review, mock exams, repeatable post-exam review, and the non-affiliation disclaimer.
- The narrative guides visitors through a purposeful sequence: hero and primary action, how Quilla works, supported CSE levels, learning benefits, trust and content-integrity commitments, and a final call to action.
- The primary call to action starts account creation or onboarding, a secondary action explains how Quilla works, and sign-in remains easy to find without competing with the primary path.
- Signed-in learners receive a state-aware action such as continuing onboarding, taking the diagnostic, or resuming study instead of being asked to register again.
- Coordinated hero entrances and multi-step reveals use GSAP timelines with readable labels and shared defaults; independent simple hover, focus, and color transitions remain CSS-based.
- Scroll-driven storytelling uses GSAP ScrollTrigger only where motion improves comprehension. Scroll-linked timelines place ScrollTrigger on the top-level animation, avoid unnecessary pinning, and refresh after layout-affecting content loads.
- GSAP runs only in the smallest necessary client components. React animations use `useGSAP` with scoped refs or selectors, context-safe deferred callbacks, and automatic cleanup when components update or unmount.
- Responsive and reduced-motion variants use `gsap.matchMedia()`. With `prefers-reduced-motion: reduce`, the page removes scrubbing, parallax, long travel, and nonessential sequencing while preserving all content and actions.
- Core copy, semantic structure, navigation, and calls to action are server-rendered and usable before animation initialization; delayed or failed JavaScript leaves a complete, readable page.
- Animations favor transforms and opacity, batch equivalent reveals, avoid layout-thrashing properties, limit simultaneous active tweens, and stop or clean up when off-screen or after navigation.
- Focus order, keyboard operation, screen-reader reading order, headings, landmarks, contrast, and visible focus remain correct regardless of visual animation order.
- The layout is tested across supported viewport sizes and representative low-powered mobile hardware so animation does not introduce horizontal overflow, content flashes, layout shifts, scroll traps, or blocked interaction.
- Page metadata and crawlable copy accurately describe Quilla without presenting planned capabilities as already available.
- The initial release has no landing-conversion provider, SDK, visitor identifier, analytics cookie, event emission, consent interface, retained event data, baseline, or numerical conversion target.
- Landing-page navigation, account registration, and onboarding are verified through deterministic journey and accessibility tests without depending on analytics.
- The provider-neutral future funnel contract is `landing_viewed -> landing_primary_cta_selected -> account_registration_completed -> onboarding_started`; [ADR 0002](ADR/0002-defer-landing-page-analytics.md) defines each event and the approval required before collection can begin.
- If conversion analytics is approved later, event delivery never blocks navigation, account creation, or onboarding, and measurement and experiments preserve the accessibility, privacy, legal, performance, and content-integrity requirements above.

### Landing-entry implementation boundary

- The header, hero, and closing account actions share session-aware navigation. Signed-out visitors enter registration or sign-in; active Clerk sessions receive “Go to your dashboard” linking to the currently implemented `/dashboard`.
- Session reads are request-scoped and streamed behind narrow Suspense boundaries. Public content and registration/sign-in fallback links remain available before hydration and without JavaScript; live Clerk state reconciles actions after hydration. Session-service failures retain usable account navigation without exposing diagnostics.
- Visiting the public landing page neither reads Convex profiles nor creates them. Missing-profile, active, suspended, and admin identities enter through the same dashboard route, which independently enforces profile bootstrap and application access. CTA visibility never grants authorization.
- Onboarding-, diagnostic-, and study-specific actions remain future work in their owning features once real persisted state and working destinations exist. No placeholder learner state or learning controls are introduced.
- Conversion verification uses deterministic account-entry journeys and accessibility checks. ADR 0002 remains in force: no analytics SDK, conversion events, identifiers, analytics storage, consent UI, or hidden tracking hooks.

## 2. Account, authentication, and onboarding

### Account-flow implementation boundary

- Clerk's public `/sign-in` and `/sign-up` routes own account registration, required first/last names, email-code verification, password sign-in, and recovery. The approved development configuration uses an eight-character minimum and excludes Google authentication; [the setup runbook](auth/clerk-development-setup.md) records the exact settings and evidence.
- Authenticated sessions continue through `/dashboard`, which redirects active learners without a preferred level to `/onboarding`. Quilla profiles are created idempotently on first protected access, with the `user` role and active status. Onboarding explicitly saves the preferred level and optional target date; returning learners can edit them at `/account/preferences`. Diagnostics and personalized study features remain future work.
- Protected account content checks Clerk sessions and Convex application access before server rendering, with reactive client handling for session loss, unresolved access, identity changes, and suspension. Suspended accounts retain public pages, an account notice, and sign-out only. The reserved `/admin` subtree requires active admin access but exposes no administrative features. [ADR 0004](ADR/0004-account-session-boundaries.md) records the original session boundary; [ADR 0006](ADR/0006-application-profiles-and-authorization.md) adds application authorization.
- Convex profiles use the verified canonical identity, not client-supplied IDs or role claims. Reusable active-profile, admin, and ownership guards enforce application access; ownership grants no implicit admin bypass. Role changes, suspension controls, initial-admin provisioning, and audit logging remain separate administrative work.
- Authentication entry pages share a form-shaped loading skeleton during server streaming, Clerk provider startup, and prebuilt form mounting. Server rendering and the browser's first hydration render use the same skeleton regardless of Clerk's loading timing; live provider states render only after hydration. Sign-in and sign-up placeholders match their initial field layouts, remain non-interactive and hidden from assistive technology except for one polite status message, and stop pulsing under reduced-motion preferences. Loading decoration never replaces authentication or session checks.
- Account pages use Quilla's existing paper/ink/marigold tokens, Fraunces/Manrope typography, and the approved welcoming Kuwi variant. Desktop authentication uses one rounded split-screen surface with an inset ink-blue welcome panel and integrated cream form area; smaller screens prioritize the form with a compact brand row. Kuwi waves and blinks automatically through a locally built native Rive image mesh, without playback buttons, with offscreen/hidden-page pausing and an SVG fallback for reduced motion, no JavaScript, loading, or failure. The approved source artwork is unchanged; a fully separated vector/skeletal rig and additional interactive actions remain future work. Clerk's prebuilt step headings and verification/recovery controls retain their behavior; dashboard and error surfaces inherit compact branding without implying learning features are available. Session-aware landing actions lead to the dashboard; persisted onboarding/diagnostic/study-specific actions remain future work.

### Problem

Learners need a secure account so Quilla can preserve their exam level, progress, attempts, mastery, and personalized study guidance across sessions and devices.

### Preparation implementation boundary

- Initial setup is a guided three-step flow: choose a level, optionally set or skip a target date, then review and confirm. It has no preselected level, retains draft choices when going back, and saves only on final confirmation. Returning learners use a matching guided preference editor with saved choices, final level-change acknowledgement when needed, and Cancel without saving. Setup continues to a protected diagnostic introduction for the saved preference. The introduction states assessments are not available and offers no Start control. The dashboard and diagnostic introduction share a wider account overview with meaningful navigation, saved preferences, diagnostic next steps, and truthful locked-feature messaging without fabricated progress.
- Target dates are `YYYY-MM-DD` civil dates, validated server-side against today in Asia/Manila (today allowed). Omitted updates preserve the date, explicit clearing removes it, and newly supplied dates reject past/impossible values. An unchanged saved date may remain after passing and does not undo onboarding.
- Own-preference reads/writes require an active application profile. Level changes explain and acknowledge retained history/progress and the per-level diagnostic prerequisite. They change future defaults only, never identity, role, suspension, prior evidence, or active/historical attempt context.
- Guidance/readiness gates currently fail closed for both levels because no authoritative submitted-attempt evidence exists yet. #57 must connect the evidence reader and access query to actual per-level submissions; no completion flag, test unlock endpoint, or synthetic assessment store is introduced. Positive unlocking, assessment delivery, and study-specific landing actions remain future work. [ADR 0007](ADR/0007-preparation-preferences-and-onboarding.md) records these boundaries.

### User story

As a new learner, I want to create an account, choose my CSE level, and optionally set my exam date so Quilla can personalize my preparation. As a returning learner, I want to sign in and continue where I stopped.

### Edge cases

- A user signs in but has not selected an exam level.
- A user selects a target date in the past or changes levels after studying.
- A suspended account attempts to start an exam or submit content.
- A user's session expires during a saved activity.
- An admin is also a learner and must retain one identity with role-aware access.
- Personalized features are requested for a level whose diagnostic is incomplete, even though the other level has a submitted diagnostic.
- The learner changes preferred level while a diagnostic or mock exam is active.

### Non-goals

- Building password storage or session infrastructure inside Quilla.
- Supporting roles other than `user` and `admin` in the first release.
- Requiring a paid subscription.
- Providing social profiles, followers, or public activity feeds.

### Definition of done

- Users can register, sign in, sign out, and recover access through the configured identity provider.
- New accounts receive the `user` role by default.
- Onboarding persists Professional or Subprofessional as the learner's changeable preferred level and an optional valid target exam date. Learners with no saved preference must complete level selection.
- First-time users are directed to the diagnostic for their chosen level.
- The preferred level supplies future attempt defaults and the default dashboard context. Each new attempt shows its selected level for explicit confirmation before starting; selecting another level for one attempt does not change the preference.
- Learners can change their preference after onboarding. The change explains that history and mastery are retained and that the newly preferred level requires its own submitted diagnostic to unlock guidance and readiness; the optional target date is preserved.
- Personalized study guidance and readiness are unavailable for a level until that learner submits a diagnostic for that level. Returning to a previously assessed level retains its diagnostic eligibility.
- Changing preference never changes an active attempt's level, served questions, blueprint snapshot, saved answers, or deadline; resume and submission use the attempt's stored context.
- [ADR 0003](ADR/0003-exam-level-selection-policy.md) defines the level-selection policy and transitions.
- Backend authorization is enforced independently of client-side routing.
- Suspended users cannot take exams or contribute questions.

## 3. Diagnostic assessment

### Shared assessment choice-order policy

The following planned contract applies to diagnostics, adaptive practice, timed
mock exams, and learner-initiated review sessions that serve questions. It does
not claim that assessment generation or choice shuffling is already implemented.

- A choice's stable `choiceId` identifies its content within an immutable question
  version. Its stored array position and ID spelling (including `a`, `b`, `c`, or
  `d`) do not establish its displayed answer letter.
- On first serving an eligible question in an attempt, the backend generates and
  persists a random permutation of its choice IDs. The interface renders that
  saved order and derives visible A–F labels from positions. Refresh, navigation,
  resume, and historical review reuse the same order; rendering never reshuffles
  an already served item. Adaptive sessions apply this when each new item is served.
- Answers submit the selected stable choice ID. The backend verifies attempt
  ownership and membership in the served question's choices, then scores against
  the exact served version's correct choice ID. Client-provided letters, indices,
  correctness claims, and permutations are not authoritative.
- Active-assessment responses omit correct choice IDs, answer keys, and
  explanations until the activity's authorized feedback/review stage. The client
  does not need the correct choice to shuffle or display options.
- Order-dependent choices, such as "both A and B" or "all of the above", must
  retain their authored order unless rewritten and independently validated for
  shuffling. Eligibility must be explicitly represented and validated in future
  question-version/lifecycle work; the initial corpus JSON contract does not yet
  define a shuffle-policy field. Do not infer an exemption from fragile text matching.
- Use an unbiased permutation for eligible choices. Randomization removes a fixed
  authored-position bias but does not guarantee equal correct-answer counts per
  displayed letter in any one attempt. Exact A–D balancing is not a requirement.

Acceptance tests must prove that reordered choices retain their correct scoring,
saved orders survive refresh/resume/review, invalid choice IDs are rejected,
exempt items retain their order, and active responses do not leak answer keys.
Randomization tests should use controlled randomness and permutation invariants,
not flaky expectations about one small sample's answer-letter distribution.

See [ADR 0010](ADR/0010-assessment-choice-order-and-scoring.md) and the
[corpus authoring guide](content/exam-set-corpus.md#choice-identity-and-display-order).

### Problem

Without a baseline, learners do not know which concepts deserve attention, and Quilla cannot provide meaningful personalization.

### User story

As a learner starting Quilla, I want an assessment across my exam coverage so I can see a mastery map and receive initial study guidance without being labeled as having passed or failed.

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
- Diagnostic completion is tracked per learner and level. Shared mastery or a submitted diagnostic for the other level does not satisfy this requirement.
- Submission unlocks guidance and readiness for the attempt's stored level, even if the learner has changed their preference during the attempt.
- Submission creates or updates mastery evidence for tested concepts without erasing prior evidence, initializes or updates adaptive review priorities, and generates personalized study guidance for the assessed level. Retaking a diagnostic preserves prior evidence, and submission retries cannot double-count it.
- Untested concepts are clearly marked, and content gaps are visible to admins.
- Results present a mastery overview without pass/fail wording.

## 4. Concept mastery tracking

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
- Every update retains the originating attempt, its level, and the question version and canonical concept served during the attempt.
- Mastery evidence belongs to the learner and canonical concept. Evidence for the same concept genuinely shared by both levels is reused across levels; distinct concepts, including level-specific concepts, remain separate.
- Changing preferred level or submitting another diagnostic never deletes or resets prior mastery evidence. Shared evidence does not unlock another level's diagnostic-dependent features.
- Mastery remains between 0 and 1, and confidence grows with meaningful sample size.
- Status is derived consistently as unseen, learning, familiar, proficient, or mastered.
- Duplicate submissions cannot double-count answers.
- Learner views show concept status, confidence, attempt count, and recent direction.

## 5. Adaptive spaced-review recommendations

### Problem

Learners benefit when each review reflects what they are most likely to forget, but fixed review dates and overdue backlogs can turn useful guidance into pressure. Weak concepts should be more likely to return in the learner's next session, while strong concepts should consume less study time.

### User story

As a learner, I want Quilla to recommend what to review whenever I choose to start a session and explain which areas I should expect, so I can study at my own pace while still benefiting from adaptive review.

### Edge cases

- A high-priority concept has fewer published questions than the learner's chosen session length requires.
- Multiple reviews of the same concept are submitted close together.
- The learner returns after a long period without reviewing.
- The learner's timezone changes or device clock is inaccurate.
- A question becomes flagged or archived after its concept is recommended.
- A concept has graduated but is later answered incorrectly in another mode.

### Non-goals

- Guaranteeing a specific official-exam score.
- Serving unpublished, archived, or excluded questions to fill a quota.
- Maintaining adaptive review state for individual questions in the initial design; recommendations are concept-based.
- Presenting a recommendation as an appointment, deadline, overdue task, or required backlog.
- Penalizing a learner for starting review sessions less frequently than Quilla recommends.

### Definition of done

- Learners can start a review session at any time and choose its length within supported limits.
- Before a session starts, Quilla previews the concepts likely to appear and gives a human-readable reason for each recommendation without promising exact questions.
- Session recommendations are calculated when requested from concept mastery, confidence, prior recall, question difficulty, elapsed time since relevant practice, eligible content, and the learner's selected filters.
- Weaker or less confidently retained concepts receive higher priority, while consistently demonstrated concepts appear less often.
- A long gap may change recommendation priority but never creates overdue work, required catch-up, or a blocked learning experience.
- Completing a review updates mastery and adaptive recommendation state exactly once.
- Coverage-limited concepts serve only eligible available items and clearly explain the limitation.
- Recommendations respect the learner's chosen session length and never expand into an unmanageable catch-up session.

## 6. Adaptive practice

### Problem

Generic practice wastes time on content that is too easy, too hard, already mastered, or irrelevant to the learner's selected exam level.

### User story

As a learner, I want to choose what and how long to practice while Quilla prioritizes recommended and weak concepts and adjusts difficulty as I perform.

### Edge cases

- The selected filters produce too few eligible questions.
- A concept has no unserved question left in the session.
- Adaptive review priorities conflict with the learner's chosen subject filters.
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
- The level initially defaults to the learner's preference and is explicitly confirmed for each new attempt without updating that preference. All subject and concept filters must be eligible for the attempt's selected level.
- Generation prioritizes adaptive review recommendations, then low mastery, then blueprint weight within selected filters.
- No question repeats within a session.
- Served questions follow the shared assessment choice-order policy in section 3.
- Two consecutive correct answers step difficulty up when eligible content exists; two incorrect answers step it down.
- Challenge mode fixes the target difficulty to hard and clearly reports coverage limits.
- Submission records answer history and updates mastery and adaptive review state.

## 7. Timed mock exams

### Problem

Learners need realistic practice with full coverage and time pressure to understand readiness and build exam-day discipline.

### User story

As a learner, I want to take a timed exam that follows my level's blueprint so I can rehearse realistic conditions and receive an honest result.

### Initial mock-blueprint policy

Under [ADR 0013](ADR/0013-seeding-families-and-pooled-exam-selection.md), a seeding family is an authoring batch, not an exam set. Each of eight families contains 270 unique questions: 40 General Information, 50 Verbal, 60 Numerical, 80 Analytical, and 40 Clerical, for 2,160 unique questions overall. Family 01 is complete for seeding by maintainer confirmation; Families 02–08 use the same subject totals. It need not independently match an exam's item counts or difficulty cells.

Each mock randomly selects eligible published versions from all seed families combined, subject to the exam blueprint, without a single-family or equal-family quota. Professional retains 20 General, 50 Verbal, 40 Numerical, and 40 Analytical items (150 total); Subprofessional retains 20 General, 50 Verbal, 35 Numerical, and 40 Clerical items (145 total). The new pooled selection contract uses `cse-professional-2027-v3` and `cse-subprofessional-2027-v3`, with `cse-taxonomy-2027-v2`. Historical v1/v2 policies and attempts are preserved. Runtime and validator adoption remain pending.

The initial mocks exclude the unscored 20-item Examinee Descriptive Questionnaire. Professional mocks use a 168-minute limit and a 120-of-150 passing reference; Subprofessional mocks use 141 minutes and a 116-of-145 passing reference. These are Quilla preparation policies derived from the official structure, not claims about CSC's rating methodology or guarantees of eligibility.

Each generated exam targets a 30/50/20 easy/medium/hard mix using fixed subject, language, and difficulty cells. Verbal contains 25 English and 25 Filipino items. Every applicable concept appears at least once per generated exam. A canonical question has one seed-family origin, but may appear in different attempts across eligible levels; it cannot appear twice inside one attempt. Different exams need not be disjoint. New seeding still targets honest difficulty proportions, but family completion is separate from pooled exam feasibility and never justifies inflated labels.

Activation requires integration of the planned eight 270-question seed families and a dry run proving each level's exam can be assembled from the combined eligible published pool. It does not require eight simultaneously disjoint exam pairs or an exam from each seed family. Pooled shortages can block exam readiness without reopening a completed family. After activation, difficulty fallback remains within the same subject, nearest difficulty first and easier on a tie. Level, subject, language, and concept requirements never relax; unresolved shortages block generation with an actionable report.

[ADR 0008](ADR/0008-initial-cse-taxonomy-and-blueprint-policy.md) records the historical paired-family policy; ADR 0013 supersedes its family, corpus-size, and assembly rules. The current contract is [Initial CSE Taxonomy and Mock-Exam Blueprints](exams/cse-taxonomy-and-blueprints.md). [Seeding families](content/seeding-families.md) defines authoring completion and the Family 01 inventory.

[ADR 0011](ADR/0011-numerical-data-sufficiency.md) adds shared concept Data Sufficiency (`data_sufficiency`). Under ADR 0013, each generated exam includes it in the 35-item shared Numerical selection from the pooled bank; Numerical Reasoning retains its concept minimum. Numerical exam totals and difficulty cells do not change. No additional fixed concept split is selected. Existing metadata and validator code are not migrated by this documentation.

[ADR 0012](ADR/0012-clerical-alphabetizing-and-spelling.md) adds Alphabetizing (`alphabetizing`) and groups Spelling (`spelling`) under Clerical Operations (`clerical_operations`). Both are English and Subprofessional only. Spelling retains its identity and historical classifications. The general Clerical Operations concept remains; the minimum applies to all three per generated Subprofessional exam under ADR 0013, without changing the 40-item exam total or 12/20/8 cells. No additional fixed concept quota is selected. Validator and pooled selection support remain pending.

### Edge cases

- A subject-by-difficulty blueprint cell has insufficient eligible questions.
- Connectivity is lost, the tab closes, or the browser crashes during the exam.
- The timer expires while an answer write is in flight.
- The same submission reaches the server more than once.
- A question is edited or archived while the attempt is active.
- Unanswered items remain at timeout.
- Examinee Descriptive Questionnaire items are enabled later but must remain unscored.

### Non-goals

- Pausing a full mock exam.
- Showing correctness or explanations before submission.
- Substituting invalid subjects across exam levels.
- Claiming affiliation with or reproducing an official CSC examination.
- Using the mock score as the sole readiness measure.

### Definition of done

- Exams are generated from an active blueprint using only eligible published question versions.
- Each new mock exam explicitly confirms its level, initially defaulting to the learner's preference, and stores that level with its immutable blueprint snapshot. Later preference changes do not alter the attempt or transfer its score to the other level.
- Professional exams exclude Clerical Ability; Subprofessional exams exclude Analytical Ability.
- Subject distribution, difficulty mix, randomization, time limit, and passing reference come from an immutable blueprint snapshot.
- Choice display and scoring follow section 3's shared assessment choice-order policy; saved choice order is part of the served item snapshot.
- The server is authoritative for timing and auto-submits expired attempts.
- Progress is autosaved and can survive a browser interruption without extending the deadline.
- Difficulty may be relaxed only within the same subject using the active blueprint's ordered fallback; level, subject, language, and concept requirements remain fixed, and unresolved coverage gaps block start with an actionable message.
- Unanswered scored items count as incorrect.
- Results show overall score, pass/fail against the blueprint reference, and subject and concept breakdowns.

## 8. Post-exam review and history

### Problem

A score alone does not teach. Learners need to understand each mistake, connect it to the concept they should practice next, and return to that learning record whenever they want to review it again.

### User story

As a learner who completed an exam, I want to review the exact questions I saw, compare answers, read explanations, and practice weak concepts immediately or whenever I revisit the attempt later.

### Edge cases

- The underlying question has been edited, unpublished, or archived.
- A source citation or distractor rationale is unavailable.
- The learner did not answer a question.
- A flagged-for-later action is repeated.
- The learner returns to a submitted attempt long after completing it.
- The learner tries to open another user's attempt.

### Non-goals

- Revealing answers before an attempt is submitted.
- Treating review as a one-time results screen that is available only immediately after submission.
- Reconstructing review content from the latest question version.
- Allowing review actions to change the submitted score.
- Making distractor rationales mandatory when they were not available in the served version.

### Definition of done

- Submitted attempts remain discoverable in the learner's attempt history and can be reopened for review any number of times whenever the learner chooses while the historical attempt is retained.
- History identifies each attempt's original level and preserves its served snapshots across preference changes; the current preference does not hide attempts from the other level.
- Review is accessible only to the attempt owner or an authorized admin, including on later visits.
- Review access does not depend on entering from the immediate submission result and does not expire after the first opening.
- Leaving and reopening a review preserves the same submitted result and does not consume or invalidate review access.
- Viewing a historical review does not update mastery or adaptive recommendation state; only newly submitted answers from a separate eligible activity can do so.
- Every item uses the exact served question-version snapshot.
- Review preserves the original displayed choice order and answer-letter mapping under section 3's shared assessment choice-order policy.
- Review shows the learner's answer, correct answer, explanation, concept, and source citation where applicable.
- Available distractor rationales are shown without fabricating missing content.
- Learners can flag and unflag an item idempotently.
- Concept links start an eligible focused-practice flow.

## 9. Personalized study guidance

### Problem

Learners often know they should study but not what to do next, how much to do, or why a particular activity matters.

### User story

As a learner, I want short, explainable guidance whenever I am ready to study so I can spend my available time on the activities most likely to improve my readiness.

### Edge cases

- The learner has no target date.
- The target date is fewer than 30 days away or has passed.
- The learner returns after a gap or completes work outside the current guidance.
- Recommended reviews exceed the learner's chosen session length or available time.
- A recommended concept has insufficient eligible questions.
- The guidance is regenerated after partial completion.

### Non-goals

- Creating a rigid calendar, assigning mandatory study dates, or punishing inactivity.
- Recommending content unrelated to the selected level.
- Hiding why an activity was selected.
- Promising that completing the guidance guarantees passing.

### Definition of done

- Guidance is available for a requested level only after the learner submits that level's diagnostic and is regenerated on demand or after relevant learning activity. The dashboard defaults to the preferred level and clearly identifies the level being viewed.
- Guidance uses the requested level's coverage and blueprint and applicable shared concept evidence. Changing preference selects a different level context without deleting prior evidence or bypassing that level's diagnostic gate.
- Guidance considers adaptive review priorities, low mastery, blueprint weight, the learner's available time, and an optional target exam date.
- Guidance without a target date remains balanced and does not impose an artificial calendar.
- Guidance requested within 30 days of the target recommends high-weight weak concepts and more focused review without creating mandatory sessions.
- Every item includes activity type, scope, item count or duration estimate, and a human-readable rationale.
- Completing, dismissing, or replacing a recommendation informs regeneration without erasing completed work or lowering readiness solely because it was not followed.

## 10. Readiness score

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

- Readiness is unavailable for a requested level until the learner submits that level's diagnostic, even when shared mastery or another level's diagnostic exists.
- The score uses the requested level's coverage and blueprint and combines applicable concept mastery (including genuinely shared evidence), recent mock performance from that same level, and demonstrated recall in eligible learner-initiated review sessions; adherence to recommended dates or frequency is not scored.
- The view includes a confidence range, subject breakdown, weakest concepts, and plain-language explanation.
- Low evidence produces visibly low confidence.
- The score is computed from source data; any cache is invalidated by relevant updates.
- Changing the viewed level recomputes applicable analytics without deleting prior mastery or transferring level-specific mock scores. Relevant submissions refresh affected derived guidance and readiness views, including both levels when shared concept evidence changes, while preserving each level's diagnostic gate.

## 11. Streaks and progress visualization

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

## 12. Question contribution

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

## 13. Question reporting and personal flags

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

## 14. Notifications

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

## 15. Admin question bank and moderation

### Shared reference contract

S19.1 defines an offline versioned JSON corpus with separately stored immutable
references for passages, tables, graphs, and diagrams. Each question version may
link to one exact reference version containing ordered text, table, and PNG/WebP
image blocks. References belong to one family/module and do not increase question
counts or scores. Shared-core references may serve both variants of their family.

Questions sharing a reference may be selected and placed separately; each must
bring its complete reference and remain answerable without another question's
answer. Item-range directions derive from actual attempt positions. Future
attempts preserve question versions, reference versions, and asset checksums;
adopting a changed reference requires a new question version. Images require
accessible equivalent content. Serving queries withhold answers and explanations
until authorized review. These runtime guarantees remain planned behavior.

See [the authoring contract](content/exam-set-corpus.md) and
[ADR 0009](ADR/0009-immutable-shared-question-references.md). S19.1 provides offline
validation only; it does not implement import, publication, storage, or rendering.

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

## 16. Admin blueprints and reference data

### Initial reference-data policy

The initial taxonomy is `cse-taxonomy-2027-v1`. It uses stable identifiers for both levels, five subjects, three difficulties, two question languages, product-defined subtopics, and ten canonical concepts aligned with the maintainer-supplied preparation reference. The reference headings are organizational input rather than official CSC facts. General Information, Verbal Ability, and Numerical Ability are shared; Analytical Ability is Professional only; Clerical Ability is Subprofessional only. Spelling remains a Clerical concept even though the reference groups it with idiomatic expressions and grammar.

Official CSC facts and Quilla-authored policy values remain distinguishable. Maintainers review every applicable official announcement and advisory before each exam cycle and before initial blueprint activation. A changed official fact or material product-policy change creates a new immutable taxonomy or blueprint version; an unchanged annual review is recorded without manufacturing a new version. Existing attempt snapshots are never rewritten.

The authoritative initial contract is [Initial CSE Taxonomy and Mock-Exam Blueprints](exams/cse-taxonomy-and-blueprints.md), governed by [ADR 0008](ADR/0008-initial-cse-taxonomy-and-blueprint-policy.md).

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

## 17. Admin user management, settings, and audit log

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

## 18. Learning and question analytics

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

- Admins can view hardest concepts, aggregate review engagement and outcomes, coverage gaps, and question performance without treating recommendation adherence as compliance.
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
- **Historical integrity:** preserve the immutable level and question and blueprint versions used by submitted and in-progress attempts. Preference changes do not alter their saved answers, deadlines, or resume and submission context.
- **Content integrity:** never serve unpublished, archived, or policy-excluded questions.
- **Level integrity:** never serve Clerical Ability to Professional exams or Analytical Ability to Subprofessional exams.
- **Level context:** the profile preference supplies defaults; each attempt owns its immutable level; diagnostic completion belongs to a learner and level; mastery evidence belongs to a learner and canonical concept, with provenance retained. Apply [ADR 0003](ADR/0003-exam-level-selection-policy.md) consistently across learning features.
- **Language:** use English for the initial interface while allowing English and Filipino question content.
- **Legal:** display the non-affiliation disclaimer and prohibit leaked or actual CSE questions.

## Open product decisions

The following remain intentionally unresolved and require explicit product decisions before their dependent work is finalized:

- whether contributions are visible before approval;
- final report threshold and auto-exclusion policy;
- whether a second reviewer is required beyond self-review prevention;
- retention and resume window for abandoned attempts;
- whether contributor rankings will ever be introduced;
- minimum sample size for reliable mastery;
- whether adaptive review recommendations will later include question-level state;
- final mastery update formula and adaptive review-priority tuning.

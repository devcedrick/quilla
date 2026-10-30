# ADR 0007: Preparation preferences, onboarding, and conservative learning gates

- Status: Accepted
- Date: 2026-10-30
- Issue: [S02.4 / #23](https://github.com/devcedrick/quilla/issues/23)
- Builds on: ADR 0003 (level policy), ADR 0006 (application authorization)

## Decision

Extend the identity-owned Convex profile with optional `preferredLevel` (`professional` or `subprofessional`) and `targetExamDate` (`YYYY-MM-DD`). Existing profiles remain valid without a migration or assumed level. A missing level means onboarding is incomplete; no separate completion flag is stored. Identity, roles, suspension, and record ownership remain unchanged.

Only active callers may read or save their own preparation preferences. Derive ownership from verified Convex identity, never user arguments or Clerk role-like metadata. Public functions validate arguments and return values. `users.currentAccess` keeps its existing minimal contract, including its narrow suspension-status exception; suspended callers cannot read preparation preferences.

Dates are civil calendar dates, not timestamps. Validate newly supplied dates against the mutation server's current **Asia/Manila** date; today is valid. Reject malformed/impossible/past dates. Omission preserves the saved date, including an expired date; `null` clears it; a string is newly validated. A passed date does not undo onboarding. Identical retries are harmless; concurrent saves use the last successful supplied values without clearing omitted fields.

Initial onboarding explicitly selects a level with no default selection. Later level changes require a UI acknowledgement explaining future defaults, retained history/progress, and each level's independent submitted-diagnostic prerequisite. Saving preferences changes only those preference fields; it does not reset evidence or alter existing attempts. Attempt defaults are not immutable attempt context.

## Account routing and reactive behavior

Keep successful authentication and landing actions pointed at `/dashboard`. Protected resource components perform authenticated, uncached authorization and preference reads behind Suspense. Incomplete active learners are redirected to `/onboarding`; missing profiles use existing client bootstrap and refresh, never a Server Component mutation. Suspended callers receive the existing notice rather than an onboarding/sign-in loop. Completed learners revisiting onboarding return to the dashboard.

First setup saves to `/diagnostic`, a protected introduction identifying the saved level and clearly explaining that assessments are not available. It has no Start button, generated questions, score, or pretend learning functionality. Later edits at `/account/preferences` return to the dashboard. Add only these exact routes to safe-return validation. Admin authorization and unavailable administrative content remain unchanged.

The reactive application boundary remains authoritative for hiding unresolved, switched-identity, or suspended content. Preference-query failures are contained inside that boundary so its own status subscription remains mounted and can replace the subtree with a suspension notice. Local pending saves prevent another onboarding-completion subscription from racing the intended diagnostic introduction navigation. Dirty form state is retained across preference refreshes and remounted on verified profile changes.

## Diagnostic evidence boundary

No submitted-attempt store exists in S02.4. The typed diagnostic guard therefore fails closed; both levels' guidance/readiness remain locked. Do not add a completion flag, unlock endpoint, mock submission, or assessment table to demonstrate an unlock.

[#57](https://github.com/devcedrick/quilla/issues/57) must replace the conservative evidence reader and update the access query to use authoritative, indexed submitted attempts for the caller and requested level. It must cover positive eligibility and retain prior-level eligibility without allowing shared mastery or another level's diagnostic to bypass the gate. Each future guidance/readiness function must independently enforce the backend guard. This ADR does not claim those views, attempts, or successful unlocking are implemented.

## Alternatives and consequences

- A required schema field/backfill would assign an unchosen level to existing accounts; optional fields preserve explicit selection.
- A timestamp target date or browser-local validation would create timezone disagreements; fixed Manila civil dates provide one testable boundary without collecting a timezone preference.
- A global diagnostic-completion flag would violate ADR 0003's per-level contract; a fabricated per-level completion record would create false evidence before assessments exist.
- Public landing profile reads are unnecessary: the protected dashboard remains the onboarding gateway.
- New schema/functions require exact-target development approval and verification before browser journeys. Production deployment, real operational controls, and data cleanup remain separately gated.

## Verification

Cover legacy profiles, both levels, date set/omit/clear, expired-date preservation, calendar boundaries/leap dates, repeated/concurrent saves, caller isolation, malicious arguments, suspension (including admins), backend lock denial, server redirects without protected payloads, bootstrap, reactive identity/status/preferences, save retries, and responsive keyboard-accessible journeys. Use prepared and unonboarded synthetic fixtures separately and retain no authentication recordings or session artifacts. Require independent authorization review and human review before merge.

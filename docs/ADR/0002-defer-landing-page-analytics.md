# ADR 0002: Defer Landing-Page Analytics for the Initial Release

- **Status:** Accepted
- **Date:** 2026-10-17
- **Decision owners:** Quilla maintainers

## Context

The public landing page should help first-time visitors understand Quilla and move confidently toward account creation. Measuring that journey could eventually help the maintainers find confusing steps, but analytics is not required to deliver Quilla's educational value in the initial release.

Adding an analytics provider now would create a new data-processing boundary, consent and notice obligations, retention work, vendor configuration, and ongoing review. Quilla currently has neither an approved analytics provider nor an implemented landing-page or onboarding funnel. Collecting behavioral data before there is a concrete product question would add cost and privacy risk without a proportionate learner benefit.

The Philippine Data Privacy Act requires personal-information processing to be transparent, legitimate, proportionate, and limited to what is necessary. The most privacy-preserving initial design is therefore not to collect landing-page conversion data.

## Decision

Quilla will not collect landing-page conversion analytics in the initial release.

- No analytics provider, tracking SDK, visitor identifier, analytics cookie, session replay, conversion event, or analytics consent interface will be added.
- Quilla has no landing-conversion analytics data owner or processor because no such data crosses an analytics boundary.
- There is no landing-conversion retention period because no event data is collected or stored.
- Landing-page navigation, registration, and onboarding must work without analytics and must not reserve a hidden tracking dependency.
- Landing-page effectiveness will initially be assessed through deterministic journey tests, accessibility checks, and voluntary usability feedback rather than behavioral tracking.
- A future analytics implementation requires a separate, human-approved product and architecture decision before any provider account, credential, SDK, identifier, consent interface, or event emission is introduced.

This decision does not prohibit operational logging that is strictly necessary for security, reliability, or authentication. Such logging must have its own documented purpose, access controls, and retention policy and must not be repurposed as conversion analytics.

## Future event contract

If conversion analytics is approved later, the canonical funnel order is:

`landing_viewed -> landing_primary_cta_selected -> account_registration_completed -> onboarding_started`

The event semantics are:

| Event                            | Meaning                                                                                                                                                                | Duplicate boundary                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `landing_viewed`                 | The public landing page is successfully rendered and visible in an eligible production browser session. Prefetches, crawlers, tests, and preview traffic do not count. | At most once per eligible analytics session.                                       |
| `landing_primary_cta_selected`   | The visitor deliberately activates the primary landing-page action by pointer or keyboard. It records intent, not successful navigation or registration.               | One event per deliberate activation; retries and double activation are suppressed. |
| `account_registration_completed` | The configured identity provider confirms creation of a new account and an authenticated session. A CTA selection or partially completed form does not count.          | At most once for the account-creation transition.                                  |
| `onboarding_started`             | The newly registered, authenticated learner successfully reaches Quilla's first onboarding screen. Prefetching or a failed navigation does not count.                  | At most once for the initial onboarding journey.                                   |

Event names and semantics are provider-neutral. They do not authorize implementation.

## Requirements for any future measurement proposal

Before the future event contract can be implemented, a proposal must:

1. Name the provider and data owner, map the complete data flow, and document applicable processor terms and hosting regions.
2. Define the lawful basis and notice. If consent is used, analytics remains off until affirmative consent; denial or withdrawal sends no events, does not impair Quilla, and does not trigger later backfilling.
3. Use a strict property allowlist. Email addresses, names, Clerk or Convex identifiers, authentication data, exam dates, answers, scores, mastery, readiness, free-form text, and unfiltered URLs or query parameters are prohibited.
4. Define production-only collection, bot and internal-traffic exclusions, duplicate handling, failure behavior, access control, retention, deletion, and provider exit procedures.
5. Ensure event delivery never blocks navigation, account creation, or onboarding and never changes their outcome.
6. Add tests for consent denial and withdrawal, duplicate renders and callbacks, pointer and keyboard activation, navigation and provider failure, preview and test exclusion, and rejection of accidental personal data.

## Baseline and target method if analytics is approved

The initial release has no conversion baseline or numerical target because it collects no conversion data. A future approved measurement phase must use the following definitions rather than inventing a retrospective baseline:

- The primary measure is the number of unique eligible, consenting anonymous landing sessions that complete registration within 24 hours divided by the number of unique eligible, consenting anonymous landing sessions.
- Signed-in learners, known bots, internal maintainers, automated tests, preview environments, and duplicate sessions are excluded from acquisition conversion.
- CTA-selection, CTA-to-registration, and registration-to-onboarding rates are reported separately so a later step cannot conceal an earlier failure.
- The baseline uses a prospectively declared collection window and minimum sample size. The observed sample size and uncertainty are reported with the rate.
- A target is approved only after the baseline is complete. It is expressed as a relative improvement over that baseline, not an arbitrary registration quota, and cannot override accessibility, privacy, truthful-copy, performance, or content-integrity requirements.

## Consequences

### Positive

- The initial release sends no visitor behavior to an analytics provider.
- Quilla avoids provider cost, analytics credentials, consent state, and retention operations while the product is still establishing its core learning experience.
- Landing-page implementation can focus on truthful content, accessibility, reliable routing, and learner value.
- The documented event contract prevents future work from silently changing the meaning or order of funnel steps.

### Trade-offs and risks

- Maintainers will not have aggregate conversion or drop-off metrics at launch.
- Landing-page improvements will rely on testing and voluntary qualitative feedback until a future measurement decision is approved.
- If analytics is later justified, Quilla must complete privacy, vendor, consent, retention, and implementation work before gathering a baseline.

## Alternatives considered

### Plausible Cloud

Plausible offers a focused, privacy-oriented analytics product, but it introduces a paid external service and a new data-processing boundary that Quilla does not currently need.

### PostHog Cloud

PostHog has a free allowance and can be configured for limited anonymous event capture. Its broader product analytics, identity, autocapture, and session-replay capabilities would require careful disabling and continuing governance. Free pricing alone does not justify collecting data without a concrete need.

### First-party analytics in Convex

Storing events in Convex would avoid a separate analytics vendor but would mix acquisition telemetry with learner application data and require schema, authorization, bot filtering, aggregation, retention, deletion, and operational work. That complexity is disproportionate for the initial release.

## Reconsideration triggers

The maintainers may propose analytics later when all of the following are true:

- Quilla has recurring real-world traffic;
- a specific product decision cannot be answered adequately through deterministic tests or voluntary usability feedback;
- the expected learner or product benefit justifies the additional processing; and
- a maintainer is prepared to own provider review, privacy notice and consent behavior, data minimization, access control, retention, deletion, and periodic audits.

Reconsideration does not reverse this ADR automatically. It requires a new ADR that supersedes this decision.

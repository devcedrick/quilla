# ADR 0006: Application profiles and authorization

- Status: Accepted
- Date: 2026-10-24
- Issue: [S02.3 / #22](https://github.com/devcedrick/quilla/issues/22)

## Context

Clerk establishes identity and manages authentication. The account flows in ADR 0004 do not provide application roles, ownership, or suspension enforcement. Quilla needs a durable learner ID and reusable guards before onboarding (#23), audit logging (#24), and administrative operations (#25).

## Decision

Convex owns a `users` profile keyed by the verified identity's `tokenIdentifier`, using an indexed unique lookup. The Convex document ID is the application ownership reference. Store only this identity key, role (`user` or `admin`), and status (`active` or `suspended`); rely on built-in creation time. Names, email addresses, and credentials remain with Clerk.

Create profiles on first protected access through the no-argument `users.ensureCurrentUser` mutation. The transaction returns an existing active profile or inserts an active `user`; retries never reset role or status. No client identity arguments or role-like JWT metadata establish application permissions. Different canonical identities never merge by email or subject alone.

The no-argument `users.currentAccess` query returns only missing-profile status, suspended status, or an active profile's ID and role. The suspended response is a deliberate exception to the default active-profile requirement, allowing an account notice without exposing learning data. Unauthenticated callers are rejected.

Reusable helpers require verified identity, an active profile, admin role, or resource ownership. Ownership checks compare against an owner ID from a server-loaded resource and grant no implicit admin bypass. Each future application operation must independently use the applicable helpers; layouts, route guards, and hidden controls are not authorization. Stable error codes distinguish unauthenticated, profile-required, suspended, forbidden, and unavailable states without returning database diagnostics.

Protected Next.js resource components forward a Clerk `convex` template token to an uncached Convex query behind Suspense. A missing profile renders a neutral bootstrap component, not protected content. That component waits for Convex authentication, calls the idempotent mutation, and refreshes the server route. Server Component rendering performs no writes. A reactive client boundary complements the server check, hiding content while access is unresolved, on identity mismatch, or after suspension. It cannot replace backend authorization.

Suspension blocks protected application content and operations, including for admins. Public pages, a suspension notice, home navigation, and sign-out remain available. Do not revoke Clerk sessions or redirect suspended accounts repeatedly to sign-in. Temporary provider/configuration failures fail closed with sanitized retry UI.

The reserved `/admin` subtree checks active application access and admin role but continues returning not-found even for admins until administrative features exist. No role-changing or suspension endpoints, bootstrap-admin command, webhook, or management UI is introduced. Operational role/suspension changes require the audit-backed follow-up work in #24/#25.

## Alternatives

- Clerk webhooks: useful for full identity synchronization but add configuration, secrets, lifecycle ordering, and data retention responsibilities not needed for these minimal profiles.
- Email or bare Clerk subject as profile key: rejected in favor of the verified canonical identity, avoiding email changes and issuer collisions.
- Clerk metadata as authority: rejected because Quilla authorization belongs to Convex and must react to application state changes independently of token refresh.
- Read-only access for suspended learners: not selected. This release permits only public/account-status access while suspended.

## Consequences and transition

- Existing Clerk accounts receive a profile on their next protected visit. Registration alone does not guarantee a profile exists.
- An active admin remains a learner under the same identity; bootstrap does not demote them. Suspended profiles cannot bootstrap back to active.
- Account deletion or recreation in Clerk does not delete or merge retained Quilla records. Identity synchronization, account deletion/anonymization, and administrative provisioning require separately designed workflows.
- Onboarding will extend application data without changing the identity key or resetting role/status. Exam-level and diagnostic policies remain governed by ADR 0003.
- Duplicate identity records fail closed; this change adds no automatic destructive repair.
- Application access now depends on a configured Clerk-to-Convex JWT integration and deployed profile functions. Approve an exact development target before deploying or creating synthetic profiles; production changes remain separately gated.
- In-memory tests can seed admins and suspended users directly without introducing runtime management or test endpoints. Synthetic development profiles may remain after their Clerk fixture is removed; do not broadly delete profiles or introduce an unaudited cleanup endpoint.

## Verification

Test repeated/concurrent creation, canonical identity separation, ignored role claims, invalid arguments, missing and suspended profiles, wrong roles, ownership without admin bypass, minimal status responses, and duplicate-record failures. Test server denial before rendering, reactive access loss, bootstrap/retry, identity changes, and unavailable providers. Preserve Clerk session, redirect, recovery, and public-page regressions.

Require independent security review and human approval of authorization boundaries. Do not cache session decisions or protected content across requests.

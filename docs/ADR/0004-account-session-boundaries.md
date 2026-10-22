# ADR 0004: Protect Account Resources with Clerk Sessions

- **Status:** Accepted
- **Date:** 2026-10-21
- **Decision owners:** Quilla maintainers
- **Related issues:** [S02.2 / #21](https://github.com/devcedrick/quilla/issues/21), [configuration / #77](https://github.com/devcedrick/quilla/issues/77), [branding / #78](https://github.com/devcedrick/quilla/issues/78)

## Context

Clerk is already integrated with the Next.js application and Convex provider, but the initial skeleton has no account routes or protected learner content. The verified development setup requires email/password authentication, both names, an eight-character minimum password, and email-code verification. Google authentication is excluded from the MVP.

Next.js 16 uses `proxy.ts` rather than `middleware.ts`, and this application enables Cache Components. Clerk's installed SDK deprecates path-matcher authorization in favor of checks at the protected resource. Quilla profiles and role/ownership/suspension rules are later work, so an authenticated account must not be mistaken for an authorized administrator.

## Decision

- Use Clerk's prebuilt, path-routed sign-in/sign-up forms, including verification and password recovery. Do not store credentials or implement custom authentication endpoints in Quilla.
- Keep `/`, `/sign-in`, and `/sign-up` public. Each protected server resource verifies its own Clerk session; neither Proxy nor a shared layout is an authorization guarantee.
- Keep Clerk's Proxy integration for verified request context and consistent local auth URLs. Validate required configuration server-side, return only public configuration, and redact provider failures.
- Treat only an authenticated, active session with a server-derived identity as eligible to render account content. Pending or inactive sessions are signed out for access decisions. Conditional security tasks remain Clerk-managed.
- Put dynamic session reads behind Suspense while leaving public shell content static. Do not cache session decisions across requests or render protected account content in fallbacks.
- Use a client session boundary to hide stale content while Clerk loads, redirects after session loss, or refreshes the server view if another identity becomes active. This complements, rather than replaces, the server check.
- Initially route successful authentication to a minimal `/dashboard` with signed-in status, preparation-status copy, and sign-out. Profiles, study progress, and onboarding are not fabricated. Later issues may replace this destination with state-aware routing.
- Accept post-authentication return destinations only within the current origin and the `/dashboard` or `/admin` namespaces. Reject unsafe encodings, external/protocol-relative URLs, and auth-page loops. Pass the sanitized destination as Clerk's forced post-auth redirect so query parameters cannot override it.
- Require authentication for the reserved `/admin` subtree, then return not-found for every authenticated user. No administrative data or actions are introduced until Quilla role enforcement exists under #22.
- Preserve the Clerk–Convex provider integration; introduce no schema, backend function, user profile, role, or application authorization mutation in this change.

## Verification and operational boundaries

Playwright setup verifies the development instance and public signing-key pairing before fixture creation, maps the existing publishable-key environment variable, and obtains a Clerk Testing Token. Tests refuse live credentials, use unique synthetic addresses and names, and clean up only matching fixture accounts. Authentication projects do not retain traces, screenshots, videos, or storage-state files containing credentials or sessions.

Tests must cover real form journeys as well as server checks, safe redirects, failure states, and real disposable-session revocation. Boundary tests model inactive/expired states; they do not replace Clerk's cryptographic verification or claim that clearing cookies is token expiry.

No Dashboard settings, secrets, CI workflows, production configuration, or live Convex deployment are changed. Security review remains required before merging the authentication boundary. Removing the new account routes can roll back the UI independently of Clerk accounts; do not delete identity records as a rollback action.

## Alternatives and consequences

- **Proxy-only authorization:** Rejected because URL matching does not secure every resource or server entrypoint; it also uses a deprecated Clerk pattern.
- **Client-only protection:** Rejected because client visibility is not authorization and can expose protected payloads.
- **Custom credential forms/session storage:** Rejected because Clerk already owns those workflows and their security requirements.
- **Immediate profile/onboarding implementation:** Deferred to #22/#23 to keep identity/session work reviewable independently.

This approach adds a small session boundary and development test integration while retaining managed authentication. Provider/network failures may temporarily prevent account access; they must fail closed and preserve a retry/home path. Final brand appearance remains #78, and learner-state landing navigation remains #69.

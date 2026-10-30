# Clerk development setup

This runbook supports completed [S02.2.1 / #77](https://github.com/devcedrick/quilla/issues/77) and the account-flow implementation in [S02.2 / #21](https://github.com/devcedrick/quilla/issues/21). It distinguishes configuration evidence from application journey verification. [FEATURES](../FEATURES.md#2-account-authentication-and-onboarding) remains the product source of truth, and [ADR 0004](../ADR/0004-account-session-boundaries.md) defines account/session boundaries.

## Account routes and verification

The account implementation adds public `/sign-in` and `/sign-up` routes with Clerk-managed email verification and password recovery. Active sessions continue to `/dashboard`; sign-out returns to `/`. The dashboard is an account-status placeholder, not a learner profile or onboarding implementation. `/admin` remains unavailable to authenticated users until Quilla roles exist.

Use `npm run test:e2e -- --project=auth` for provider-backed account tests. The Playwright setup project checks that injected credentials target development and that public signing keys match before obtaining a Testing Token or creating synthetic accounts. Missing/live credentials fail the setup. Authentication projects disable retained traces, screenshots, videos, and saved session-state files, and fixture cleanup is restricted to unique test identities. Local configuration loading preserves injected CI variables.

The default test origin remains port 3100. For a targeted smoke pass against development, start `npm run dev` on port 3000, then run `PLAYWRIGHT_PORT=3000` in the test process environment with `npm run test:e2e -- --project=auth --grep "public pages"` (PowerShell: set `$env:PLAYWRIGHT_PORT = "3000"` first, then remove that override afterward). The test runner reuses an existing local server; CI does not. Preserve the original dated evidence below rather than treating it as a claim that new browser checks passed; record current command outcomes in the implementation handoff.

### S02.2 local validation — 2026-10-21

- Lint, typecheck, Knip, changed-file Prettier checks, production build, and whitespace checks passed. Unit tests passed: 37 tests across two files.
- The complete production-mode Playwright suite on port 3100 passed: 23 tests, including development credential validation, account journeys, two-user isolation, real session revocation, and existing landing/no-JavaScript coverage.
- The targeted port-3000 development smoke passed. Additional development checks passed for password sign-in with a protected-page return query, password recovery with old-password rejection, and blocked browser-provider loading.
- Synthetic fixture cleanup completed without reported errors. No auth trace, screenshot, video, or saved session-state files were retained. Known token-bearing warnings from Clerk's testing helper are redacted while unrelated diagnostics and assertion failures remain visible.
- A local pass/fail scan found no configured server-secret value in repository files or public build assets. This targeted check is not a substitute for the PR's security scans and human authentication-boundary review.
- Remote CI and human review have not run for this uncommitted implementation. The dependency audit is not clean; the pre-existing advisory and its scope are triaged below. No production deployment or Dashboard settings change was performed.

## Confirmed configuration

The maintainer reported the following for application **quilla**, **Development**, on **2026-10-20**. The maintainer explicitly confirmed retaining the 8-character minimum and required first and last names after review.

| Setting                       | Required development configuration | Evidence                                                                           |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| Registration/access mode      | Open/public                        | Maintainer verified; unchanged                                                     |
| Email required                | Enabled                            | Maintainer verified; unchanged                                                     |
| Sign-up email verification    | Email verification code            | Maintainer verified; unchanged                                                     |
| Email/password authentication | Enabled                            | Maintainer verified; unchanged                                                     |
| Minimum password length       | 8 characters                       | Maintainer changed from 15 and explicitly retained 8                               |
| First name and last name      | Both required                      | Maintainer verified and explicitly retained                                        |
| Password recovery             | Clerk-managed email recovery       | Email/password prerequisites confirmed; recovery UI and complete reset pending #21 |

The maintainer's follow-up reports also confirmed **phone number, username, legal acceptance, MFA, and Organizations disabled**, with **allowlist, blocklist, disposable-email blocking, and general email-subaddress blocking disabled**. The two general registration protections were confirmed separately from the earlier Google-specific subaddress setting.

An 8-character minimum does not guarantee that every 8-character password is accepted: preserve any other existing Clerk password protections. Registration and test fixtures must supply both names; do not make them optional or restore the previous password minimum as an incidental implementation change. These values record the approved development setup, not an independently verified production policy.

### Google excluded from the MVP

On **2026-10-20**, the maintainer decided to exclude Google sign-up and sign-in from the MVP. The earlier report described an enabled Google connection with custom credentials selected but unset. The maintainer subsequently confirmed that **Enable for sign-up and sign-in is Off**, saved and rechecked in **quilla / Development**. This is maintainer-confirmed configuration, not an agent-observed Dashboard change.

Google Cloud project setup, custom Google OAuth credentials, and Google sign-in testing are no longer prerequisites for #77 or #21. S02.2 implements the email/password journey with the required names and email-code verification above. Verify that its prebuilt forms do not offer Google sign-up/sign-in; do not implement a custom Google flow or create Google credentials for the MVP.

## Verification status and handoff

Agent checks below were performed on **2026-10-20** using the existing local development configuration. Credential values, provider payloads, and identifiers were not printed or committed.

| Check                                                          | Status and evidence                                                                                                               | Remaining work                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Intended application and Dashboard settings                    | Maintainer-reported: quilla, Development, with the settings above                                                                 | Recheck after intentional Dashboard changes                                                                   |
| Local credentials target development                           | Passed: Clerk's authenticated instance lookup reported development                                                                | None for this check                                                                                           |
| Local publishable/secret key pairing                           | Passed: public RSA signing-key material from the publishable-key endpoint matched the authenticated Backend API JWKS              | This establishes local pairing, not CI targeting or an independent Dashboard application-name comparison      |
| Development Testing Token issuance                             | Passed: the development Backend API issued a short-lived Testing Token                                                            | Token was held in memory only; browser use awaits #21                                                         |
| Required CI secret names and development provenance            | Maintainer confirmed both existence and provenance from the intended development instance                                         | Provenance accepted for #77; automated validation of CI-injected credentials has not been performed           |
| Reserved test address and email code                           | Maintainer identified Clerk's documented test convention                                                                          | Actual verification-code journey awaits #21                                                                   |
| Additional fields and session requirements                     | Maintainer confirmed required email, names, and password; phone, username, legal acceptance, MFA, and Organizations disabled      | Exercise the configured forms and any conditional provider security tasks in #21                              |
| Registration restrictions                                      | Maintainer confirmed Open access; allowlist, blocklist, disposable-email blocking, and general email-subaddress blocking disabled | No remaining configuration unknowns from the maintainer checklist; verify actual registration behavior in #21 |
| Localhost origins                                              | Development and Playwright targets recorded below                                                                                 | Verify auth, redirects, and recovery on each port after #21                                                   |
| Registration, recovery, sign-out, and expired-session journeys | Not run: Quilla auth pages and auth E2E tests are not implemented in the current tree                                             | #21 supplies and exercises the journeys                                                                       |

The maintainer configuration checklist is complete, including CI development provenance, Google authentication disabling, and both general registration-protection settings. Automated CI-injected credential validation and application journey coverage remain with #21; they are not claims made by this documentation change. #77 is ready for documentation delivery and human review, subject to its PR and applicable CI checks, rather than further Dashboard configuration. Branding [#78](https://github.com/devcedrick/quilla/issues/78) still needs functional auth-page handoff and its recorded #77 dependency satisfied.

## Reproduce the Dashboard setup

1. Open the [Clerk Dashboard](https://dashboard.clerk.com/), select **quilla**, and select **Development**. Inspect the environment again before saving any change.
2. Under **User & authentication**, confirm email sign-up, required email, email sign-in, and verification at sign-up using an **email verification code**. Preserve values that already match.
3. Under **Password**, confirm password authentication and an **8-character minimum**. Leave other password protections unchanged.
4. Confirm both **first name** and **last name** are required. Preserve the reported disabled phone, username, legal acceptance, MFA, and Organizations settings. Record unexpected fields or session tasks rather than silently removing them.
5. Confirm the reported registration restrictions: **Open/public** access, with **allowlist, blocklist, disposable-email blocking, and general email-subaddress blocking disabled**. Report discrepancies without changing protections merely to make tests pass. Do not disable bot protection globally.
6. Under **SSO connections → Google**, confirm **Enable for sign-up and sign-in** remains Off. The maintainer has saved and rechecked this value; the agent has not operated the Dashboard. Google is outside the MVP; no Google Cloud setup is required.
7. Record before/after values for intentional changes and verify they persisted. No further setting changes were made by the agent for this deliverable.
8. Once #21 provides the forms, verify the actual email verification and password-recovery journeys and the absence of Google authentication actions rather than inferring success from Dashboard settings.

Dashboard labels may move; consult [Clerk's email/password setup](https://clerk.com/docs/guides/development/custom-flows/authentication/email-password). Quilla uses prebuilt forms; the custom-flow examples on that page are not instructions to replace them.

## Environment variables and safe credential checks

Keep actual values in the ignored root `.env.local` or an approved secret store. Never put values in this runbook, issues, PRs, screenshots, shell command arguments, or test output.

| Variable                            | Consumer and requirement                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Quilla's browser/server Clerk integration; must start with `pk_test_` for development tests                                                                   |
| `CLERK_SECRET_KEY`                  | Server and test setup only; must start with `sk_test_` for development tests; never expose through `NEXT_PUBLIC_*`                                            |
| `NEXT_PUBLIC_CONVEX_URL`            | Existing Quilla provider and E2E server build; preserve the configured development endpoint                                                                   |
| `CLERK_JWT_ISSUER_DOMAIN`           | Convex deployment authentication configuration; must match the Clerk JWT issuer. S02.3 requires deployed profile functions; see the integration section below |

Do not rotate keys, replace secrets, or edit CI as part of a verification check. The two Clerk prefixes alone do not establish that both credentials belong to the same instance.

To repeat the local pairing check safely, use the installed Clerk Backend SDK in a temporary local verification process that reads environment variables without logging them:

1. Reject missing keys and any `pk_live_` or `sk_live_` credentials before making a request.
2. Use `instance.get()` and require `environmentType === "development"`.
3. Decode the development frontend hostname from the publishable key in memory. Require a Clerk development hostname ending in `.accounts.dev`; do not send credentials to an arbitrary decoded URL.
4. Compare public signing-key material from `jwks.getJwks()` with the frontend's `/.well-known/jwks.json`. Require a matching RSA key ID, modulus, and exponent. Print only a pass/fail result, not keys, hostnames, or responses.
5. If checking Testing Token availability, call `testingTokens.createTestingToken()` only after the development check. Keep the result in memory, report issuance success only, and discard it. Successful issuance does not prove browser integration.

GitHub repository secrets are under **Settings → Secrets and variables → Actions**. The current workflow uses the first three variables in the table. Secret-name presence does not prove the stored values are correct, and stored values cannot be retrieved through GitHub for comparison. Obtain a maintainer's reliable provenance confirmation or validate the CI-injected pair inside the existing approved test path when #21 implements it. Do not print values or modify the workflow merely to inspect secrets.

See [Clerk's environment-variable reference](https://clerk.com/docs/guides/development/clerk-environment-variables) for key boundaries. Keep future route and fallback configuration in #21 consistent between server and client; this document does not introduce new environment requirements.

## Local origins and test procedure

| Purpose         | Origin                  | Repository command                                                                               |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Web development | `http://localhost:3000` | `npm run dev` (ensure Next.js actually binds to port 3000)                                       |
| Playwright      | `http://localhost:3100` | `npm run test:e2e`; the existing Playwright config builds and starts the web server on this port |

Clerk development hosting does not require setting up production DNS. If an origin or return URL is rejected, confirm development credentials and the exact requested origin first. Record any explicit instance restriction; do not add wildcard origins or switch to live keys. Restart the local server after an approved environment change.

After #21 supplies functional forms and Clerk test integration:

1. Use isolated synthetic accounts, for example `quilla-<unique-run>+clerk_test@example.com`, with synthetic first and last names and a strong generated password satisfying the configured policy. Do not use production data.
2. Fill both names, email, and password in the prebuilt sign-up form. Exercise the email-code request, then use Clerk's documented development code `424242` for the reserved test address. This is a public test convention, not a real-account verification code.
3. Verify that incomplete names and an unverified email cannot complete the intended registration journey. Test missing/invalid credentials and the minimum-length boundary without weakening other password checks.
4. Exercise password sign-in, sign-out, and password reset on a disposable account; verify the old password fails after a completed reset. Then verify the protected-route, return-destination, and expired-session scenarios owned by #21.
5. Run the relevant journeys against both recorded origins. Supplying an origin in a checklist or successfully loading `/` does not establish authenticated behavior on that port.
6. Use Clerk's Playwright Testing Token integration for bot checks, keep auth credentials and session artifacts out of retained traces, and clean up only accounts created by the test run.

The fixed test email-code behavior is documented in [Clerk's test-address guide](https://clerk.com/docs/guides/development/testing/test-emails-and-phones). No verification-code email is sent for those test addresses. The test integration must still supply required name fields and obtain its Testing Token as described in [Clerk's Playwright guide](https://clerk.com/docs/guides/development/testing/playwright/overview); do not infer that a successful token-issuance check exercises either form.

## Troubleshooting and reversal

| Symptom                                        | Action                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Missing or rejected credentials                | Check variable names and development-instance provenance privately. Record mismatch without logging values; request a separate approved correction instead of rotating automatically.            |
| Forms require more than email/password         | Supply required first and last names. Report other requirements; do not disable them silently.                                                                                                   |
| An 8-character password is rejected            | Inspect length and other existing password rules; use a strong generated test password rather than disabling protections.                                                                        |
| Test sign-up is challenged or rejected         | Verify reserved-address restrictions and the Playwright Testing Token setup. Keep bot protection enabled.                                                                                        |
| Quilla `/sign-in` or `/sign-up` is unavailable | Confirm the S02.2 account-route implementation is present in the running checkout and restart/rebuild that version. Do not treat an old skeleton's missing route as a Clerk configuration fault. |
| A localhost redirect fails                     | Verify the actual port, development keys, and #21's route/fallback configuration before changing instance settings.                                                                              |
| CI passes an old landing test                  | That does not validate key pairing or registration. Await explicit provider-backed assertions from #21.                                                                                          |

The maintainer reported **minimum password length: 15 → 8**, explicitly retaining 8, and subsequently confirmed **Google sign-up/sign-in: On → Off** for the MVP. Required names remained in place. Reversal would require a new explicit maintainer decision and corresponding documentation and fixture updates; do not restore 15 or re-enable Google during implementation. The agent performed no Dashboard changes, credential rotation, production changes, CI edits, or user-account changes for this document.

## Documentation delivery checks

Format and check only this file with the installed Prettier and run `git diff --check`. Review all status claims against the maintainer report and actual verification results; inspect the change for credentials and private data.

This documentation-only change adds no runtime code, dependencies, schemas, or deployment configuration. Lint, typecheck, unit tests, Knip, build, and browser tests are not required to demonstrate its behavior and may be recorded as not run for this change. Registration/recovery E2E verification cannot be claimed until #21 supplies those routes and tests. Human review, a focused PR, and applicable CI checks remain part of delivery; this document alone does not close #77.

The paragraph above records the original #77 documentation delivery. Runtime account changes require lint, typecheck, unit tests, Knip, build, and E2E verification, with actual results reported in their handoff.

## S02.3: Clerk-to-Convex application access

The profile implementation adds application authorization without changing the approved Clerk registration policy. Profiles are created on first protected visit, not by a signup webhook. They store the verified canonical identity key, role, and account status—not copied names or email. Onboarding remains #23; audit logging and administrative management remain #24/#25. See [ADR 0006](../ADR/0006-application-profiles-and-authorization.md).

### Integration prerequisites and safe verification

1. Privately confirm the web application's `NEXT_PUBLIC_CONVEX_URL` and the CLI's `CONVEX_DEPLOYMENT` name refer to the same approved development deployment. Never deploy merely because a local environment file exists. Confirm there is no production deploy-key override.
2. In the intended Clerk development instance, verify a JWT template named **convex** exists using [Convex's Clerk setup](https://docs.convex.dev/auth/clerk). Its audience must be `convex`; its issuer must correspond to the instance used by the browser and match the deployment's `CLERK_JWT_ISSUER_DOMAIN`. Configuration corrections require separate explicit approval; do not alter settings to make a test pass.
3. `CLERK_JWT_ISSUER_DOMAIN` is consumed in the Convex deployment, not supplied by browser props or the CI web-server environment. It must be a valid HTTPS issuer origin. Missing/invalid configuration errors name the variable without echoing its value. The existing auth provider continues checking audience `convex`.
4. After approval for the exact development target, push the schema/functions with supported Convex tooling and regenerate bindings. Do not hand-edit generated files. A web build alone does not deploy the functions.
5. With a synthetic development account, obtain `session.getToken({ template: "convex" })` in memory, then call `users.currentAccess` with that token. Report only success/failure; never print tokens, decoded claims, issuer values, or provider responses. A valid Clerk session does not by itself prove Convex authentication works.
6. Visit `/dashboard`. First access creates an active `user`; reload must retain the same application profile ID. Repeated sign-in must not change role or status. Verify unauthenticated requests reveal no protected payload and two synthetic identities obtain different profiles.
7. Exercise suspended/admin states in the in-memory tests, not through a newly exposed management endpoint. Suspended accounts see a notice and sign-out without sign-in loops. Admin UI remains unavailable. Production admin provisioning and status changes are deliberately not included.

No CI workflow changes are needed: the web server already receives the public Convex URL; the existing Convex deployment separately needs the issuer configuration and deployed functions. Validate the CI endpoint privately before running account journeys against it. Keep auth traces, screenshots, videos, and saved session state disabled.

Clerk fixture cleanup removes only recorded synthetic identities. Minimal synthetic Convex profiles can remain in the approved development instance because account-deletion synchronization and administrative cleanup are not implemented. Do not add an unaudited delete function or enumerate/delete unrelated profiles. Record this footprint in the verification handoff.

### Account-access troubleshooting

- Clerk succeeds but Quilla access fails: verify the development target, deployed `users` functions, JWT template name/audience, and issuer pairing. Report sanitized pass/fail results only; do not rotate keys or enable Google.
- A new profile is loading: wait for Convex authentication and the bootstrap mutation. Failed bootstrap offers an explicit retry; do not permit learning content before the server reauthorizes the created profile.
- A suspended account cannot open `/dashboard`: this is intentional. Keep public navigation/sign-out available and handle status changes through future audit-backed administrative controls.
- A signed-in admin receives not-found at `/admin`: administrative functionality is still unimplemented; role assignment does not create an admin dashboard.

### Dependency audit during S02.3

On 2026-10-24, npm reported seven advisories (one critical, five high, one moderate), including critical reports for Next.js 16.4.0. Next's production build emitted its security-upgrade warning and stopped the first invocation; a retry can continue without fixing the vulnerability. This is not a clean security audit. All reported affected package versions match `origin/main`'s lockfile: Next.js, shadcn/registry, body-parser, fast-uri, undici, and the nested Zod copies. No automatic dependency upgrade or broad allowlist is part of S02.3. A separate compatible security update is strongly recommended before release; passing functional tests does not resolve these advisories.

### S02.3 verification handoff (2026-10-25)

- Deployed the users schema and profile functions only to the explicitly approved development deployment `perceptive-dodo-136` in project `quilla`. No Clerk Dashboard settings, credentials, CI workflows, or production deployment were changed.
- Lint, application and Convex strict typechecks, all 124 unit tests, Knip, changed-file formatting, and whitespace checks passed. Production build passed after the security notice's first-invocation stop; the warning remains unresolved. Independent authorization review found no actionable defects.
- The port-3100 browser run finished with 32 passes and eight failures. Seven failures were protected-account journeys blocked by a missing Clerk `convex` JWT template; a read-only development-instance check confirmed its absence and the approved Convex endpoint pairing. The unchanged mobile-motion test also failed in the full run but passed when rerun alone. Assertions were not weakened.
- Port-3000 no-JavaScript landing smoke passed. The targeted auth smoke now fails explicitly at the JWT prerequisite, before creating synthetic account fixtures; the dependent protected-flow test did not run.
- Redacted Gitleaks scanning found no leaks in tracked/non-ignored source. An initial full-directory scan included ignored local environment/build/test artifacts and reported findings; no broad allowlist was added. Installed dependencies are excluded by the scanner's existing defaults.
- Completion remains blocked on the maintainer creating the development `convex` JWT template with audience `convex`, followed by fresh protected-flow verification on both ports. Human authorization-boundary review and green CI remain required. Commit and PR delivery are tracked separately from this dated verification checkpoint.

### Hydration regression follow-up (2026-10-27)

- Reproduced a server/client hydration mismatch for both auth forms when Clerk becomes loaded before hydration. Both regression tests failed before the fix and pass afterward. The server and first browser render now use the same skeleton; live Clerk rendering starts after hydration without changing authentication or redirect decisions.
- Added a DOM-based hydration test environment and public browser checks that require no account fixtures or Convex JWT template. All 128 unit tests pass, along with lint, typecheck, Knip, formatting, and whitespace checks. The auth component Gitleaks scan found no leaks.
- Public sign-in and sign-up passed cold-load and mobile warm-reload checks on both port 3000 (development) and port 3100 (production build). The initial production run timed out waiting for the full page load event; DOM-readiness navigation plus unchanged visible-form and no-hydration-error assertions passed on rerun. No assertions were removed or skipped.
- Production build passed after retrying the installed Next.js security warning. The existing dependency advisories remain unresolved. Protected-account verification still awaits the development Clerk `convex` JWT template described above; passing public hydration checks does not complete that work.

### S02.4 onboarding integration

- Authentication and landing defaults remain `/dashboard`. Active callers without a saved level continue to `/onboarding`; first setup saves to the clearly unavailable diagnostic introduction, while later preference edits return to the dashboard. Suspended accounts retain their notice/home/sign-out path, not an onboarding redirect.
- No new Clerk settings, metadata, credentials, CI variables, or JWT claims are required. Convex owns the optional preferred level and target date; server and public backend operations independently authorize the current identity.
- Before deployment or fixture writes, verify the exact development target and obtain fresh approval. Use supported codegen/development commands; never edit generated bindings or deploy production to make a local journey pass.
- Prepared browser fixtures create a short-lived session only for an ID recorded by the synthetic fixture, keep its Convex JWT in memory, and invoke the real identity-derived profile/preferences mutations. They revoke that setup session and clean up only recorded synthetic Clerk users. Unonboarded fixtures remain separate. The prepared-fixture endpoint guard is intentionally limited to approved development deployment `perceptive-dodo-136` (regional or canonical hostname); changing the test target requires explicit review/approval.
- Minimal synthetic Convex profiles/preferences remain in that development deployment after Clerk fixture cleanup. There is intentionally no public profile-deletion or test-cleanup endpoint. Any later backend cleanup must be separately scoped to recorded synthetic records; do not delete real profiles or add a production bypass for test convenience.
- New dates are validated against Philippine calendar time; leave the date omitted on a level-only update, or send null to clear it. Test past dates and empty levels without storing fake diagnostic completion or exposing an unlock endpoint. Diagnostics and positive guidance/readiness eligibility remain deferred to #57/#58.

### S02.4 verification handoff (2026-10-30)

- After fresh maintainer approval, deployed only the optional profile fields and preference/gate functions to development deployment `perceptive-dodo-136` in project `quilla`. Generated bindings through supported Convex tooling. No production deployment, Clerk settings, credentials, or CI workflows changed.
- Lint, strict application and Convex typechecks, all 198 unit tests, Knip, production build, changed-file formatting, redacted changed-source Gitleaks scanning, and whitespace checks passed. Existing dependency advisories documented above remain unresolved; dependencies were not changed and this is not a fresh dependency-security audit.
- The complete port-3100 browser run had 46 passes and three selector failures: Next retained hidden diagnostic content during dashboard navigation, so the account-status test ID was not unique. All three corrected journeys passed in a focused rerun, including registration and sign-out/back navigation. Positive assertions target the visible route; protected-content denial assertions remain unchanged. All 49 scenarios have passing coverage across the full run and focused reruns, not a single clean full-suite invocation.
- Both level journeys cover persistence, level-change acknowledgement, date preservation/clearing, locked diagnostic access, and 390px/768px/1440px layouts. The targeted port-3000 Professional onboarding smoke passed. Initial new-journey failures at short total/navigation budgets were resolved by budgeting the multi-save flow and cold development compilation; existing Clerk-loading assertions were not relaxed or skipped.
- Authentication traces, screenshots, videos, and saved sessions remained disabled. Synthetic Clerk cleanup reported no failures; minimal synthetic Convex profiles remain as described above. An existing development server was reused rather than stopped or replaced.
- Focused independent authorization review found no actionable defects, including the regression where a preference-query failure races suspension. Human authorization-boundary review, CI, commits, push, and PR delivery remain pending; do not merge or deploy production based only on local checks.

### Guided setup UI follow-up (2026-10-30)

- Initial onboarding now separates exam level, optional target date, and final review into three screens. Drafts survive Back/Change actions; skipping the date and moving between steps never writes preferences. Only final confirmation invokes the existing mutation. Returning-user preference editing stays direct, including the level-change acknowledgement.
- The presentation uses Quilla's existing typography, tokens, and Kuwi mark, with a desktop progress rail and compact mobile stepper. Step changes move focus to the new heading. The sign-out control has an explicit non-submit button type so it cannot submit the surrounding form.
- Lint, strict application typechecking, all 204 unit tests, Knip, changed-file formatting, redacted changed-source Gitleaks scanning, and whitespace checks passed. The production build initially stopped on the existing Next.js security advisory and passed on retry; the advisory remains unresolved and dependencies were not upgraded.
- Targeted port-3100 coverage passed for both levels and all three account journeys changed by the wizard, with development credential setup also passing. The first run's two level journeys failed on duplicate date elements in Next-retained hidden review content; scoping date assertions to the active preparation region resolved both without weakening persistence assertions. The targeted port-3000 Professional journey also passed. The full 49-test browser suite was not rerun for this presentation-only follow-up; earlier full-run results above are historical, not fresh verification of unchanged journeys.
- Scoped synthetic verification used the freshly approved development target `perceptive-dodo-136`; no backend deployment, schema, authorization, Clerk settings, CI, or production changes were made. Authentication recordings remained disabled and fixture cleanup reported no failures. Minimal synthetic Convex profiles remain under the existing retention boundary described above.

### Existing dependency advisory (S02.2)

During S02.2 dependency setup, `npm audit` reported nine high-severity findings rooted in `braces` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) and its tooling dependents, including `micromatch`, `fast-glob`, shadcn/registry/ts-morph, and Next's ESLint configuration. All nine affected package versions match the baseline lockfile before this change. The reported issue concerns stack exhaustion on deeply nested glob patterns; the new authentication code does not accept user-provided glob patterns. This is an existing tooling finding, not a clean audit. Do not use npm's proposed incompatible shadcn/ESLint downgrades or `npm audit fix --force`; remediation needs a separate compatible dependency update. No broad allowlist is introduced.

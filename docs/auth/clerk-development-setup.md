# Clerk development setup

This runbook supports [S02.2.1 / #77](https://github.com/devcedrick/quilla/issues/77) and the account-flow implementation in [S02.2 / #21](https://github.com/devcedrick/quilla/issues/21). It documents development configuration and evidence, not a claim that Quilla's account journeys are implemented. [FEATURES](../FEATURES.md#2-account-authentication-and-onboarding) remains the product source of truth.

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

| Variable                            | Consumer and requirement                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Quilla's browser/server Clerk integration; must start with `pk_test_` for development tests                                                          |
| `CLERK_SECRET_KEY`                  | Server and test setup only; must start with `sk_test_` for development tests; never expose through `NEXT_PUBLIC_*`                                   |
| `NEXT_PUBLIC_CONVEX_URL`            | Existing Quilla provider and E2E server build; preserve the configured development endpoint                                                          |
| `CLERK_JWT_ISSUER_DOMAIN`           | Existing Convex authentication configuration; not evidence that the two Clerk keys are paired; no Convex changes or deployment are part of this task |

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

| Symptom                                        | Action                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing or rejected credentials                | Check variable names and development-instance provenance privately. Record mismatch without logging values; request a separate approved correction instead of rotating automatically. |
| Forms require more than email/password         | Supply required first and last names. Report other requirements; do not disable them silently.                                                                                        |
| An 8-character password is rejected            | Inspect length and other existing password rules; use a strong generated test password rather than disabling protections.                                                             |
| Test sign-up is challenged or rejected         | Verify reserved-address restrictions and the Playwright Testing Token setup. Keep bot protection enabled.                                                                             |
| Quilla `/sign-in` or `/sign-up` is unavailable | The current skeleton lacks these routes; implement #21. Do not treat a missing route as proof of a Clerk configuration fault.                                                         |
| A localhost redirect fails                     | Verify the actual port, development keys, and #21's route/fallback configuration before changing instance settings.                                                                   |
| CI passes an old landing test                  | That does not validate key pairing or registration. Await explicit provider-backed assertions from #21.                                                                               |

The maintainer reported **minimum password length: 15 → 8**, explicitly retaining 8, and subsequently confirmed **Google sign-up/sign-in: On → Off** for the MVP. Required names remained in place. Reversal would require a new explicit maintainer decision and corresponding documentation and fixture updates; do not restore 15 or re-enable Google during implementation. The agent performed no Dashboard changes, credential rotation, production changes, CI edits, or user-account changes for this document.

## Documentation delivery checks

Format and check only this file with the installed Prettier and run `git diff --check`. Review all status claims against the maintainer report and actual verification results; inspect the change for credentials and private data.

This documentation-only change adds no runtime code, dependencies, schemas, or deployment configuration. Lint, typecheck, unit tests, Knip, build, and browser tests are not required to demonstrate its behavior and may be recorded as not run for this change. Registration/recovery E2E verification cannot be claimed until #21 supplies those routes and tests. Human review, a focused PR, and applicable CI checks remain part of delivery; this document alone does not close #77.

# S02.2.2 account branding verification

Scope: [#78](https://github.com/devcedrick/quilla/issues/78), presentation polish on the account/session flows from [#21](https://github.com/devcedrick/quilla/issues/21). No authentication, redirect, session, provider, credential, Convex, CI, or deployment configuration changes are included.

The maintainer approved the **third welcoming Kuwi candidate** on **2026-10-23**: “I like the 3rd one.” The unchanged transparent source, pinned trace profile, measurements, and reproduction command are recorded in [the brand reference](../brand/KUWI.md#account-welcome-variant--s022).

## Presentation and accessibility

- Following maintainer feedback and two supplied layout references, authentication routes use **one rounded split-screen composition**, not separate outlined cards. At 1024 px and above an inset ink-blue panel contains the Quilla wordmark, the approved Kuwi over a marigold disc, and welcome copy; the cream form area is integrated into the same surface. Smaller viewports use a compact brand row and prioritize the form.
- Heavy ink shadows, the paper-grid panel, pill-shaped form actions, and the duplicate visible page heading have been removed. Clerk's own heading stays visible for every step; the shell title is screen-reader-only on auth routes and remains visible on compact dashboard/error surfaces. Field boundaries remain visible and keyboard focus is not clipped by Clerk's card container.
- Dashboard and account-error surfaces retain the compact shell. The shared header, navigation, focus treatment, and non-affiliation disclaimer use existing tokens; no global palette or landing-page styles change.
- Clerk still owns names, credentials, verification, recovery, security tasks, and step-specific headings. Its development-mode disclosure remains visible.
- Follow-up polish fixes the marigold backdrop to a centered square aspect ratio, independent of form height, and removes “A little focus. A fresh beginning.” and the redundant bottom account-link row from authentication pages. Clerk's form-switch links and home navigation remain; compact account/error pages retain account navigation.
- Browser coverage checks sign-in/sign-up at 390, 768, and 1440 px, keyboard focus/skip navigation, and focused-button reduced motion. Additional checks cover 320 px reflow, 200% text resizing, font families, and normal-text contrast of the relevant brand token pairs. These checks are not a claim of a complete WCAG certification or a screen-reader audit.
- A read-only rendered-style probe measured the actual input boundary at **3.58:1 against the field** and **3.83:1 against the card**, exceeding the 3:1 non-text contrast threshold. Focused primary buttons are also asserted to have no layered box shadow; the explicit focus outline remains visible.
- Verification, recovery, validation, loading, provider failure, and the real account-error component are checked at all three primary viewport widths. The server-error visual fixture is fulfilled only by Playwright; it adds no application route and does not simulate an authorized session. Retry behavior remains covered by the existing unit regression tests.

## Sanitized visual evidence

Only synthetic development identities are used. Automatic authentication screenshots, traces, videos, and stored sessions remain disabled. The opt-in helper redacts all input characters (including placeholders, password-reveal text, and codes) with temporary screenshot-only styles, and opaquely masks email-shaped identity previews **before writing** the PNG. This preserves field borders for visual review without saving unredacted text in an intermediate image. Captures must be visually inspected before retention. No credentials or real learner data belong in this directory.

Representative desktop/mobile evidence:

| State                 | Desktop                                           | Mobile                                          |
| --------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Sign-in               | [1440 px](visuals/sign-in-1440.png)               | [390 px](visuals/sign-in-390.png)               |
| Sign-up               | [1440 px](visuals/sign-up-1440.png)               | [390 px](visuals/sign-up-390.png)               |
| Email verification    | [1440 px](visuals/email-verification-1440.png)    | [390 px](visuals/email-verification-390.png)    |
| Password recovery     | [1440 px](visuals/password-recovery-1440.png)     | [390 px](visuals/password-recovery-390.png)     |
| Validation error      | [1440 px](visuals/validation-error-1440.png)      | [390 px](visuals/validation-error-390.png)      |
| Provider loading      | [1440 px](visuals/provider-loading-1440.png)      | [390 px](visuals/provider-loading-390.png)      |
| Provider failure      | [1440 px](visuals/provider-failure-1440.png)      | [390 px](visuals/provider-failure-390.png)      |
| Account error fixture | [1440 px](visuals/account-error-fixture-1440.png) | [390 px](visuals/account-error-fixture-390.png) |

To request fresh local captures explicitly, run the auth project with `QUILLA_CAPTURE_AUTH_VISUALS=1`. Leave it unset for normal verification and CI. Do not enable Playwright's automatic auth artifacts as an alternative. Inspect new images before retaining or sharing them, even though capture-time masks are present.

## Verification record

Follow-up circle/copy/navigation refinement: all **51 unit tests** and **8 focused browser checks on development port 3000** passed (setup, both forms at 390/768/1440 px, and public/protected navigation). Browser assertions measure equal backdrop width/height on desktop, require its absence below 1024 px, and verify the removed copy/navigation row stays absent. Lint, strict non-incremental typecheck, Knip, formatting, and whitespace checks passed. The six sign-in/sign-up captures were refreshed and inspected; other state captures below document the preceding revision and have not been regenerated for this small refinement. Production build, the full port-3100 suite, and Gitleaks were not rerun for this presentation-only follow-up; their prior results and the existing build blocker remain recorded below.

Verified locally on **2026-10-23** with installed dependencies and the development Clerk instance. Synthetic fixtures are isolated and cleaned up through the existing guarded fixture helpers. Results below cover the reference-led redesign; previous-layout passes are not substituted for verification of the revised UI.

| Check                                                                | Result                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Changed-file Prettier, lint, strict non-incremental typecheck        | Passed                                                                                                                                                             |
| `npm run test:unit`                                                  | 51 passed, including the unchanged `retry()` regression tests and a text-field/checkbox sizing regression                                                          |
| `npm run knip`                                                       | Passed                                                                                                                                                             |
| `python -B -m unittest discover -s scripts` with pinned VTracer      | 3 passed                                                                                                                                                           |
| Full Playwright suite and refreshed visual evidence, port 3100       | 31 passed, including landing/no-JavaScript, registration, recovery, redirects, isolation, and actual session revocation                                            |
| Final production text-field/checkbox and recovery recheck, port 3100 | 3 passed after the final checkbox scoping fix, including setup, actual style assertions, recovery, and old-password rejection; all 24 refreshed captures inspected |
| Development responsive smoke, port 3000                              | 7 passed, including setup and both forms at 390, 768, and 1440 px; final border/focus and complete recovery recheck passed 3/3                                     |
| Gitleaks with repository configuration and `--redact`                | Passed on an isolated copy of Git-visible files; ignored local secrets were excluded                                                                               |
| `git diff --check`                                                   | Passed                                                                                                                                                             |
| `npm run build`                                                      | Blocked by the existing Next.js security error described below; compilation/typechecking/prerendering completed                                                    |
| CI, human review, PR delivery                                        | Pending; no commit or push requested for this implementation                                                                                                       |

Clerk-loading reliability is reported separately: the initial full browser pass failed two existing assertions while the provider was still loading after five seconds. Those tests now explicitly await `window.Clerk.loaded` within their existing bounded test timeout before inspecting the form. Required-field, validation, verification, protected-content, and all other behavioral assertions are retained. No retries, skips, or weaker assertions were added.

The first reference-redesign full pass had **30 passes and one recovery transition timeout**: Clerk showed successful code verification but had not yet rendered the password-reset fields inside five seconds. Recovery now waits for Clerk's documented `needs_new_password` state within the existing bounded test timeout before asserting that the fields are visible. The full recovery/old-password rejection check passed in the focused recheck. New style assertions also caught Clerk/Tailwind cascade defaults restoring zero-width input borders; narrowly scoped appearance overrides now preserve one-pixel field boundaries and remove the focused primary button's layered shadow. Neither fix changes account behavior.

A subsequent pass had **30 passes and one immediate account-lookup failure** after registration had already verified email and reached the protected dashboard. The test now polls for the exact synthetic email lookup (bounded to ten seconds) before running the unchanged first/last-name assertions. This records provider lookup readiness rather than weakening the required registration behavior or retrying the whole journey.

Visual review also caught recovery's checkbox inheriting text-input height/padding. Text-field sizing is now scoped away from checkbox/radio inputs. A unit regression and a browser assertion limiting the recovery checkbox to 24 px in each dimension cover the fix; the focused development recovery/style recheck passed 3/3. The approved mascot artwork and all authentication behavior remain unchanged.

The initial development smoke also exposed an overbroad test route interceptor: matching “clerk” anywhere in a script URL aborted Next's named development chunks as well as the provider. The blocker now targets JavaScript on the development Clerk host only, allowing the real failure component to hydrate. The explicit failure-alert assertion remains in place. Captures wait for post-scroll painting, and validation is re-established after responsive Clerk remounts so evidence shows the actual intended state. Wrong-password/recovery assertions additionally require the visible rejection paragraph: neither Next's generic route-announcer alert nor Clerk's duplicate screen-reader announcement can satisfy that check. Initial ambiguous selectors were corrected and their focused reruns passed; no failed check was skipped.

## Existing dependency/security blocker

The final production bundle compiles, typechecks, and prerenders, but `npm run build` exits with `SecurityFatalError` for the existing Next.js **16.4.0**. This is not a passing build. Read-only `npm audit` reports **one critical and nine high** findings, including Next.js and the previously documented tooling advisories. No dependency changes or security-check bypasses are included in this branding issue.

The published Next.js advisories affect 16.4.0 and list 16.4.1 as patched:

- [Image Optimization upstream memory/RCE advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw), affecting glibc-based Linux under the described conditions.
- [App Router Server Actions denial-of-service advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).

A separately approved, compatible Next.js security update and a fresh full validation run are required before declaring delivery checks green or deploying. Existing tooling findings and their scope are documented in [the setup runbook](clerk-development-setup.md#existing-dependency-advisory). Human review and CI remain required; no commit, push, PR creation, merge, or deployment is implied by these local checks.

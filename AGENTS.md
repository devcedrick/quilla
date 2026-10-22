<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Project: Quilla

## What this project is

Quilla is a web-based learning platform for people preparing for the Philippine Civil Service Examination at the Professional or Subprofessional level. It is intended to turn practice into an adaptive learning loop through diagnostic assessment, concept-level mastery, spaced review, personalized study plans, timed mock exams, detailed feedback, and a moderated question bank. The repository is still in active development; planned behavior in `docs/FEATURES.md` must not be presented as already shipped.

## Sources of truth

- `docs/FEATURES.md` defines product scope, user stories, edge cases, non-goals, and acceptance criteria.
- `docs/ADR/` records accepted architecture decisions. Add a new ADR when a change materially alters architecture, data ownership, security boundaries, or operational strategy; do not rewrite history in an accepted ADR.
- `README.md` is user-facing product context, not an implementation specification.
- The current code and tests describe what is actually implemented.
- Open product decisions listed in `docs/FEATURES.md` remain open. Do not invent an answer; surface the decision in the handoff or introduce a clearly named configuration seam only when implementation cannot wait.
- The generated Next.js and Convex instruction blocks above override assumptions from model training.

## Quick start

- Required local runtime: Node.js `22.14.0` and npm.
- Install: `npm ci`
- Configure: provide the required Clerk and Convex values through local environment files or deployment settings; never commit secrets.
- Convex development: `npx convex dev`
- Web development: `npm run dev`
- Unit tests: `npm run test:unit`
- End-to-end tests: `npm run test:e2e`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Dead-code check: `npm run knip`
- Format: `npm run format`
- Build: `npm run build`
- Deploy: no deployment runbook exists yet. Do not infer a production command or affect a production Convex deployment without explicit human approval and a documented runbook.

## Architecture map

- `app/` — Next.js App Router routes, layouts, providers, and global styles.
- `components/` — reusable React components; `components/ui/` contains locally owned shadcn/UI primitives.
- `lib/` — framework-independent helpers and shared utilities.
- `convex/` — backend schema, functions, authentication configuration, and generated API bindings.
- `convex/_generated/` — generated Convex code. Never edit it by hand.
- `middleware.ts` — Clerk request middleware. Authentication changes require focused security review.
- `public/` — static browser assets.
- `tests/smoke/` — lightweight pipeline and repository health tests.
- `tests/e2e/` — Playwright browser tests.
- `playwright.config.ts` — e2e projects, web server, retries, traces, and CI behavior.
- `.github/workflows/` — CI definitions. Changes require explicit human approval and careful supply-chain review.
- `.husky/` — local Git hooks. Do not bypass them to force a commit through.
- `docs/ADR/` — append-only architecture decision records.
- `docs/FEATURES.md` — planned product behavior and cross-feature requirements.

## Technology and security boundaries

- Next.js 16 and React 19 provide the web application. Read the relevant installed Next.js guide before changing framework behavior.
- Clerk establishes identity. Convex owns application authorization and data access rules.
- Public Convex functions must derive identity from `ctx.auth`; never trust a client-supplied user ID as proof of identity.
- Enforce ownership, role, suspension, and resource-level authorization in backend functions, even when the UI hides the action.
- Validate every public Convex function argument and use indexed queries for user-facing access paths.
- Read `convex/_generated/ai/guidelines.md` in full before editing any file under `convex/`.
- Never edit generated Convex bindings. Regenerate them through supported Convex tooling.
- Tailwind CSS and shadcn/UI are the visual foundation. Prefer existing design tokens and components before adding one-off styles.
- Lucide React is the icon system. Icons that convey meaning need accessible text or labels.
- CSS transitions are the default for simple motion. Use GSAP only for coordinated motion that materially improves comprehension, and respect reduced-motion preferences.

## Product invariants

- Professional exams must never serve Clerical Ability questions.
- Subprofessional exams must never serve Analytical Ability questions.
- Only eligible published question versions may be served in assessments.
- Historical attempts must retain the exact question and blueprint versions originally served.
- A contributor, including an admin contributor, must never review their own question.
- Personalized plans and readiness remain locked until the diagnostic is submitted.
- Admin mutations must be auditable.
- Questions and historical attempts must not be hard-deleted.
- Quilla must not host leaked or actual Civil Service Examination questions.
- The product must display its non-affiliation with the Philippine Civil Service Commission.

## Code conventions

- Use TypeScript in strict mode. Do not weaken compiler settings to make an error disappear.
- Avoid `any`. When an external boundary makes it unavoidable, keep it local, explain why in a comment, and validate before use.
- Prefer small, cohesive modules and explicit names over clever abstractions.
- Use the `@/` alias for stable cross-directory imports; use relative imports for nearby files when clearer.
- Keep server-only code out of client bundles. Add `"use client"` only at the smallest interactive boundary.
- Treat environment variables as untrusted input. Validate required server-side configuration at startup or at the boundary that consumes it.
- Use Conventional Commits. Keep commits atomic and separate unrelated documentation, tooling, frontend, and backend changes when practical.
- Update documentation and ADRs in the same change when behavior or architecture changes.
- Do not silently expand scope beyond `docs/FEATURES.md`.

## Test conventions

- Put focused unit tests beside the code as `*.test.ts` or `*.test.tsx` when proximity improves discoverability.
- Put cross-cutting smoke tests in `tests/smoke/` and browser journeys in `tests/e2e/`.
- Every logic change needs a happy-path test and at least one relevant failure, boundary, or authorization test.
- Convex behavior must include negative authorization coverage: unauthenticated, wrong user, wrong role, or wrong parent ownership as applicable.
- Bug fixes require a test that fails before the fix and passes after it.
- Do not delete or weaken a test merely to make CI pass unless the requirement itself changed and the change is documented.
- E2E tests must use deterministic fixtures and must not depend on production data or production credentials.

## Git and review workflow

- Use conventional branch names in the form `<type>/<short-kebab-case-description>`, with prefixes such as `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`, or `ci/`. Do not use `codex/` or agent-, tool-, or personal-name prefixes. For example: `feat/s02-2-clerk-account-flows`.
- Every change must be delivered through a focused pull request linked to an issue.
- Never push directly to `main`, bypass branch protection, force-push a shared branch, or merge your own pull request.
- Do not use `--no-verify` to bypass Husky, commitlint, lint-staged, or other repository safeguards.
- Do not modify CI workflows, authentication boundaries, authorization rules, Convex schemas or migrations, secret handling, or deployment configuration without explicit human approval.
- Do not deploy, migrate live data, rotate credentials, or run production-affecting Convex commands without fresh explicit approval for that exact target.
- Commit and push only when the human explicitly requests it.
- Preserve unrelated working-tree changes. Never reset, overwrite, or include them in a commit without verifying ownership and intent.

## Hard rules

- NEVER commit secrets, API keys, tokens, credentials, private keys, or real user data.
- NEVER expose server secrets through `NEXT_PUBLIC_*` variables.
- NEVER trust client-side checks as authorization.
- NEVER edit `convex/_generated/` by hand.
- NEVER use destructive Git commands or bypass repository protections to finish faster.
- NEVER run `npm audit fix --force`, install with `--force` or `--legacy-peer-deps`, or accept incompatible dependencies without explicit approval and a recorded rationale.
- ALWAYS inspect and preserve existing changes before editing.
- ALWAYS run checks proportional to the change before declaring completion.
- ALWAYS report skipped, unavailable, or failing checks with the reason.

## Definition of done

- [ ] Requested behavior and applicable criteria in `docs/FEATURES.md` are satisfied.
- [ ] Tests cover the happy path and relevant failure, edge, and authorization paths.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run knip` passes or every finding is intentionally documented and narrowly configured.
- [ ] `npm run build` passes for changes that can affect the production bundle or runtime behavior.
- [ ] `npm run test:e2e` passes for changed user journeys or release-critical flows.
- [ ] Changed files are formatted; unrelated files were not reformatted.
- [ ] No secrets, credentials, sensitive logs, or production data are present.
- [ ] Security scans are clean or findings are explicitly triaged without broad allowlists.
- [ ] Documentation and ADRs are updated when behavior or architecture changed.
- [ ] The diff is small, focused, and free of unrelated user changes.
- [ ] A separate agent or peer review is complete when required by risk or team policy.
- [ ] Human review is complete for protected areas and consequential changes.
- [ ] CI is green.
- [ ] The change is delivered through a pull request; nothing was pushed directly to `main`.

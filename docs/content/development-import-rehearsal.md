# Development import and bootstrap publication rehearsal

Issue [#96](https://github.com/devcedrick/quilla/issues/96) rehearses the
one-time developer bootstrap of the initial question bank without contacting a
deployment or writing content. The policy is recorded in
[ADR 0022](../ADR/0022-one-time-seed-bootstrap-publication.md) and tracked in
[#104](https://github.com/devcedrick/quilla/issues/104). This is local
implementation evidence, not a live import, deployment, editorial acceptance or
empirical calibration report.

## Current status

- The rehearsal uses deterministic synthetic fixtures; the CLI policy test uses the
  real offline plan.
- No import target is registered; `approvedImportTargets` remains empty.
- No Clerk account, admin user, credential or deploy key was used, and no Convex
  database, storage or audit write occurred.
- No production or development deployment was changed.
- The deferred supplemental audit in
  [#98](https://github.com/devcedrick/quilla/issues/98) remains open.

## Frozen corpus

The one-time exception is bound to the exact offline plan produced by
`scripts/import-question-bank.mjs`:

- **1,890 questions**, seven families at 270 each.
- **265 references** and **59 images**.
- Plan checksum:
  `71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38`
- Inventory checksum:
  `c793d1fa22c9db9de587924f8ba55686001a54ade0ebce3ae1386488ea5f11e0`

| Family | Manifest revision | Questions | References | Images | Manifest SHA-256                                                   |
| ------ | ----------------- | --------- | ---------- | ------ | ------------------------------------------------------------------ |
| 01     | 5                 | 270       | 33         | 9      | `5719ab3ab51f53ef362dbaf25af624467719df184905388f73eeb295658de7df` |
| 02     | 4                 | 270       | 60         | 10     | `de9d8f96bea926512a1dedb38addf41c18a11e86b673337df04d6c1c398ee728` |
| 03     | 2                 | 270       | 34         | 10     | `b23cf7d1875e3e74e21a030fdab75686fa5b48490872ab7158d017741a144e39` |
| 04     | 2                 | 270       | 32         | 5      | `08b295229d83bb3f807448ada1f31b6e677e8282e36cf1dc3795c5eb339972ff` |
| 05     | 2                 | 270       | 34         | 7      | `fda9e925818518e70800d88eba022056fb15eb8c64010813366f82d832c305af` |
| 06     | 2                 | 270       | 38         | 8      | `766bc083283cb85052c0576fc0bc3629a8047f7f944b2e90ca37e0aa41227c30` |
| 07     | 1                 | 270       | 34         | 10     | `e34caf69c8cc0fab5de2418c1459f6dd49f4ed9c7884273e826401bfb4b1689b` |

The unit test in `scripts/import-question-bank.test.mjs` recomputes this shape and
fails if any family, total or checksum drifts.

## Developer-only protocol

No active admin, human approver or Clerk session participates. The CLI runs the
installed Convex CLI's `convex run` command (the same entry point as
`npx convex run`) through Node without a shell, using the developer's Convex CLI
login or `CONVEX_DEPLOY_KEY`. Running the CLI directly keeps JSON arguments intact
on Windows, where spawning `npx.cmd` would reinterpret quotes and question text.

1. **System importer** (`system:seed-bootstrap-importer`) owns the bootstrap run,
   creates drafts, submits versions and reserves asset uploads.
2. **System approver** (`system:seed-bootstrap-approver`) records a plan-level
   `bootstrap_acceptance` review and publishes each version.

Both are non-login users with role `system`. `requireActiveUser`,
`ensureCurrentUser` and `currentAccess` reject them, so they cannot enter the
learner or admin application. The backend creates them idempotently on first use;
no client-supplied identity is trusted.

The bootstrap reuses `questionReviews` but writes a distinct review kind:
`bootstrap_acceptance`, decision `accept`, rubric `seed-bootstrap-v1`, carrying the
run ID and plan checksum. The review records backend-generated evidence for the
processed pinned inventory, reviewed inventory checksum, frozen corpus policy,
revalidated content and reference, and the distinct system approver. It is not an
ordinary `review` decision and does not create a reusable publication shortcut.

## State and serving contract

Bootstrap runs move through `preparing`, `running`, `paused`, `complete` or
`rolled_back`. Entries move through `pending` and `done` and retain their source
descriptor, outcome and resulting version ID.

- A second bootstrap run uses the same frozen plan, not a different corpus.
- A completed run is idempotent; a paused or lease-expired run resumes with a new
  generation. A live lease is refused.
- A fully rolled-back run may be retried as a fresh run; a partially rolled-back run
  must finish rolling back first.
- Staging is ordered, bounded and idempotent at the server checkpoint; staging uses
  50 descriptors per call.
- Import, submit, accept and publish run in batches of at most ten records and
  256 KiB. Each published version becomes learner-visible as it lands.
- A fenced lease and generation prevent stale workers from writing.
- `SEED_BOOTSTRAP_ENABLED=true` is required only for the bootstrap window and only
  for begin, preflight, staging and application. Status, pause and rollback still
  work after the window is disabled.
- Pause releases the lease without discarding published or staged work.
- Rollback archives bootstrap-published versions in bounded batches, records audit
  events and never hard-deletes questions, versions, reviews or attempt history. A
  partial rollback leaves the run paused and blocks resumption.
- Rollback removes archived versions from serving; previously published versions
  from a paused run remain servable until archived.

## Local rehearsal coverage

`convex/seedBootstrap.test.ts` uses a synthetic two-family, six-record corpus with a
sealed test taxonomy. Its production plan/policy constants are mocked only for that
small fixture. It proves:

- system-actor creation, distinct identities and login denial;
- public admin import calls rejecting a bootstrap run;
- exact plan/policy and bootstrap-window guards;
- ordered staging, serve-as-landed publication and run completion;
- `bootstrap_acceptance` evidence and system audit events;
- idempotent completed reruns and resume with a new generation;
- stale-generation and lease rejection;
- deterministic source mismatch before content writes;
- idempotent asset completion without deleting the committed blob;
- refusal to adopt a draft created outside the bootstrap importer;
- archive-only rollback, full-rollback retry and archived-version reactivation;
- preserving an ordinary editorial archive across bootstrap rollback and retry;
- resuming the newest run when older attempts exceed the lookup bound.

`convex/questions.test.ts` covers the #34 bulk submit, publish and archive
mutations: per-item success/failure results, stale revisions, missing approval,
invalid transitions, nonadmin denial and batch bounds. It does not add bulk
editorial review or approval.

`scripts/bootstrap-question-bank.test.mjs` covers plan verification against both
frozen checksums, batching, bounded status reads, deployment selection (including
rejection of the unconfirmed `--deployment prod` alias), transient retries, replayed
batches, asset upload, preflight conflicts, recovery metadata, initial-checkpoint
failure, pause and rollback. A separate assertion in
`scripts/import-question-bank.test.mjs` runs the real offline plan through the
frozen 7 × 270 policy.

## Future authorized rehearsal commands

The CLI is inert by default. It does not load `.env.local`, and no target name is
registered. After separate approval of an exact development deployment, taxonomy
installation and registry change, the operator selects the deployment with
`--deployment <name>`, `--prod --confirm-production`, or `CONVEX_DEPLOY_KEY`.

```powershell
# Offline: validates the real corpus and prints the plan checksum. No writes.
node scripts/bootstrap-question-bank.mjs
node scripts/bootstrap-question-bank.mjs --json

# Read-only status after a separately authorized run exists.
node scripts/bootstrap-question-bank.mjs --status --target <approved-target> --deployment <development-name> --run <run-id> --json

# Import, accept and publish the exact plan with deployment credentials.
node scripts/bootstrap-question-bank.mjs --apply --target <approved-target> --deployment <development-name> --expect-plan 71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38 --checkpoint <private-checkpoint-path> --json

# Recovery.
node scripts/bootstrap-question-bank.mjs --pause --target <approved-target> --deployment <development-name> --run <run-id>
node scripts/bootstrap-question-bank.mjs --rollback --target <approved-target> --deployment <development-name> --run <run-id> --reason <incident-reference>
```

Required backend values on the exact target deployment:

- `SEED_BOOTSTRAP_ENABLED=true` during the bootstrap window;
- the target registry entry and `CONVEX_CLOUD_URL` must match;
- the v2 taxonomy must already be installed and sealed.

The ordinary draft importer's `QUESTION_BANK_IMPORT_ENABLED` guard is not used by the
bootstrap. The checkpoint contains only target, plan and run identities; it contains
no credentials, tokens or content.

## Blockers and boundaries

The live development and production runs remain blocked until all of the following
are separately approved and completed:

1. Exact deployment approval and target registry registration.
2. Matching taxonomy installation and sealing.
3. A completed, reviewed offline plan matching both frozen checksums.
4. Explicit approval to enable `SEED_BOOTSTRAP_ENABLED` on that deployment for the
   bootstrap window.
5. For production, fresh explicit approval of the exact production deployment and
   its `--prod --confirm-production` invocation.

The #34 admin UI and Playwright journeys remain blocked because the #33 admin
workspace does not yet exist. The bulk backend is available without a UI. This work
does not establish editorial correctness, replace #98, activate pooled exam
selection, calibrate difficulty or guarantee CSC alignment.

## Verification

See [the bootstrap rehearsal verification](seed-bootstrap-verification.md) for the
local commands and results recorded with this change.

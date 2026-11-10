# Development import and seed publication rehearsal

Issue [#96](https://github.com/devcedrick/quilla/issues/96) rehearses the
one-time publication of the initial question bank without contacting a deployment
or writing content. The policy is recorded in
[ADR 0022](../ADR/0022-one-time-seed-bootstrap-publication.md) and tracked in
[#104](https://github.com/devcedrick/quilla/issues/104). This is local
implementation evidence, not a live import, deployment, editorial acceptance or
empirical calibration report.

## Current status

- The rehearsal uses deterministic synthetic fixtures and mocked admin identities.
- No import target is registered; `approvedImportTargets` remains empty.
- No credentials were used and no Convex database, storage or audit write occurred.
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

## Two-admin protocol

The bootstrap requires two distinct active admins:

1. **Importer/submitter** owns the completed import run and the draft versions.
   It stages the exact question pins and submits them for review.
2. **Approver/publisher** is pinned by `SEED_PUBLICATION_APPROVER`. It records a
   plan-level `seed_acceptance` review for each version and publishes only after
   the whole batch is approved.

The backend derives both identities from `ctx.auth`. It rejects an approver who
matches the importer, canonical contributor or material version creator. No
client-supplied user ID, manifest note or offline sign-off supplies authority.

The seed path reuses `questionReviews` but writes a distinct review kind:
`seed_acceptance`, decision `accept`, rubric `seed-bootstrap-v1`, carrying the
run ID and plan checksum. The review records backend-generated evidence for the
completed import, pinned plan/inventory, frozen policy, revalidated content and
independent approver. It is not an ordinary `review` decision and does not
create a reusable publication shortcut.

## State and serving contract

Seed runs move through `preparing`, `running`, `paused`, `complete` or
`rolled_back`. Pinned items move through `staged`, `submitted`, `approved`,
`published` or `rolled_back`.

- A second plan for the same target is rejected, including after completion.
- Staging is ordered, bounded and idempotent at the server checkpoint.
- Submit, accept and publish run in batches of ten; staging uses fifty.
- A fenced lease and generation prevent stale workers from writing.
- Ordinary lifecycle actions on a pinned version fail with
  `SEED_PUBLICATION_REQUIRED` until the run is complete or rolled back.
- `loadPublishedQuestion` refuses every pinned version until **all** 1,890 are
  published. A partially published seed is never learner-visible.
- Pause releases the lease without discarding staged or accepted work.
- Rollback archives pinned versions in bounded batches, records audit events and
  never hard-deletes questions, versions, reviews or attempt history. Partial
  rollback leaves the run paused and blocks resumption.

## Local rehearsal coverage

The synthetic rehearsal in `convex/questionImportRehearsal.test.ts` uses a
two-family, two-question policy with a sealed test taxonomy and a completed
synthetic import. Its production policy constant is mocked only for that small
fixture. It proves:

- staging, independent acceptance and publication of the complete synthetic batch;
- serving denial before completion and serving after completion;
- the ordinary-lifecycle fence while the run is incomplete;
- pause, resume with a new generation, and stale-generation rejection;
- distinct active-admin and pinned-approver enforcement;
- unauthenticated, wrong-role, suspended, nonparticipant, expired-lease and
  mismatched-target denial;
- ordered staging, duplicate pins, batch bounds and phase ordering;
- archive-only rollback with retained questions and reviews;
- idempotent completed retries and rejection of a second plan.

`convex/questions.test.ts` covers the #34 bulk submit, publish and archive
mutations: per-item success/failure results, stale revisions, missing approval,
invalid transitions, nonadmin denial and batch bounds. It does not add bulk
editorial review or approval.

`scripts/publish-seed-question-bank.test.mjs` covers plan verification, pin
derivation, batching, bounded status reads, the two-client orchestration,
idempotency, recovery metadata and rollback. A separate assertion runs the real
offline plan through the frozen 7 × 270 policy.

## Future authorized rehearsal commands

The CLI is inert by default. It does not load `.env.local`, and no target name is
registered. After separate approval of an exact development deployment, taxonomy
installation and registry change, the operator would provide short-lived Clerk
user tokens for both admins. Never paste real tokens into a command committed to
source or shared in chat.

```powershell
# Offline: validates the real corpus and prints the plan checksum. No writes.
node scripts/publish-seed-question-bank.mjs
node scripts/publish-seed-question-bank.mjs --json

# Read-only status after a separately authorized run exists.
node scripts/publish-seed-question-bank.mjs --status --target <approved-dev> --run <seed-run-id> --json

# Stage, submit, accept and publish the exact plan with two admin tokens.
$env:QUESTION_BANK_IMPORT_TOKEN = <importer-token>
$env:SEED_PUBLICATION_APPROVER_TOKEN = <approver-token>
node scripts/publish-seed-question-bank.mjs --apply --target <approved-dev> --expect-plan 71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38 --import-run <completed-import-run-id> --checkpoint <private-checkpoint-path> --json

# Recovery.
node scripts/publish-seed-question-bank.mjs --pause --target <approved-dev> --run <seed-run-id>
node scripts/publish-seed-question-bank.mjs --rollback --target <approved-dev> --run <seed-run-id> --reason <incident-reference>
```

Required backend values on the exact development deployment:

- `SEED_PUBLICATION_ENABLED=true`
- `SEED_PUBLICATION_PLAN_CHECKSUM=71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38`
- `SEED_PUBLICATION_APPROVER=<approver Clerk token identifier>`

The registry entry and `CONVEX_CLOUD_URL` must match. Leave these unset/empty
everywhere else. The checkpoint contains only target, plan, import-run and seed-run
identities; it contains no tokens or content.

## Blockers and boundaries

The live rehearsal remains blocked until all of the following are separately
approved and completed:

1. Exact development deployment approval and target registry registration.
2. Matching taxonomy installation and sealing.
3. Two distinct active admin accounts with short-lived Clerk tokens.
4. A completed import run with the pinned plan and inventory.
5. Explicit approval to enable the seed guard on that deployment.

The #34 admin UI and Playwright journeys remain blocked because the #33 admin
workspace does not yet exist. The bulk backend is available without a UI. This
work does not establish editorial correctness, replace #98, activate pooled exam
selection, calibrate difficulty or guarantee CSC alignment.

## Verification

See [the seed rehearsal verification](seed-publication-verification.md) for the
local commands and results recorded with this change.

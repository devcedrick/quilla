# ADR 0022: One-Time Seed Bootstrap Publication Exception

- **Status:** Accepted policy; local implementation, not executed or deployed
- **Date:** 2026-11-10
- **Decision owner:** Quilla maintainer
- **Related:** #96, #104, #34, #33, #95, #98; ADRs 0016, 0017, 0020 and 0021

## Context and decision

The policy decision is tracked in issue #104. The seven initial seed families contain
1,890 authored questions, 265 references and 59 images. Importing them as drafts does
not make them study material. Ordinary version-by-version editorial review would
leave the initial bank unusable for an extended period, and the maintainer has
already accepted the offline corpus shape and deferred the supplemental exhaustive
audit in ADR 0016.

The maintainer authorizes one narrowly scoped bootstrap exception for that exact
corpus. It applies only to a completed, checksum-pinned plan of seven families at 270
questions each, 1,890 questions in total, with 265 references and 59 images. It is
not a general publication exception, does not lower the editorial bar for later
questions, and does not close the deferred audit in #98.

The bootstrap is developer-only. A developer operator runs a repository CLI that
invokes internal Convex functions with deployment CLI credentials through the
installed Convex CLI's `run` command, using a Convex CLI login or
`CONVEX_DEPLOY_KEY`. It requires no Clerk account, no active admin, no human
approver and no two-admin ceremony. The backend records the same exception through
two non-login system identities so publication stays attributable and auditable.

## Authorization and system actors

Two distinct system users are created on first use:

- `system:seed-bootstrap-importer` owns the bootstrap run and performs staging,
  draft creation, submission and asset reservation.
- `system:seed-bootstrap-approver` records plan-level acceptance and publishes each
  version.

Both have role `system` and are non-login. `requireActiveUser`, `ensureCurrentUser`
and `currentAccess` reject system identities, so they cannot obtain a learner
session, enter the admin application, or act through the public admin APIs. Internally
supplied user IDs never establish authorization for an operator; the functions are
internal Convex functions reachable only through deployment credentials.

The two system actors are distinct from each other and from any canonical
contributor or material version creator. The ordinary no-self-review invariant
therefore remains intact. This is not ordinary editorial review, and it is not a
precedent for human-authored questions.

The target must appear in the reviewed `approvedImportTargets` registry and match the
deployment's `CONVEX_CLOUD_URL`. The registry ships empty; adding a development or
production target is a separate reviewed change. `SEED_BOOTSTRAP_ENABLED=true` is
required only while the bootstrap window is open, and only for `begin`, preflight,
staging and application. `status`, `pause` and `rollback` remain available after the
window is disabled so an operator can finish or clean up an interrupted run.

The CLI's expected plan and the backend constants must both equal the frozen plan and
inventory checksums. Missing or mismatched values fail before any content write.

## Bootstrap run contract

The bootstrap reuses `questionImportRuns` and `questionImportEntries` with
`mode: "bootstrap"`. Runs are `preparing`, `running`, `paused`, `complete` or
`rolled_back`; entries are `pending` or `done` and retain their source descriptor,
outcome and resulting immutable version ID. Status reads are bounded and contain no
question text, answer keys, explanations or storage identifiers.

`begin` is idempotent and atomic. A completed run returns its existing identity. A
paused or lease-expired run resumes with a new generation after reacquiring the
fenced lease. A live lease returns `BOOTSTRAP_BUSY`. A fully rolled-back run may be
retried as a fresh run with the same reviewed plan; a partially rolled-back run must
be fully rolled back first. A second successful bootstrap for the same target is not
allowed, because the exception is one-time.

Staging pins the exact ordered inventory in batches of at most 50 descriptors and
verifies the final hash. Application uses batches of at most ten records and 256 KiB.
Each batch revalidates the source identity/checksum, the sealed taxonomy, reference
and asset dependencies, and the question content before writing. Images are uploaded
to Convex storage through the protected upload-URL path and verified before their
asset records are bound. The CLI retries transient transport failures and expired
leases against the server checkpoint, so a lost response or interrupted batch does
not duplicate content.

## Acceptance and publication

Each question is submitted, accepted and published in the same bounded transaction
that imports it, so the bank becomes usable as items land rather than only after all
1,890 exist. The system approver records an immutable `questionReviews` entry of
kind `bootstrap_acceptance`, decision `accept`, rubric `seed-bootstrap-v1`, carrying
the bootstrap run ID and plan checksum.

The review records five backend-generated evidence entries: the processed pinned
inventory, the reviewed inventory checksum, the frozen corpus policy, revalidation of
question content and its exact reference against the sealed taxonomy, and the
distinct system approver identity. It reuses the review table so acceptance remains
attributable and auditable; it does not fabricate an ordinary `review` decision.

The bootstrap deliberately does not re-run per-item editorial duplicate
adjudication. The plan-level acceptance is the substantive decision under this
exception, and #98 remains the follow-up audit. Every later question version and
every material correction still requires ordinary independent review.

## Serving and lifecycle

Published bootstrap versions are ordinary published versions once written. A version
is learner-servable as soon as it is published, subject to the ordinary serving
checks (published state, recorded approval, revalidated content/reference hashes and
sealed taxonomy). There is no global all-or-nothing gate: an interrupted run leaves
already-published versions available, and the operator can resume until all 1,890
are present.

`bootstrapRunId` on a question version is attribution, not a lifecycle fence.
Ordinary archive operations and serving checks still apply. The ordinary
publish path does not treat the plan-level `bootstrap_acceptance` as an ordinary
approval, so a bootstrap-published version is reactivated only through the
bootstrap retry path. The bootstrap path reuses the ordinary
draft-to-pending-to-approved-to-published transitions and writes system audit
events for submit, accept, publish, resume, pause and rollback.

## Rollback and retry

Rollback is allowed from `paused` or `complete`, never while a lease is actively
running; the CLI pauses a live run first. It archives every bootstrap-published
version in bounded batches with audit events and releases the lease. It never
hard-deletes questions, versions, reviews or attempt history.

A partial rollback leaves the run `paused` and refuses resumption because previously
archived versions cannot be silently mixed with an active publication. Operators
may roll back the remaining items; the run becomes `rolled_back` only when every
bootstrap-published item is archived. A fully rolled-back run may be retried as a
fresh run; the bootstrap may reactivate its archived versions back through pending
review and acceptance under the new run. No other lifecycle state is silently
rewritten.

## Verification and consequences

The local rehearsal uses an isolated synthetic two-family, six-record corpus and the
real CLI policy against the real offline plan. It covers the complete happy path,
serve-as-landed behavior, system-actor creation and login denial, public-path
fences, idempotent completion, resume with a new generation, lease loss, deterministic
source mismatch, pause, archive-only rollback, retry after full rollback and
reactivation. A separate test validates the real offline plan against the frozen
7 × 270 policy, 1,890 questions, 265 references and 59 images. The rehearsal performs
no deployment, target registration, credential use or live database/storage/audit
write.

The bulk backend APIs for #34 (`bulkSubmitForReview`, `bulkPublishVersions`,
`bulkArchiveVersions`) are implemented with per-item results and batch bounds.
They do not provide bulk editorial approval or review, and the admin UI remains
blocked on #33. Live development and production execution are separately approved
operational steps; nothing in this ADR registers a target or authorizes a deployment.
Closing #96 does not require the live 1,890-item import, and actual-content
acceptance remains separate. Nothing in this ADR asserts editorial correctness,
empirical calibration or pooled exam readiness.

# ADR 0022: One-Time Seed Bootstrap Publication Exception

- **Status:** Accepted policy; local rehearsal implemented, not executed or deployed
- **Date:** 2026-11-10
- **Decision owner:** Quilla maintainer
- **Related:** #96, #104, #34, #33, #95, #98; ADRs 0016, 0017, 0020 and 0021

## Context and decision

The policy decision is tracked in issue #104. The seven initial seed families
contain 1,890 authored questions, 265 references and 59 images. Importing them as
drafts does not make them study material. Ordinary version-by-version editorial
review would leave the initial bank unusable for an extended period, and the
maintainer has already accepted the offline corpus shape and deferred the
supplemental exhaustive audit in ADR 0016.

The maintainer authorizes one narrowly scoped bootstrap exception for that exact
corpus. It applies only to a completed, checksum-pinned import of seven families at
270 questions each, 1,890 questions in total, with 265 references and 59 images.
It is all or nothing: no subset may become servable. It is not a general
publication exception, does not lower the editorial bar for later questions, and
does not close the deferred audit in #98.

## Required participants and authorization

Two distinct active admins are required. The importer owns the completed import run
and submits the pinned drafts. A separately pinned approver accepts the plan and
publishes the approved versions. The approver must differ from the importer, the
canonical contributor and the material version creator. Externally supplied user
IDs never establish either role; the backend derives identity from `ctx.auth`, the
run records both participants, and `SEED_PUBLICATION_APPROVER` names the approver's
Clerk token identifier for each operation.

The target must appear in the reviewed `approvedImportTargets` registry, match the
deployment's `CONVEX_CLOUD_URL`, and have `SEED_PUBLICATION_ENABLED=true`. The
CLI's expected plan and the backend's `SEED_PUBLICATION_PLAN_CHECKSUM` must both
equal the plan checksum. The registry ships empty. Missing or mismatched values
fail before any content write.

## Seed run contract

A seed run pins the completed import run, plan checksum, inventory hash, expected
counts, importer and approver. Runs are `preparing`, `running`, `paused`, `complete`
or `rolled_back`; items are `staged`, `submitted`, `approved`, `published` or
`rolled_back`. Status pages are bounded and contain no question text, answer keys,
explanations or storage identifiers. A fenced lease and generation prevent stale
workers; only the importer may stage and submit, and only the approver may accept
and publish. Pausing releases the lease without discarding completed work. A
second plan for the same target is refused even after completion, because the
bootstrap is one-time.

Staging pins each imported question version in reviewed ordinal order and verifies
that it is still a draft created by the importer for the matching family and source
version. Submission uses the ordinary draft-to-pending transition. Acceptance is a
new immutable `questionReviews` record of kind `seed_acceptance`, decision
`accept`, rubric `seed-bootstrap-v1`, carrying the seed run and plan checksum. It
records five backend-generated evidence entries: completed import, exact plan and
inventory, frozen corpus policy, revalidated content/reference hashes, and
independent approver identity. It reuses the review table so the approval remains
attributable and auditable; it does not fabricate an ordinary `review` decision.

The seed path deliberately does not re-run per-item editorial duplicate
adjudication. The plan-level acceptance is the substantive decision under this
exception, and #98 remains the follow-up audit. If this exception is unacceptable,
the alternative is the ordinary version-by-version review path; there is no silent
fallback between them.

## Publication and serving gate

Publication requires every item approved and rechecks the seed acceptance,
independence, exact version and content hash before each transition. The run
becomes `complete` only when all 1,890 versions are published. Until then,
`loadPublishedQuestion` refuses any pinned version even if an individual version
already reached `published`. This global serving gate prevents a partially
published seed from reaching learners. Completing the run releases its lease and
enables ordinary serving.

Ordinary lifecycle operations on a pinned version fail with
`SEED_PUBLICATION_REQUIRED` while its run is incomplete. This prevents another
admin from bypassing the plan or mixing seed and ordinary transitions. After the
run is `complete` or `rolled_back`, normal lifecycle rules apply.

## Rollback

Rollback is allowed from `paused` or `complete`, never while a lease is actively
running. It archives every pinned version in bounded batches with audit events and
releases the lease. It never hard-deletes questions, versions, reviews or attempt
history. A partial rollback leaves the run `paused`, blocks serving, and refuses
resumption because previously archived versions cannot be silently restored.
Operators may roll back the remaining items; the run becomes `rolled_back` only
when all expected items are archived.

## Verification and consequences

The local rehearsal uses an isolated synthetic corpus and two mocked admin
identities. It covers the complete happy path, all-or-nothing serving, the
lifecycle fence, pause/resume, expired and stale leases, nonparticipant denial,
the two-admin and approver-pin checks, target and environment guards, ordered
staging, batch bounds, duplicate pins, phase ordering, rollback and idempotent
retries. A separate test validates the real offline plan against the frozen policy.
The rehearsal performs no deployment, target registration, credential use or live
database/storage/audit write.

The bulk backend APIs for #34 (`bulkSubmitForReview`, `bulkPublishVersions`,
`bulkArchiveVersions`) are implemented with per-item results and batch bounds.
They do not provide bulk editorial approval or review, and the admin UI remains
blocked on #33. The development rehearsal in #96 remains optional and blocked
pending explicit target approval, taxonomy installation, credentials and two
admin actors. Nothing in this ADR asserts editorial correctness, empirical
calibration or pooled exam readiness.

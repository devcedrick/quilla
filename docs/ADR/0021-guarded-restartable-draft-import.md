# ADR 0021: Guarded Restartable Question-Bank Draft Import

- **Status:** Accepted design; local implementation, not deployed; seed publication clarified by ADR 0022
- **Date:** 2026-11-08
- **Decision owner:** Quilla maintainer
- **Related:** #95, #96; ADRs 0018–0020, 0022; deferred editorial audit #98

The maintainer approved the [implementation contract](../content/question-import-implementation-proposal.md).
The CLI reuses the offline seed validator and consumes its exact validated
snapshot. Default execution is offline and has zero database, storage or audit
writes. Explicit target preflight is read-only. Applying a plan requires explicit
intent, its checksum, an approved development target, a separately enabled backend
and an active-admin Clerk identity. The target registry ships empty.

Persist runs and per-record receipts separately from canonical content. Pin source
IDs/versions, family membership and manifest revisions/checksums using portable
record hashes and an ordered inventory hash. Backend hashes remain separate
because resolved database IDs are deployment-specific. Neither kind of hash proves
editorial quality, correctness, approval or exam readiness.

Use bounded client-coordinated batches and a transactional fenced lease. Reuse
existing lifecycle and protected asset operations; new question versions are drafts
only. Exact reruns reuse immutable records; conflicting content requires an explicit
new version. Preserve attribution and independent review, and never reinterpret
offline approval flags as authority. Domain changes and durable receipts/audit
events are atomic within each metadata batch. Image uploads require separate
reconciliation and compensating deletion after failed binding; a crash before
binding may leave a private orphan blob for separately authorized reconciliation.

Server checkpoints are authoritative. Interrupted runs retain completed drafts,
release or expire their lease, and can resume under the same owner and plan with
fresh authentication. Stale workers cannot complete writes after generation
changes. No publication, learner-serving API, deployment, live import, taxonomy
installation, automatic storage sweep or historical-attempt mutation is included.

## Seed publication handoff

[ADR 0022](0022-one-time-seed-bootstrap-publication.md) adds a separate protocol
that consumes a completed import run; import itself still never publishes.
The seed CLI verifies the frozen 7 × 270 corpus, requires two distinct admins and
a pinned plan, then stages and submits as the importer before the approver accepts
and publishes. The target registry remains empty, and no live import or publication
is included in this local implementation. Interrupted seed runs pause and resume
under the same plan; rollback archives rather than deletes. The supplemental audit
in #98 remains open.

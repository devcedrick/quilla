# Issue #95: guarded draft importer

## Approval and boundary

The maintainer approved the implementation plan and its proposed import tables,
active-admin authorization and development-target guards in this conversation.
This document records that concrete contract. Approval does not include deployment,
target registration, environment changes, admin provisioning, live writes,
publication or audit-stash restoration. Commits, a push and a new issue-linked PR
were subsequently authorized separately.

## Additive schema

`questionImportRuns` stores the initiating admin, exact target identifier/URL,
manifest corpus IDs/revisions/checksums, taxonomy/blueprint IDs, expected record
counts, portable plan/inventory checksums, staged counts per family/kind, progress,
state, fenced lease and timestamps. Its indexed access paths are target URL/lease expiry
and target/plan checksum. State is preparing, running or complete. Interruptions
retain state and progress, record a sanitized failure code and release the lease.

`questionImportEntries` stores run ID, ordinal, record kind, canonical source ID,
source version (zero only for unversioned assets), family, source checksum,
pending/done status, created/reused outcome, resulting database ID and optional
failure code. Index by run/ordinal and run/kind/source ID/version. Membership in
the run's pinned family manifest is retained without duplicating content records.
No update/delete content API or audit-event mutation is introduced.

## API and authority

Public `questionImports` endpoints serve the operator CLI: `preflight`, `begin`,
`stage`, `renew`, `applyBatch`, `interrupt` and `status`. The sole public action is
`questionImportActions.uploadAsset`. Existing identity guards derive the acting
user from Clerk; run access additionally requires its original owner. Arguments
and returns are validated. Internal upload lookup/completion are not public APIs.

The shared approved development-target registry is empty. All import endpoints
fail closed unless a reviewed target matches the backend's `CONVEX_CLOUD_URL`
and `QUESTION_BANK_IMPORT_ENABLED` is exactly `true`. The CLI resolves URLs only
from that registry. No `.env.local` loading, deployment-key impersonation, new
sign-in flow, or environment changes are included. The guard follows existing
server `process.env` access; generated files remain untouched. Typed generated
environment bindings may be adopted during separately authorized code generation.

Only one live import lease exists per target. Begin is transactional; expired
leases may be replaced. Resume requires the same owner and exact plan and advances
the generation. Every import mutation checks generation and five-minute expiry;
image actions check expiry before storage and fence completion again transactionally.
Completed identical plans are no-ops. Cross-plan identical content is reused by
the lifecycle; new administrative run/checkpoint events still describe that new
operation. Repeating the same completed plan adds no success events.

## Integrity and recovery

Validate and retain the same in-memory source/asset snapshot. Each descriptor
contains a portable SHA-256 of its complete source record. An ordered hash chain
pins every descriptor; the plan hash pins that chain and manifest identities.
Stage all descriptors before creating content, reject duplicate identities and
out-of-order kinds, and verify counts and the final chain before execution.
These checks establish integrity, not factual accuracy or independent approval.

Apply assets before references before questions. Resolve exact canonical IDs and
versions through existing indexed storage and lifecycle helpers. Metadata batches
contain at most ten records and 256 KiB; an image request contains one image under
the existing 1 MiB limit. New questions are drafts. Existing workflows, attribution,
versions, protected asset boundaries and historical attempts are not rewritten.

Question/reference mutations and receipts/audit events commit atomically. Image
reservation and upload are separate operations: verified blobs are reused after a
lost response, rejected bindings compensate newly stored blobs, and pending
reservations remain recoverable. A process crash between blob storage and binding
can leave an unassociated blob; no automatic deletion job or claim of cross-action
atomicity is introduced. Such storage reconciliation requires a separately
authorized operation; it cannot make a question approved or publicly readable.

Local checkpoints contain no content or token and are hints only. Read the server
checkpoint on resume. On failure, stop without deleting completed drafts, record
only an allowlisted failure code when still authorized, and return run/plan IDs.
An expired token or lost lease cannot authorize an interruption write.

## Verification and delivery

Use deterministic in-memory Convex fixtures, offline seven-family validation and
CLI transport tests. Run repository lint, typecheck, units, Knip, production build,
changed-file formatting and whitespace checks. Browser E2E is unnecessary unless
a browser journey changes. Deployment/schema-push verification remains explicitly
deferred; the implementation does not run `convex dev` or import live data.

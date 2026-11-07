# ADR 0018: Record Admin Audit Events in the Domain Transaction

- **Status:** Accepted design; implemented locally, not deployed
- **Date:** 2026-11-06
- **Decision owner:** Quilla maintainer
- **Related:** #24 and #95

## Decision

The maintainer explicitly approved the new audit table, indexed admin-only reads
and unregistered transactional helper described in the
[audit implementation proposal](../content/admin-audit-implementation-proposal.md).

Use Convex `auditEvents` records containing durable actor/entity identities,
action, mutation-time timestamp and bounded JSON before/after snapshots. A
trusted domain mutation calls `appendAdminAudit` with explicitly allowlisted
snapshots. The helper derives the actor through the existing `requireAdmin` guard;
there is no public append endpoint, caller-supplied authority, deferred write or
separate audit database. A failure rolls back both the domain and audit changes.

Expose only paginated active-admin reads by recent time, actor or entity using
dedicated indexes. Application APIs provide no audit update/delete operations.
Direct database operators remain outside the application's append-only boundary.
Do not store credentials, raw request objects, tokens or full user profiles in
snapshots. Invalid/oversize snapshots fail rather than silently truncate evidence.

## Consequences and verification

Later taxonomy, question and import mutations must integrate this helper inside
their own transactions. The helper does not automatically instrument existing
profile changes, grant admin status or authorize new domain actions. Idempotent
domain no-ops must avoid generating duplicate successful audit events.

Use in-memory tests for role/identity enforcement, pagination and filters,
snapshot bounds, server-derived attribution and transaction rollback. Generated
API files are not hand-edited. Deployment validation and normal API generation
are deferred to a separately authorized Convex workflow. This approval does not
authorize deployment, migration, import, publication or changes to authentication.

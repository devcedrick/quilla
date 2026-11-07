# ADR 0019: Manage Immutable Sealed Taxonomy Catalogs

- **Status:** Accepted design; local implementation, not deployed
- **Date:** 2026-11-07
- **Decision owner:** Quilla maintainer
- **Related:** #29, #24, #32 and #95

The maintainer approved the [concrete taxonomy proposal](../content/taxonomy-implementation-proposal.md).
Store catalog versions and discriminated entries in separate indexed tables.
Active admins edit bounded drafts using expected revisions. Every real mutation
records an allowlisted audit snapshot in the same transaction; unchanged upserts
do not duplicate success events. Identity comes from existing backend guards.

Validate relationships, foundational keys and level subsets on each write,
including affected children. Reject archival of a draft parent with active
children. Sealing requires the complete foundational hierarchy and concept
coverage in each subject; sealed entries are immutable. New consumers require
exact sealed, nonarchived catalogs and active matching entries. Historical reads
preserve archived versions. Corrections use new catalogs and explicit new
consumer versions, never retargeting existing question/attempt history.

The v2 fixture retains all 12 approved concepts and is checked against the offline
seed policy. Legacy v1 policy and accepted ADRs remain unchanged. This provides
management primitives, not automatic catalog installation, question lifecycle,
blueprint activation or import. Generated bindings are not hand-edited; normal
API generation and live schema verification await separately authorized tooling.

In-memory tests cover roles, validation, immutable/historical lookup, pagination,
no-op audit behavior, competing revisions and transactional rollback. No
deployment, live writes, admin provisioning or publication is authorized here.

# Protected implementation proposal for #29: versioned taxonomy management

**Status: approved by the maintainer on 7 November 2026; implemented locally,
not deployed. See [ADR 0019](../ADR/0019-versioned-taxonomy-management.md).**

This is the next prerequisite after the locally implemented #24 audit foundation.
It covers reference data only, not question storage, blueprint activation or live
initialization. The current approved seed contract is `cse-taxonomy-2027-v2`;
`scripts/question-bank-policy.mjs` also retains a separate historical v1 policy.
Neither that legacy policy nor accepted ADRs will be rewritten.

## Proposed storage

Add two tables to the existing Convex schema:

| Table              | Fields and indexes                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taxonomyVersions` | Unique `taxonomyId` string; `state` union `draft`, `sealed`, `archived`; integer `revision`; `createdBy: Id<"users">`; creation/update timestamps. Index `by_taxonomyId`; index `by_state`.                                                                                                                                              |
| `taxonomyEntries`  | `taxonomyVersionId: Id<"taxonomyVersions">`; `kind` union `level`, `subject`, `subtopic`, `concept`, `difficulty`, `language`; stable `key`; display `label`; `archived` boolean; kind-specific relationship fields below. Indexes `by_taxonomyVersionId`, `by_taxonomyVersionId_and_kind`, and `by_taxonomyVersionId_and_kind_and_key`. |

Use discriminated validators for entries. Subjects specify level keys; subtopics
specify a subject key and level keys; concepts specify subject/subtopic keys and
level keys. Level, language and difficulty entries have no parent fields. Stable
identity is `(taxonomyId, kind, key)`, not a display label. Parent keys resolve
within the same taxonomy version. Duplicate identity is rejected transactionally.

A version contains at most 128 entries. Identifiers use lowercase ASCII letters,
digits, underscores and hyphens (1–100 characters); labels are nonblank, at most
200 characters. Relationship lists are unique and nonempty. Current levels are
`professional` and `subprofessional`; difficulties are `easy`, `medium`, `hard`;
languages are `english`, `filipino`. The five approved subjects retain their
existing keys. Future changes to these foundational enums require an explicit
product-policy decision rather than a management request bypassing validation.

## APIs and authorization

Add `convex/referenceData.ts`, supported by `convex/lib/taxonomy.ts`:

- `createDraft({ taxonomyId })`: active admin only; create an empty draft with
  revision 1. Reject an existing identifier; never overwrite a sealed version.
- `upsertEntry({ taxonomyVersionId, expectedRevision, entry })`: active admin
  only; validate the complete candidate against its parents, level eligibility
  and affected children; insert or update a draft entry and increment revision.
- `archiveEntry({ taxonomyVersionId, expectedRevision, kind, key })`: active
  admin only; draft-only soft archival. Reject if any nonarchived child depends
  on the entry. No implicit child archival or automatic reassignment.
- `sealVersion({ taxonomyVersionId, expectedRevision })`: active admin only;
  require a complete consistent hierarchy, both levels, the five subjects and
  all approved language/difficulty values. Freeze every entry in that version.
- `archiveVersion({ taxonomyVersionId, expectedRevision })`: active admin only;
  mark the draft or sealed version archived, preserve all entries and historical
  identity, and reject future mutation or new consumer adoption of that version.
- `listVersions({ state?, paginationOpts })` and
  `listEntries({ taxonomyVersionId, kind?, paginationOpts })`: active admin only;
  indexed native pagination with integer page sizes 1–100.
- `getEntry({ taxonomyVersionId, kind, key })`: active admin only; exact indexed
  lookup including archived entries, returning null if absent.

Every public operation uses the existing `requireAdmin`; it never trusts a
client-supplied actor or role. Every registered function has argument and return
validators. All writes compare the expected revision and lifecycle state inside
the mutation and increment the revision atomically. An unchanged upsert is a
validated no-op without a duplicate success audit event. Clients receive stable
error codes for stale revision, missing parent, duplicate identity, referenced
parent, invalid eligibility and immutable/archived version conflicts.

Actual changes call #24's `appendAdminAudit` in the same transaction, with
allowlisted entry or version-metadata snapshots, never an unbounded catalog
snapshot. Audit failure rolls back the taxonomy change and its revision.

## Integrity and historical consumers

Subtopic applicability must be a subset of its subject's levels; concept
applicability must be a subset of both subject and subtopic. Analytical accepts
Professional only, Clerical accepts Subprofessional only, and the approved shared
subjects retain both levels at subject level. A concept's subject must match its
subtopic's subject. Parent edits cannot invalidate active children. Archived
entries cannot become parents of new active records.

Expose unregistered, typed server lookup/validation helpers for later #30/#32/#95
consumers. New consumers must resolve an exact sealed, nonarchived taxonomy
version and active entries, validate the complete subject/subtopic/concept path,
level applicability, language and difficulty, and reject unknown identifiers.
These helpers do not create missing taxonomy records or accept display labels
as keys. No public learner query or direct client access is added.

Consumers may reference only sealed versions. Consequently, draft edits cannot
alter referenced records, and sealed entries cannot be edited or hard-deleted.
Correcting or reassigning taxonomy requires authoring a new taxonomy version and
explicitly adopting it in a new consumer version; do not retarget existing
question, mastery, blueprint or attempt history. Archiving a taxonomy is a
retirement marker, not deletion or automatic question unpublication. Existing
historical resolution remains available. Consumer eligibility and blueprint
activation behavior remain owned by their later issues.

Read a draft hierarchy through its version index with `take(129)`; reject an
oversize/inconsistent catalog rather than scanning an unbounded table. The
per-version write/revision check serializes concurrent entry edits and sealing.
Avoid a new generic reference-counter table: immutable sealed catalogs eliminate
destructive edits without guessing the schemas of future consumers.

## Initial catalog and tests

Provide a local typed v2 catalog fixture with the approved 12 concepts and their
relationships, plus both levels, five subjects, three difficulties and two
languages. Test its identifiers and relationships against `seedPolicy` and the
documented contract. Keep v1 spelling placement and other legacy fixtures
historical; do not substitute v1 for v2 or claim the offline validator lacks its
already implemented seed-mode support. No live catalog installation is included.

Use convex-test with synthetic users and typed in-memory API references. Cover:

- Active-admin create/edit/seal/archive/read; pagination and bounded reads.
- Anonymous, missing-profile, nonadmin and suspended callers on all public APIs.
- Duplicate keys, dangling/cross-version parents, mismatched subject paths,
  duplicate/empty level lists and forbidden Professional/Clerical or
  Subprofessional/Analytical relationships.
- Parent changes/archival with active children; stale revisions and competing
  edit/seal operations; sealed immutability and archive preservation.
- Exact consumer lookup rejecting missing, draft, archived or incompatible data;
  historical lookup retaining old immutable contents after a new version exists.
- Atomic domain/audit rollback, no-op audit deduplication, entry/label/count bounds
  and v2 fixture parity with the existing offline policy.

Run lint, typecheck, full units, Knip, formatting, whitespace and build checks.
Report the existing Next.js security build failure if it persists; do not upgrade
dependencies or bypass a security gate as part of this change. E2E is unnecessary
until a browser journey adopts these APIs. Do not hand-edit generated bindings.

## Approved boundary

The maintainer approved these two tables, indexed admin-only management/read
APIs, internal consumer validators and transactional audit integration for #29.
This does not authorize
admin provisioning, changes to authentication, blueprint/question/import schemas,
deployment, migration, live seeding, publication or commits/pushes. Those later
protected changes still need their own concrete proposals and approvals.

## Local verification — 7 November 2026

The complete unit suite passed 410 tests. The final focused run passed all seven
taxonomy tests after adding the explicit v2 sealing-completeness regression.
Lint, typecheck, Knip, scoped formatting and whitespace checks passed. The build
compiled, typechecked and generated all pages, then failed with the existing
Next.js `SecurityFatalError` reporting a vulnerable installed version; dependency
remediation remains separate. It also warned about a lockfile outside the repo.
E2E was skipped because no browser journey changed. No deployment, live catalog
installation or hand-edited generated bindings were involved. Normal supported
API generation and live schema validation remain deferred until authorized.

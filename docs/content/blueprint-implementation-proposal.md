# Protected implementation proposal for #30: versioned blueprint validation and snapshots

**Status: approved for local implementation on 15 November 2026; implemented
locally, not deployed. See [ADR 0025](../ADR/0025-versioned-blueprint-activation-and-attempt-snapshots.md).**

This builds on the locally implemented #29 taxonomy management and #24 audit
foundation. It covers blueprint configuration, activation and immutable attempt
snapshots only. It does not create an `attempts` table, generate exam questions,
run a coverage dry run, install reference data, or activate a live blueprint.

## Proposed storage

Add three tables to the existing Convex schema:

| Table                | Fields and indexes                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blueprintVersions`  | Unique `blueprintId`; `level`; lifecycle `state` (`draft`, `active`, `archived`); integer `revision`; pinned `taxonomyVersionId`; optional full `configuration`; optional `contentHash`; stored configuration format version; creator/updater/activation/archival metadata and timestamps. Indexes for exact identity, level/state/created ordering, level/created ordering, state/created ordering and global created ordering. |
| `activeBlueprints`   | One per-level pointer: `level` (unique in practice), `blueprintVersionId`, activating admin and timestamp. Index `by_level`.                                                                                                                                                                                                                                                                                                     |
| `blueprintSnapshots` | Immutable copy of the exact active configuration: `level`, source `blueprintVersionId` and `blueprintId`, `taxonomyVersionId`, configuration format version, full `configuration`, `contentHash` and creation time. Indexes `by_blueprintVersionId` and `by_level_and_createdAt`. No update or delete API is exposed. Later attempts link to this row; #30 does not add an attempt foreign key.                                  |

A blueprint configuration contains the complete self-describing contract:

- scored item total, scaled duration in minutes, passing score and passing ratio
  in basis points;
- a difficulty mix as integer percentages;
- subject/module/difficulty cells, including the `shared-core`,
  `professional-numerical`, `analytical` and `clerical` modules;
- exact subject-level language totals; and
- one minimum coverage count per applicable taxonomy concept.

Collection sizes are bounded: at most 32 cells, 32 language totals and 32 concept
requirements, with the normalized configuration capped at 8 KiB.

## Validation

`convex/lib/blueprintValidation.ts` is a pure validation matrix used identically
by save and activation:

- Total scored items must equal the sum of cells and the level's documented
  subject totals.
- Module totals must preserve ADR 0013's 105 shared items and each level's
  extension/permitted modules. Professional rejects Clerical; Subprofessional
  rejects Analytical and the Professional Numerical extension.
- Cell counts are positive integers; duplicate module/subject/difficulty cells
  are rejected, and the configuration must contain exactly the approved
  subject/module difficulty cells from
  `docs/exams/cse-taxonomy-and-blueprints.md`. Redistributing counts between
  subjects is rejected even when subject, module and aggregate difficulty totals
  still match.
- Difficulty percentages must be integers and exactly equal the level's approved
  30/50/20 mix. Each aggregate difficulty count must fall within the floor and
  ceiling of its target, so Subprofessional may use 43/73/29 against 30/50/20.
- Every subject total must be covered by exact language totals. Verbal Ability is
  25 English and 25 Filipino; all other subjects are English only.
- Every nonarchived concept applicable to the level must appear exactly once with
  a positive minimum no greater than its subject total. Professional requires the
  nine applicable v2 concepts; Subprofessional requires ten.
- The duration must equal the official minutes scaled by scored-item share and
  rounded to the nearest minute: 168 Professional and 141 Subprofessional.
- The passing reference must use the approved 80% ratio and the resulting ceiling:
  120 of 150 and 116 of 145.

The sealed taxonomy is the authority for subject, language and concept identity,
level eligibility and the subject/subtopic/concept path. A sealed catalog with an
archived entry can no longer be referenced. Validation never checks question-bank
coverage; that remains #35.

## APIs and authorization

Add `convex/blueprints.ts`, supported by `convex/lib/blueprints.ts`:

- `createDraft({ blueprintId, level, taxonomyVersionId })`: active admin only;
  require a unique stable identifier and a sealed taxonomy, then create revision 1.
  The duplicate check tolerates pre-existing duplicate rows and concurrent
  attempts by reporting `DUPLICATE_IDENTITY` instead of a raw index error.
- `saveConfiguration({ blueprintVersionId, expectedRevision, configuration })`:
  active admin only; draft-only, normalize, validate, hash under the current
  format version, persist the content hash and format version, and increment the
  revision atomically. An unchanged normalized save is a validated no-op without
  a duplicate audit event.
- `activateVersion({ blueprintVersionId, expectedRevision })`: active admin only;
  revalidate the stored configuration against the sealed taxonomy, verify its
  content hash, freeze the draft, supersede the previous active version for that
  level, and update the active pointer in one transaction.
- `archiveDraft({ blueprintVersionId, expectedRevision })`: active admin only;
  retire an unused draft without creating an executable configuration.
- `listVersions({ level?, state?, paginationOpts })`, `getVersion` and
  `getActive`: active admin only; indexed pagination with page sizes 1–100 and
  exact reads.
- Unregistered `loadSealedTaxonomy`, `loadActiveBlueprint`,
  `verifyBlueprintContentHash` and `createBlueprintSnapshot` helpers for later
  #54 consumers. The snapshot helper copies the active configuration and verifies
  its hash; it does not authorize a learner or create an attempt.

Every public function derives the actor through `requireAdmin`; no client-supplied
role or actor is trusted. Every real mutation writes an allowlisted audit event
through `appendAdminAudit` in the same transaction. Activation records both the
new version's activation and the superseded version's archival, including the
replacement identity.

## Integrity and lifecycle

A version is mutable only while `draft`. Activation requires a saved, valid
configuration. Once active, the configuration cannot be edited or archived
directly; a replacement version must be activated, which archives the predecessor.
Archived versions retain their exact configuration for history.

Snapshots are insert-only copies. They capture the exact blueprint version,
taxonomy version, format version, configuration and content hash. Each blueprint
version stores the format version it was hashed under, and hashing dispatches on
that stored value: format 1 is the frozen legacy payload, while format 2 also
binds the exact `blueprintVersionId` and stable `blueprintId`. Activation and
snapshot creation verify and label with the stored format, and unsupported stored
formats fail closed with `UNSUPPORTED_FORMAT_VERSION`. The current save format is
2; format 1 remains verifiable so previously hashed versions keep working.
Superseding the active blueprint never changes an existing snapshot. Active
blueprints remain usable for new snapshots if their taxonomy is later archived,
because the pinned configuration is self-describing; creating a new draft or
activation requires a sealed taxonomy. Historical snapshots never resolve through
mutable current policy.

Concurrency uses expected revisions for draft saves, activation and archival, and
Convex serializes the per-level pointer update. A stale revision, non-draft
version, invalid configuration, incomplete draft, archived taxonomy or mismatched
content hash fails closed without a partial write. Reading an active blueprint
verifies that the level has at most one pointer, that exactly one active version
exists, and that the active version matches the pointer, belongs to the requested
level and has its configuration, hash and format version. Duplicate pointers, a
missing pointer with an active version, and extra active versions alongside a
pointer all fail closed. Activation reuses that validated lookup before archiving,
so a corrupted pointer cannot archive another level's active version.

## Initial fixture and tests

Provide `convex/lib/blueprintFixture.ts` with the approved v3 configurations:
Professional 150 items (45/75/30), 168 minutes, 120 passing; Subprofessional
145 items (43/73/29), 141 minutes, 116 passing. Both pin `cse-taxonomy-2027-v2`
and retain a separate `blueprintId` per version. No installation or activation is
included.

Tests use convex-test with synthetic users, the `convexTest(schema, modules)`
helper and generated `api` references. `blueprints.test.ts` follows that
guideline now that the regenerated bindings include the blueprint module. Cover:

- Every validation rule, including totals, module/level eligibility, exact
  subject/module difficulty cells, difficulty rounding, language exactness,
  concept coverage, timing, passing and bounds.
- Fixture parity with the documented v3 contract and offline seed policy.
- Admin create/save/activate/archive/read and indexed pagination.
- Anonymous, missing-profile, nonadmin and suspended-admin callers on every
  public function.
- Stale revisions, duplicate identities (including pre-existing duplicates and
  concurrent drafts), missing configuration, hash tampering, non-draft mutation,
  inactive snapshot creation and unsupported stored formats.
- Cross-level active-pointer corruption rejected on read, snapshot creation and
  activation without changing either level.
- Duplicate active pointers rejected deterministically instead of raising a raw
  multiple-documents error.
- A lost active pointer with an orphaned active version, or a pointer with an
  extra active version, rejected on read, snapshot creation and activation
  without creating or changing active versions.
- Persisted format versions drive activation verification and snapshot labelling,
  including a legacy format 1 version that still activates and snapshots while
  the current save format is 2, and identity binding that rejects a repointed
  snapshot hash.
- An unchanged normalized save returns the same revision without changing the
  stored document, `updatedAt` or save audit history.
- Supersession per level, pointer isolation between levels, snapshot immutability
  after replacement, and unusability of archived taxonomies for new versions.
- Exact actor attribution and transactional audit behavior.

Run lint, typecheck, full unit tests, Knip, formatting and build checks. Report the
existing Next.js security build failure if it persists; do not upgrade
dependencies or bypass a security gate as part of this change. E2E is unnecessary
until a browser journey adopts these APIs. Do not hand-edit generated bindings.

## Approved boundary

The maintainer approved these three tables, the public admin blueprint APIs, the
internal snapshot validation helpers and transactional audit integration for #30.
This does not authorize coverage gating, exam generation, an attempts table,
admin provisioning, changes to authentication, deployment, migration, live
reference-data installation, blueprint activation or commits/pushes. Those later
protected changes still need their own concrete proposals and approvals.

## Local verification — 15 November 2026

The complete unit suite passed 630 tests across 46 files. The focused blueprint
suite passed all 18 tests covering the validation matrix, activation, supersession,
competing activations, snapshot immutability, authorization, stale revisions,
transactional audit rollback and pagination. Lint, typecheck, Knip, scoped Prettier
and whitespace checks passed.
The production build compiled, typechecked and generated all pages successfully.
E2E was skipped because no browser journey changed. No deployment, live
catalog/blueprint activation or hand-edited generated bindings were involved.
Normal supported API generation is included in this change; live schema
validation and deployment remain deferred until authorized.

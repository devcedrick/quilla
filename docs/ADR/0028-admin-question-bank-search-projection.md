# ADR 0028: Admin Question-Bank Search Projection and Workspace

- **Status:** Accepted design; local implementation, not deployed
- **Date:** 2026-11-20
- **Decision owner:** Quilla maintainer
- **Related:** #33, #15, #25, #40, #41; ADRs 0006, 0017 and 0020

## Context

The S15.3 workspace must let active admins combine lifecycle, taxonomy,
difficulty, level, origin, contributor and full-text filters over immutable
question versions, then inspect content, review history and currently allowed
actions. The lifecycle backend from ADR 0020 stored content, taxonomy identity
and workflow state on each version, but it exposed only a state-filtered
version list and did not provide authoring catalog options or reference
previews.

Convex can index dot-separated nested fields, so some content values could be
indexed in place. That alone cannot support this workspace: full-text search
combines the stem, choices, explanation and provenance author into one search
field; level eligibility is derived from an array; and canonical question and
contributor identities live on another table. Client-side filtering would scan
an unbounded table and could not support a stable paginated workspace. Deriving
the values at read time would prevent use of an index entirely. Patching
existing version rows during migration would also blur the separation between
authored content, its content hash and derived metadata.

Reports and flags do not exist yet (#40 and #41), and initial-admin
provisioning is still tracked by #25. The workspace therefore cannot depend on
those features to be complete or testable.

## Decision

Add one derived, immutable search projection to every `questionVersions` row:

```ts
(canonicalQuestionId,
  contributorId,
  searchText,
  family,
  module,
  subjectId,
  subtopicId,
  conceptId,
  difficulty,
  language,
  origin,
  professionalEligible,
  subprofessionalEligible);
```

`searchText` joins the canonical question ID, stem, choice texts, explanation
and provenance author. The level booleans derive from
`levelApplicability`. `canonicalQuestionId` and `contributorId` duplicate
stable identities from `questions` so filters do not require a second read or
an unbounded join.

New versions receive the projection at insert time in every authoring path:
`createDraft`, `createRevision`, `importQuestionDraft` and the bootstrap
importer. It is not part of `contentHash` or `contentFingerprint`; those hashes
must continue to identify authored content, taxonomy identity and reference
identity alone. A projection builder in
`convex/lib/questionSearchProjection.ts` is the single source for its values.

Existing rows predate the projection, so the schema fields are optional during
the staged rollout. `convex/adminQuestionBankBackfill.ts` contains internal,
cursor-based batches for question projections and reference scopes. It is not
scheduled or invoked by the application, and it must not run against a
deployment until a separate migration is approved. A later change can make the
fields required after that backfill completes.

Add indexes for bounded admin access. These index only declared top-level
projection fields, never nested `content`:

- `by_createdAt`
- `by_state_and_createdAt`, `by_family_and_createdAt`,
  `by_module_and_createdAt`, `by_subjectId_and_createdAt`,
  `by_subtopicId_and_createdAt`, `by_conceptId_and_createdAt`,
  `by_difficulty_and_createdAt`, `by_language_and_createdAt`,
  `by_origin_and_createdAt`, `by_professionalEligible_and_createdAt`,
  `by_subprofessionalEligible_and_createdAt`,
  `by_contributorId_and_createdAt` and
  `by_canonicalQuestionId_and_createdAt`
- `taxonomyVersions.by_state_and_createdAt` for the newest sealed catalogs
- search index `by_searchText` with the same equality fields as filter fields,
  including the level booleans and origin

At most one selective index drives a non-search query; the remaining equality
predicates are applied to that result. Combined filters therefore preserve
bounded reads while remaining fully composable. A search query accepts at most
eight equality filters, so it spends those slots on the most selective values
and re-applies every requested predicate after retrieval. Search and non-search
pagination both cap rows and bytes read so an uncommon filter cannot scan an
unbounded range.

For reference selection, duplicate only the immutable reference scope
(`family`, `module`, `language`) onto `questionReferenceVersions` and add
`by_scope_and_createdAt`. These fields are also optional until the staged
backfill runs. The admin picker reads at most 101 scoped rows, returns the
newest version of each compatible reference, and stops at 100 options with an
explicit overflow flag. One extra row is enough to detect overflow while
staying below the transaction limit for bounded reference content. The preview
query resolves one exact version, rechecks its content hash and returns storage
URLs only for verified assets.

Add admin-only queries that each call `requireAdmin(ctx)` before reading:
`listAdminVersions`, `getAdminVersion`, `listAdminQuestionVersions`,
`listAdminAuthoringOptions`, `questionReferences.listAdminOptions` and
`questionReferences.getAdminPreview`. Public argument validation rejects
invalid field syntaxes, page sizes and taxonomy selections. `getAdminVersion`
accepts a route string, normalizes it to a version ID and returns `null`
instead of throwing for malformed or missing IDs.

Build the local workspace under `/admin/questions`:

- the bank combines search and all supported filters;
- the authoring form creates a canonical draft or appends an immutable
  revision and may select an existing compatible reference;
- the detail view shows exact content, taxonomy identity, hashes, review
  history and immutable version history;
- lifecycle controls appear only for states and actors the backend permits.

The UI never acts as authorization. Every action still runs the backend
transition, revision, independence, rubric and duplicate checks.

`/admin` redirects active admins to `/admin/questions`. Active non-admins and
unknown admin paths return not found. Signed-out, missing-profile, inactive and
suspended access states use the existing account access shell rather than
leaking whether an admin route exists. Playwright coverage is limited to those
access states until #25 provides a supported admin provisioning path; component
and backend tests cover filters, forms and lifecycle actions.

## Consequences

- Admin filtering and search are indexed and bounded without changing
  immutable content or serving behavior.
- The projection duplicates some content-derived values. Every insert path
  must use the shared builder; a future authoring path that forgets it will
  fail tests rather than silently producing incomplete rows.
- Legacy rows remain readable because the projection and reference scope are
  optional. Correct filtering of legacy rows requires the internal backfill,
  which remains unexecuted. Deployment, live backfill and making the fields
  required each need separate approval.
- Reports and flags remain deferred to #40 and #41. Contributor filtering uses
  opaque user IDs until #25 supplies an admin account workflow.
- Reference authoring and reference version creation remain outside this
  workspace; the form only selects an existing immutable version.

## Rejected alternatives

- **Client-side filtering:** unbounded table scans, unstable pagination and
  unnecessary data exposure.
- **Read-time derivation without stored fields:** cannot use a Convex index or
  search index.
- **Relying only on nested content indexes:** Convex supports nested paths, but
  they cannot provide the combined search text, derived level eligibility or
  duplicated identities, and they would bind admin queries to the content
  shape.
- **Patching existing versions:** violates immutable version history and
  obscures content-hash meaning.
- **Hiding unauthorized actions only in the UI:** backend authorization and
  lifecycle checks remain authoritative.
- **Shipping report and flag filters now:** their data model and workflows do
  not exist and are tracked separately.

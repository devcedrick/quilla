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

Convex indexes operate on declared top-level fields. Most filter values lived
inside immutable `content`, so they could not be indexed directly. Client-side
filtering would scan an unbounded table and could not support a stable
paginated workspace. Deriving the values at read time would prevent use of an
index entirely. Patching existing version rows during migration would also blur
the separation between authored content, its content hash and derived metadata.

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

The projection is written only at insert time in every authoring path:
`createDraft`, `createRevision`, `importQuestionDraft` and the bootstrap
importer. It is never patched. It is not part of `contentHash` or
`contentFingerprint`; those hashes must continue to identify authored content,
taxonomy identity and reference identity alone. A projection builder in
`convex/lib/questionSearchProjection.ts` is the single source for its values.

Add indexes for bounded admin access:

- `by_createdAt`
- `by_state_and_createdAt`, `by_family_and_createdAt`,
  `by_subjectId_and_createdAt`, `by_subtopicId_and_createdAt`,
  `by_conceptId_and_createdAt`, `by_difficulty_and_createdAt`,
  `by_language_and_createdAt`, `by_contributorId_and_createdAt` and
  `by_canonicalQuestionId_and_createdAt`
- search index `by_searchText` with the same equality fields as filter fields,
  including the level booleans and origin

At most one selective index drives a query; the remaining equality predicates
are applied to that result. Combined filters therefore preserve bounded reads
while remaining fully composable.

For reference selection, duplicate only the immutable reference scope
(`family`, `module`, `language`) onto `questionReferenceVersions` and add
`by_scope_and_createdAt`. The admin picker returns the newest version of each
compatible reference, bounded to 100 options with an explicit overflow flag.
The preview query resolves one exact version, rechecks its content hash and
returns storage URLs only for verified assets.

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

`/admin` redirects active admins to `/admin/questions` and returns not found to
every other account, including unknown admin paths. Playwright coverage is
limited to signed-out and non-admin access until #25 provides a supported admin
provisioning path; component and backend tests cover filters, forms and
lifecycle actions.

## Consequences

- Admin filtering and search are indexed and bounded without changing
  immutable content or serving behavior.
- The projection duplicates some content-derived values. Every insert path
  must use the shared builder; a future authoring path that forgets it will
  fail tests rather than silently producing incomplete rows.
- Existing deployed versions would need a separately reviewed backfill before
  this schema can serve them. The current local assumption is that no live
  question versions exist, so no backfill, migration or deployment is
  included.
- Reports and flags remain deferred to #40 and #41. Contributor filtering uses
  opaque user IDs until #25 supplies an admin account workflow.
- Reference authoring and reference version creation remain outside this
  workspace; the form only selects an existing immutable version.

## Rejected alternatives

- **Client-side filtering:** unbounded table scans, unstable pagination and
  unnecessary data exposure.
- **Read-time derivation without stored fields:** cannot use a Convex index or
  search index.
- **Indexing nested content:** Convex indexes require declared top-level
  fields.
- **Patching existing versions:** violates immutable version history and
  obscures content-hash meaning.
- **Hiding unauthorized actions only in the UI:** backend authorization and
  lifecycle checks remain authoritative.
- **Shipping report and flag filters now:** their data model and workflows do
  not exist and are tracked separately.

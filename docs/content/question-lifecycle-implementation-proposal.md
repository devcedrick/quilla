# Protected implementation proposal for #32: question lifecycle

**Status: approved by the maintainer on 7 November 2026; implementation is local
and not deployed. See [ADR 0020](../ADR/0020-question-lifecycle-and-independent-publication.md).**

This proposal builds on #24 audit logging, #29 taxonomy management and ADR 0017's
independent-review policy. It prepares reusable operations for #95 without
implementing that importer, an admin UI, assessment generation or live writes.

## Storage and identity

Add five indexed tables. Use explicit Convex object/discriminated validators,
never arbitrary JSON blobs for domain content. Snapshot JSON is limited to audit
records under #24's existing rules.

| Table                       | Required fields and access indexes                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions`                 | Stable canonical `questionId`; immutable `contributorId: Id<"users">`; family origin; latest version number; canonical revision; creation time. Indexes `by_questionId`, `by_contributorId`.                                                                                                                              |
| `questionVersions`          | `questionId: Id<"questions">`; positive version number; immutable content and content hash; exact taxonomy-version ID; optional exact reference-version ID; creator ID/time; lifecycle state; workflow revision; optional approval-decision ID. Indexes `by_questionId_and_version`, `by_state`, `by_contentFingerprint`. |
| `questionReviews`           | Exact question-version ID; reviewer ID; decision (`approve`, `needs_revision`, `reject`); expected/resulting workflow revisions; reason; versioned quality assessment; duplicate disposition/evidence; decision time. Indexes `by_questionVersionId`, `by_reviewerId`. No update/delete API.                              |
| `questionReferenceVersions` | Stable `referenceId`; positive version; immutable family/module/language/title, ordered blocks and provenance; creator ID/time; content hash. Index `by_referenceId_and_version`.                                                                                                                                         |
| `questionAssets`            | Stable `assetId`; immutable intended SHA-256, media type, dimensions and provenance; uploader ID/time; upload state (`pending`, `verified`, `failed`); optional protected storage ID; optimistic revision. Indexes `by_assetId`, `by_uploaderId_and_state`. Only verified assets may be referenced.                       |

`questionReviews` uses a discriminated record shape: ordinary review decisions
have the outcomes and quality assessment above; `duplicate_recheck` records have
candidate-set fingerprint, disposition and evidence instead. Both shapes retain
exact version, authenticated reviewer, workflow revisions and decision time.
Neither shape may be updated or deleted.

Canonical ID uniqueness and `(questionId, version)` / `(referenceId, version)`
uniqueness are enforced with indexed reads in the same mutation as insertion.
Never repurpose an existing identity for changed content. Material edits create
a new version; immutable content is never patched. Only lifecycle metadata and
its workflow revision change on an existing question version.

Content preserves the offline contract: family/module, subject/subtopic/concept,
nonempty unique level applicability, language, difficulty, stem, 2–6 distinct
choices with stable choice IDs, one existing correct-choice ID, substantive
explanation and provenance. Resolve taxonomy through #29's trusted validators for
every declared level, and require family/module/language compatibility with an
adopted reference. Normalized equivalent choices are invalid. Keep the existing
shared-core / Professional Numerical eligibility rules; do not invent a fixed
35+5 authoring quota. No client-supplied role, reviewer or publication flag grants
authority.

Use a deterministic canonical serialization with sorted object keys for hashes;
preserve semantically ordered choices and reference blocks. Content hashes cover
the entire immutable payload and exact reference/taxonomy identities. Duplicate
fingerprints separately normalize stem/choice text and resolved reference content
using the existing offline validator's documented rules. Fingerprints identify
review candidates, not final semantic-duplicate decisions.

## Version creation and author boundaries

Public creation/revision operations initially require an active admin. Ordinary
learner submission remains owned by #37; provide trusted internal helpers it can
later reuse after performing its own ownership checks.

`createDraft({ questionId, content, taxonomyVersionId, referenceVersionId? })`
derives the contributor from the caller, creates canonical version 1 and returns
canonical/version IDs and revisions. `createRevision({ questionId,
expectedCanonicalRevision, content, taxonomyVersionId, referenceVersionId? })`
creates the next version and increments the canonical revision atomically. The
canonical contributor never changes; store the new version's creator separately.
A reviewer must differ from both the canonical contributor and the material
version creator, so an admin editor cannot approve their own correction.

Provide unregistered draft-creation helpers for #95 that can preserve an explicit
positive offline version number, including a first imported version greater than

1. They still derive the authenticated acting account and create drafts only.
   An offline author label such as `Quilla` is provenance, not an authenticated user
   identity. A new imported canonical record is attributed to its authenticated
   importing admin; existing contributors cannot be replaced. A future import must
   resolve any genuine preexisting author mapping explicitly, not trust a JSON ID.
   Matching ID/version/hash is an idempotent no-op; changed content with the same
   identity is a conflict. Batch orchestration and manifest acceptance remain #95.

## Lifecycle APIs and conflict handling

All state-changing calls accept `questionVersionId` and
`expectedWorkflowRevision`. All registered functions have argument/return
validators. Admin operations use the existing active-admin guard. Errors return
stable codes, including `STALE_REVISION`, `INVALID_TRANSITION`, `SELF_REVIEW`,
`VALIDATION_FAILED`, `CONTENT_CONFLICT` and `UNVERIFIED_ASSET`.

| API                                               | Behavior                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitForReview`                                 | Draft → pending review. Require the active canonical contributor or version creator; use a separate trusted admin-import submission helper where authorized, never bypass attribution. Revalidate content, taxonomy and references. |
| `reviewVersion({ decision, reason, assessment })` | Pending → approved / needs revision / rejected. Different active admin; one approval per version. Require nonblank reasons for revision/rejection. Store one immutable decision and transition atomically.                          |
| `publishVersion`                                  | Approved → published. Active admin, exact-version approval, complete current validation and passing quality/duplicate gates. Publisher need not be a second reviewer.                                                               |
| `archiveVersion`                                  | Approved or published → archived. Active admin; preserve content, approval and audit history. Other states are not silently coerced.                                                                                                |
| `getAdminVersion`                                 | Active admin only; full payload, exact references, workflow and review evidence.                                                                                                                                                    |
| `listAdminVersions({ state?, paginationOpts })`   | Active admin only; indexed native pagination, integer page sizes 1–100.                                                                                                                                                             |

Additionally, `reviewDuplicateCandidates({ questionVersionId,
expectedWorkflowRevision, candidateSetFingerprint, disposition, evidence })`
requires an approved version and a different active admin under the same
self-review exclusions. Recompute and compare the candidate set server-side;
append an immutable duplicate-recheck record and increment workflow revision
without replacing the original approval. Reject stale sets or unresolved
overflow. This supplies the post-approval duplicate check described below.

The backend reads expected revisions and legal state inside the same transaction
as review insertion, transition and audit. Competing approvals/rejections cannot
both commit; stale requests fail without partial state, review or audit writes.
A revision never inherits approval, and rejected/archived content cannot jump to
publication. Creating a new draft does not silently archive an older published
version. Future selectors choose eligible versions without repeating a canonical
question; historical attempts keep their originally served IDs and choice order.

Do not create an anonymous question endpoint or learner preview API here. Later
assessment code receives trusted content-selection helpers with answer-free
projections; answers/explanations require the owning submitted attempt's separate
authorized review path in #59. Admin reads do not double as learner APIs.

## Approved quality-score rule

The maintainer approved the following rubric to resolve the previously undefined
quality score:
`editorial-quality-v1`: five reviewer-assessed boolean criteria, each with a
nonblank evidence note: (1) correctness and unique answer, (2) clear assumptions
and plausible distractors, (3) sufficient explanation, (4) scope/classification
and reference accessibility, (5) provenance/originality and source support.
The server computes the score as the count of passed criteria (0–5); approval
and publication require 5/5. Missing/unresolved criteria block approval. This is
an editorial gate, not measured learner difficulty or a claim that automated
checks verify truth. Do not accept a client-supplied computed score.

Duplicate disposition is `none_found`, `adjudicated_distinct` or `unresolved`.
Require reviewer notes; `unresolved` blocks approval/publication. Return at most
50 indexed exact-fingerprint candidate IDs and explicitly report overflow; do
not treat a truncated list as a clean scan. Include other canonical questions
across lifecycle states, while excluding versions of the same canonical ID.
New candidates discovered after approval require an immutable independent
duplicate recheck tied to the exact version and candidate-set fingerprint before
publication. That recheck changes no content and supplies no self-approval path.
The supplemental semantic cross-family audit remains separate in #98.

Future rubric changes require an explicit versioned policy decision; do not
invent or waive a numeric threshold in implementation.

## References and protected assets

`createReferenceVersion({ referenceId, expectedLatestVersion, content })` requires
an active admin and creates the next immutable version. A trusted import helper
can preserve the source version under the same conflict rules. References use
the existing text/table/image block contract and exact verified asset IDs. Bound
reference content to 128 KiB serialized UTF-8 and question content to 64 KiB;
reject oversize records, never truncate. A changed adopted reference requires a
new question version and review. References/assets do not add scored questions.

`beginAssetUpload({ assetId, sha256, mediaType, width, height, provenance })`
reserves a pending asset for an active admin. `uploadAsset({ assetId,
expectedRevision, bytes })` is an authenticated admin action accepting at most
1 MiB. It verifies actual PNG/WebP signature, dimensions and SHA-256 before
storing bytes itself; callers cannot nominate an arbitrary existing storage ID.
Only a trusted completion mutation may bind the server-created storage ID and
mark the reservation verified, checking uploader/revision/hash again. Concurrent
or failed uploads cannot replace an already verified asset. Replacing an image
requires a new asset ID and adopted reference version.

Storage and database writes are not one transaction. Compensate failed completion
by deleting only the newly created, uncommitted blob. Process crashes can leave
unreferenced blobs; record that recovery limitation and reconcile pending intents
before retries. Never promise exactly-once physical blob creation across crashes.
No committed asset/reference/question deletion API is added.

No public storage URLs or storage IDs appear in question/reference DTOs. Admin
asset reads must be authenticated and return bounded bytes through a dedicated
admin action. Future learner asset access must authorize a served attempt's exact
asset association; that route belongs with assessment serving, not this admin
primitive. Do not place answer-bearing records or imported graph assets in
`public/`. Byte verification does not substitute visual/editorial inspection.

## Validation, audit and verification

Publish-time checks revalidate the exact taxonomy, question/reference/asset links,
content hashes, active eligible lifecycle state, independent approval and quality
evidence. Archiving a taxonomy prevents new publication/adoption but does not
rewrite old versions or attempt history. Preserve the approval as historical
evidence even when current validation prevents publication.

All admin domain changes and decisions call #24's helper transactionally with
small allowlisted state/identity/hash snapshots; never audit entire 128 KiB
payloads or credentials. Trusted nonadmin submission integration in #37 must
provide its own approved audit attribution path; #24's admin-only helper must not
be weakened just to support ordinary contributors.

Use convex-test synthetic actors, catalog fixtures and image bytes. Test every
endpoint against anonymous/nonadmin/suspended users, self-review by authors and
editors, forged identity/approval, stale or competing revisions and decisions,
invalid transitions and quality evidence, duplicate overflow/conflicts, immutable
edits and idempotent helpers. Cover historical lookup, corrupt/missing/foreign
assets/references, storage compensation, taxonomy retirement, audit rollback,
prepublication key withholding and snapshot invariance. No real attempts need
to be introduced just to test pinned content; assessment implementation remains
in its existing issues.

Implement in schema, question/reference/asset modules and focused shared
validators/tests; add an ADR and update current requirements. Reuse existing
guards and taxonomy/audit helpers. Run lint, typecheck, full units, Knip,
formatting, whitespace and build checks. Report the existing Next.js security
build failure if it persists. Do not hand-edit generated bindings, deploy for
codegen, migrate or publish real content during verification.

## Approved boundary

The maintainer approved these five tables, admin lifecycle/reference/asset APIs,
trusted draft integration helpers, version/conflict rules and the five-criterion
quality rubric. This does not authorize live deployment, catalog installation,
imports, public contributions, admin provisioning, dependency upgrades or
commits/pushes. Preserve the existing audit stash. Continue implementation on the
current consolidated PR branch under that approval.

## Local implementation and verification — 7 November 2026

Implemented five tables; admin question/reference/asset APIs; trusted import draft
helpers; immutable review decisions; exact-version approval and duplicate rechecks;
and an unregistered answer-free published-question projection for later authorized
assessment selectors. The assessment caller still owns session authorization and
blueprint selection. No learner-serving endpoint is registered here.

Review assessments use five positions in the criterion order listed above under
`editorial-quality-v1`; the server computes their score. Admin detail responses
include the exact reference, up to 50 recent reviews and bounded duplicate
candidates with explicit overflow flags. A compound fingerprint/question index
excludes revisions of the same canonical question before applying candidate
bounds. Identical asset reservations do not create duplicate records or audit
events; verified blobs cannot be replaced through the upload path.

All 425 unit tests passed. Focused integration coverage includes authorization on
every public endpoint, stale/concurrent decisions, self-review and editor-review
refusal, immutable corrections, quality and publication gates, candidate changes,
source-version preservation and idempotent imports, reference compatibility,
protected image access, corrupt-byte rejection, storage compensation and atomic
domain/audit rollback. Lint, typecheck, Knip, formatting and whitespace checks
passed. Build completed compilation, TypeScript and page generation, then failed
with the existing Next.js `SecurityFatalError` reporting a vulnerable installed
version. That dependency remediation remains separate; the build is not recorded
as passing. The build also warned about a lockfile outside the repository.

E2E was not run because no browser journey changed and no live backend was
authorized for these primitives. Generated bindings were not edited manually;
normal API generation/live schema validation remains deferred until an authorized
Convex workflow. Nothing was deployed, migrated, imported or published. The
supplemental question-bank audit stash was preserved.

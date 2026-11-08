# ADR 0020: Version Question Content and Gate Publication Independently

- **Status:** Accepted design; local implementation, not deployed
- **Date:** 2026-11-07
- **Decision owner:** Quilla maintainer
- **Related:** #32, #31, #24, #29 and #95

The maintainer approved the [question lifecycle proposal](../content/question-lifecycle-implementation-proposal.md),
including its five-criterion editorial quality rubric. Canonical questions retain
their contributor and family origin. Material changes append immutable versions;
workflow state and optimistic revisions are separate mutable metadata. Attempts
must preserve served versions; no learner attempt system is introduced here.

One different active admin reviews the exact version; both its original
contributor and material version creator are excluded. Rejection and revision
requests require reasons. Version/state checks, immutable review history, state
changes and admin audit events share one transaction. Competing decisions cannot
both succeed. Publication separately rechecks taxonomy eligibility, content
integrity, references/assets, independent approval, five passing criteria and
duplicate adjudication. Candidate-set changes require an independent immutable
duplicate recheck. This is editorial assessment, not empirical calibration.

References are immutable exact versions with bounded text/table/image blocks.
Changing an adopted reference requires another question version. Assets are
reserved for an authenticated admin and verified against declared bytes, hash,
type and dimensions before they may be referenced. Storage and database writes
are not atomic: compensate failed completion by deleting only the newly stored,
uncommitted blob. A process crash can leave orphan blobs and pending intents;
later import recovery must reconcile these. Committed assets have no delete API.

Full content and protected asset bytes are admin-only. No public storage URL,
learner content endpoint or prepublication answer-serving route is introduced.
Trusted admin import helpers preserve explicit source versions and implement
same-ID/version/hash no-ops without granting publication or changing contributor
identity. Ordinary user contributions and their audit attribution remain #37;
do not weaken the admin audit guard to implement that future path.

Authentication/roles are unchanged. No deployment, live import or publication is
part of local verification. Typed in-memory test references avoid manual
generated-binding edits; normal supported API generation and live schema
validation require a later authorized Convex workflow.

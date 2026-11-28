# ADR 0025: Versioned Blueprint Activation and Immutable Attempt Snapshots

- **Status:** Accepted design; local implementation, not deployed
- **Date:** 2026-11-15
- **Decision owner:** Quilla maintainer
- **Related:** #30, #16, #35, #54
- **Amended by:** [ADR 0029](0029-attempt-lifecycle-and-questionnaire-policy.md) requires a required questionnaire mode in the canonical normalized configuration and content hash for new versions.

The maintainer approved the
[concrete blueprint proposal](../content/blueprint-implementation-proposal.md).

Store blueprint versions, a per-level active pointer and immutable attempt
snapshots in three separate indexed tables. A version carries its complete,
self-describing configuration: scored items, scaled duration, passing reference,
difficulty mix, subject/module/difficulty cells, exact language totals and concept
minimums. It also pins one sealed taxonomy version. Display labels are never
identities.

**Amendment (ADR 0029):** The configuration contract above now includes a required
questionnaire mode (`excluded` initially), hashed as part of the new format's
canonical normalized configuration. Format-1 and format-2 normalization and digests
stay frozen. Snapshots record the mode explicitly; existing format-1 and format-2
snapshots keep their stored format and are not rewritten.

Validate configuration identically on save and activation. Require the documented
subject and module totals, the Professional/Clerical and Subprofessional/Analytical
exclusions, positive difficulty cells within rounding of the declared mix, exact
language totals, one minimum for every level-applicable concept, scaled timing and
the 80% passing reference. The sealed taxonomy is the authority for identity,
eligibility and path integrity. Coverage checks remain outside activation.

Use `draft` → `active` → `archived` versions. Only active admins may create, save,
activate or archive; every real mutation records a transactional audit event.
Activation revalidates the stored configuration, verifies its content hash, freezes
the version, supersedes the same level's previous active version and updates the
pointer atomically. Active versions are immutable; replacements are new versions.
Archived versions retain their exact configuration.

Snapshots are insert-only copies of the active version, pinned to the exact
blueprint and taxonomy versions and protected by a canonical content hash. Existing
snapshots are never rewritten when a newer blueprint activates. An active blueprint
remains snapshot-able after its taxonomy is archived because the stored configuration
is self-describing; new drafts and activations require a sealed taxonomy. Expected
revisions and serialized pointer updates make stale or competing writes fail closed.

`cse-professional-2027-v3` (150 items, 45/75/30, 168 minutes, 120 passing) and
`cse-subprofessional-2027-v3` (145 items, 43/73/29, 141 minutes, 116 passing) exist
as an offline fixture only. This decision creates no attempts table, exam generator,
coverage dry run, live activation, deployment or migration. In-memory tests cover
validation, authorization, audit, concurrency, supersession and snapshot
immutability. Generated bindings are not hand-edited; normal API generation and
live schema verification await separately authorized tooling.

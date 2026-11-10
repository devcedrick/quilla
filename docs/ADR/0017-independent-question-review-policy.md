# ADR 0017: Require One Independent Admin Approval per Question Version

- **Status:** Accepted policy; backend implementation pending in #32; seed bootstrap clarified by ADR 0022
- **Date:** 2026-11-06
- **Decision owner:** Quilla maintainer
- **Related:** #31, #32, #95, #96 and ADRs 0016, 0022

## Context and decision

The maintainer selected one independent admin approval while planning #95's
prerequisites and explicitly requested implementation of that policy. This
resolves the reviewer-count decision left open in the product requirements.

Each question version requires exactly one approval from an active admin who is
not its contributor. An admin who contributes a question is still its author and
cannot review it. The exclusion applies to all review outcomes, not just approval.
Retain the canonical contributor identity across revisions and imported origins;
an editor or importer must not replace it to bypass the exclusion.

Clarification following #32 implementation: separately retain the material
version creator/editor as well as the canonical contributor. The independent
reviewer must differ from both identities; the canonical-identity check alone
does not establish independence. These exclusions also apply to duplicate
rechecks and all negative review outcomes.

No initial-maintainer bootstrap self-approval exception is introduced. The
proposal discussed in #83 and the unresolved option recorded in ADR 0016 do not
grant that permission. AI review, seed metadata and offline sign-off are evidence,
not authenticated independent approval. An imported question stays a draft until
the same authorized lifecycle requirements are met.

## Workflow contract

| Action            | Required state        | Actor and result                                                                                                         |
| ----------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Submit            | Draft                 | Active authorized contributor or material version editor submits their version for review; state becomes pending review. |
| Approve           | Pending review        | Different active admin approves the exact version; state becomes approved.                                               |
| Request revision  | Pending review        | Different active admin records a nonblank reason; state becomes needs revision.                                          |
| Reject            | Pending review        | Different active admin records a nonblank reason; state becomes rejected.                                                |
| Revise materially | Existing version      | Authorized author/editor creates a new immutable draft version; previous content and decisions remain historical.        |
| Publish           | Approved              | Active admin passes publication validation; exact approved version becomes published.                                    |
| Archive           | Approved or published | Active admin removes the version from future eligibility without deleting history.                                       |

Submission after a revision uses the new draft version. Rejected or archived
versions do not jump directly to approved/published; corrective content follows a
new draft and review. Publishing does not itself count as review. The publishing
admin need not be a second reviewer; the independent approval must already exist.
Changing a stem, choice, key, explanation, classification or adopted reference
version is material and cannot inherit another version's approval. Existing
published versions are not silently rewritten when a new draft is created.

If the original contributor has left or is suspended, an active authorized admin
editor may create a corrected draft and submit that draft as its recorded version
creator. Preserve the original contributor attribution and record the editor
separately. This uses the same Submit transition, expected revision, validation
and audit checks, not an arbitrary-admin submission override. The suspended
contributor remains unable to submit, and neither that contributor nor the editor
may independently review the corrected version. Ordinary contributor integration
remains subject to its own ownership and active-account checks in #37.

## Concurrency, authorization and evidence

Every public operation derives identity from backend authentication and verifies
the current active profile/role. Clients cannot nominate an author or reviewer as
proof of authority. Review requests carry the expected question-version identity
and workflow revision. The backend compares both and the pending state inside the
same transaction as the decision and audit insert. After one decision commits,
competing requests fail as stale; no approval/rejection race may overwrite it.

Keep reviewer identity, exact version, decision, timestamp and reasons in durable
history. Publication requires its own authorization, current eligible lifecycle
state, version-specific approval and complete quality checks. Historical approval
records do not prove current content validation or grant arbitrary publication.
No question or attempt history is hard-deleted.

## Verification and consequences

Walk through an ordinary contribution, an admin-authored contribution and an
imported seed with a distinct reviewer. Verify self-approval/rejection/revision
requests fail; wrong-role and suspended reviewers fail; blank negative-decision
reasons fail; material corrections need fresh review; stale and competing
decisions cannot both commit. Publication without exact-version approval fails.

This ADR specifies behavior for #32; it does not deploy a schema, publish content,
complete the supplemental audit, or establish empirical item calibration. A
second active admin is operationally necessary when the contributor is an admin.

## Seed bootstrap clarification

[ADR 0022](0022-one-time-seed-bootstrap-publication.md) adds a distinct,
plan-level acceptance for the exact 1,890-question seed corpus, recorded as a
`seed_acceptance` review. It does not relax the self-approval prohibition above:
the seed approver is a second active admin who differs from the importer,
canonical contributor and material version creator. It creates no reusable
exception and does not count as ordinary editorial review. Every later question
version and every material correction still requires the independent version
review described here.

# ADR 0026: Development Seed Target and Sealed Taxonomy Installation

- **Status:** Accepted design; local implementation, not deployed or installed
- **Date:** 2026-11-16
- **Decision owner:** Quilla maintainer
- **Related:** #107, #106, #105, #104, #29; ADRs 0019 and 0022

## Context

The developer bootstrap in ADR 0022 could not begin. `approvedImportTargets` was
empty, and no supported live path could install and seal `cse-taxonomy-2027-v2`.
The catalog existed only as an offline fixture, every existing taxonomy mutation
required an active admin, and initial-admin provisioning was not implemented. A
manual dashboard edit would bypass catalog validation, revision control and audit
attribution.

The development deployment intended for the first bootstrap is
`https://perceptive-dodo-136.ap-southeast-2.convex.cloud`. Its Convex deployment URL
is a public endpoint, not a credential: the same value is already exposed to the
browser as `NEXT_PUBLIC_CONVEX_URL`. Deploy keys, Clerk secrets and import tokens
remain secret and are not recorded here.

## Decision

Register only the reviewed development target in
`lib/question-import-contract.mjs`:

```js
export const approvedImportTargets = Object.freeze({
  "quilla-dev": "https://perceptive-dodo-136.ap-southeast-2.convex.cloud",
});
```

Production remains unregistered. Adding another deployment is a separate reviewed
change, not an operator flag. This supersedes the registry-empty statement in ADRs
0021 and 0022 for the development target only; the rest of those decisions remain.

Add one internal, operator-only mutation, `taxonomyBootstrap.install`. It is not a
public admin API and does not provision an admin. Invoking it already requires
deployment admin credentials or a deploy key; beyond that, its complete
authorization boundary is an exact registry target whose registered URL equals the
backend's system `CONVEX_CLOUD_URL`, `SEED_BOOTSTRAP_ENABLED=true` on that
deployment, and a catalog digest pinned to the reviewed value. The caller supplies
only the target name and digest; no client-supplied user ID or role establishes
authorization.

Pin the real frozen catalog, not the seven-subtopic count in the original issue
text: `cse-taxonomy-2027-v2` contains 2 levels, 3 difficulties, 2 languages, 5
subjects, 9 subtopics and 12 concepts, for 33 entries. Its canonical SHA-256 digest
is `95a53420395e5df7408fbaa159fb441330f9d851daa121d6b4b847be6bcff76f`.
Installation revalidates the catalog, recomputes the counts, and rejects any
mismatch with `TAXONOMY_CATALOG_MISMATCH` before writing.

Install and seal atomically in one bounded transaction: insert the version at
revision 1 with the non-login `system:seed-taxonomy-installer` identity as creator,
insert all 33 entries, record a `seed_install` system audit event, patch the version
to `sealed` at revision 2, and record a `sealed` system audit event. Running the
installer again against the exact sealed catalog returns `created: false` without
new rows, identities or audit events. Any existing draft, archived or
content-mismatched version fails closed with `TAXONOMY_VERSION_CONFLICT`. There is
no partial draft to resume and no hard delete or automatic rollback.

Add `taxonomyBootstrap.verify`, an internal read-only query guarded by the target
registry but not the bootstrap window, so verification remains available after the
window closes. It reports absence, or the installed version's identity, state,
revision, counts, archived-entry count and exact content match against the reviewed
catalog. It performs bounded reads only.

Extend `scripts/bootstrap-question-bank.mjs` with `--install-taxonomy` and
`--verify-taxonomy`. Both require `--target`, reuse the existing deployment
selection, retry and sanitized failure handling, and reject plan, run, checkpoint
and reason flags. The installer passes the pinned digest from the shared contract.

## Rejected alternatives

- **Manual dashboard edit:** bypasses validation, revision control and audit
  attribution.
- **Public admin taxonomy mutations:** require an active admin that does not exist
  before bootstrap, and would widen the public API surface for a one-time operation.
- **Initial-admin provisioning:** a larger authentication and authorization change
  that does not need to block the seed path.
- **A separate bootstrap flag:** reuses the existing ADR 0022 window rather than
  creating a second time-bounded authorization mechanism.
- **A resumable multi-step draft install:** adds partial states without reducing
  transaction size; 33 entries fit comfortably in one transaction.
- **A standalone taxonomy script:** duplicates deployment selection, retries and
  failure sanitization already owned by the bootstrap CLI.

## Consequences and boundaries

- Installing the catalog is not taxonomy content approval, editorial review,
  empirical calibration or pooled exam readiness.
- The installer writes only `taxonomyVersions`, `taxonomyEntries`, `auditEvents`
  and, on first use, the non-login installer user. It never writes questions,
  references, assets, imports or review records.
- System identities remain non-login. `currentAccess`, `ensureCurrentUser` and the
  admin guards reject role `system`; no login session can acquire installer
  authority.
- The deployment URL is public. Its disclosure advertises a reachable development
  endpoint and does not grant deploy, dashboard or internal-function access. The
  residual risks are public-function abuse, quota and cost; `SEED_BOOTSTRAP_ENABLED`
  must stay off outside an approved window.
- No schema change is required. Generated Convex bindings are not hand-edited.
- This decision does not deploy, install, import, migrate data or authorize a live
  run. Each remains a separately approved action on the exact target.
- #106 remains responsible for executing the corpus bootstrap after the taxonomy is
  installed. #98 remains the deferred supplemental audit.

## Follow-up after merge

1. Obtain fresh approval for the exact `quilla-dev` deployment and deploy the merged
   code.
2. Enable `SEED_BOOTSTRAP_ENABLED=true` only for the installation window.
3. Verify absence, install, rerun to prove idempotency, and verify again against the
   version ID, revision, sealed state, counts and digest.
4. Disable the window unless #106 follows immediately; verification remains
   available.
5. For production, repeat with a separate target registry change, fresh approval,
   deployment, installation and bootstrap authorization. Production is never
   inferred from the development target.

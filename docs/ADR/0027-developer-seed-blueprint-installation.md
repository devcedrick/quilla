# ADR 0027: Developer Seed Blueprint Installation

- **Status:** Accepted design; local implementation, not deployed or installed
- **Date:** 2026-11-19
- **Decision owner:** Quilla maintainer
- **Related:** #111, #110, #108, #107, #106, #98; ADRs 0025 and 0026

## Context

The approved v3 blueprints, `cse-professional-2027-v3` and
`cse-subprofessional-2027-v3`, existed only as an offline fixture after the
versioned-blueprint work in ADR 0025. No supported path could install and activate
them before initial-admin provisioning exists. The public admin blueprint APIs
require an active admin, and a manual dashboard edit would bypass configuration
validation, hash integrity, revision control and audit attribution.

The seed path in ADR 0022 and the taxonomy installer in ADR 0026 already establish
the reviewed `quilla-dev` target, the `SEED_BOOTSTRAP_ENABLED` window, sanitized
failure codes and non-login system identities. Blueprint installation needs the
same authorization boundary without widening the public API or creating an admin.

## Decision

Add one internal, operator-only mutation, `blueprintBootstrap.install`. It is not a
public admin API and does not provision an admin. Invoking it already requires
deployment admin credentials or a deploy key; beyond that, its complete
authorization boundary is:

- an exact registry target whose registered URL equals the backend's system
  `CONVEX_CLOUD_URL`;
- `SEED_BOOTSTRAP_ENABLED=true` on that exact backend;
- the pinned fixture digest supplied by the caller and equal to the reviewed
  contract value; and
- the one exact sealed `cse-taxonomy-2027-v2` version, revalidated against the
  frozen catalog.

The caller supplies only the target name and fixture digest. No client-supplied
user ID, role or actor establishes authorization, and the mutation accepts no actor
argument.

Pin the reviewed fixture in `lib/question-import-contract.mjs` as
`seedBlueprintPolicy`: taxonomy ID `cse-taxonomy-2027-v2`, the exact blueprint
identities and levels, and the canonical SHA-256 digest
`c75b6540dd31a929a810078b2cab54b7f5cff327daacc8c31d58a2022eb4ce69`.
The digest covers both fixture identities, levels, taxonomy ID and complete
configurations. Any fixture change requires a separately reviewed pin.

Before any write, the installer asserts the fixture identities, validates both
configurations against the frozen taxonomy with the existing shared validator, and
loads exactly one sealed `cse-taxonomy-2027-v2` version whose stored catalog matches
the frozen catalog. A wrong or missing target, URL mismatch, closed window, digest
mismatch, invalid configuration, missing/draft/archived/mismatched taxonomy or
duplicate taxonomy version fails closed with a stable sanitized code. No installer
identity, blueprint version, pointer or audit event is created by a rejected
request.

Install both levels atomically in one mutation. For each level the installer inserts
a draft pinned to the exact taxonomy version, normalizes and validates the fixture
configuration, stores the configuration and content hash, records a `seed_install`
system audit event, and activates the version through the same shared activation
helper used by the public admin path. Activation archives any prior active version
by changing only its state, revision, update time and archive time; its configuration
and content hash are never mutated. The per-level active pointer moves to the new
version. All `seed_install`, `activate` and `supersede` audit events carry an audit
timestamp and are attributed to the non-login
`system:seed-blueprint-installer` identity; the install event records the
configuration hash, and each activation event records the level, revision and
configuration format. Installing one level without the other cannot commit.

An exact rerun is a no-op: it returns `created: false` without new versions,
pointer changes, users or audit events. The no-op is accepted only when both exact
versions still hash-verify, use the current configuration format, match the
normalized fixture configuration, are active, resolve through a consistent single
pointer, and were created and activated by the installer identity. Partial
presence, duplicate versions, draft or archived exact versions, unattributed active
versions or a non-installer identity fail
`BLUEPRINT_VERSION_CONFLICT`. Pointer anomalies fail
`ACTIVE_BLUEPRINT_INCONSISTENT`. Nothing is hard-deleted or automatically restored.

Add `blueprintBootstrap.verify`, an internal read-only query guarded by the target
registry but not the bootstrap window, so verification remains available after the
window closes. It reports the taxonomy version and match state, the pinned and
resolved fixture digests, and for each level: version IDs, duplicate presence,
state, revision, active and sealed state, configuration format version, content
hash, hash match, configuration match, taxonomy match, actual and expected counts,
pointer state, system attribution and an overall match. The two seed identities
must use the current configuration format to match, while legacy verification
remains available for unrelated blueprints. "Sealed" for a blueprint means active
plus hash-verified; no schema state is added. Malformed stored state is reported as
a mismatch rather than thrown. The query performs no writes.

Extract the configuration preparation and activation logic into shared helpers in
`convex/lib/blueprints.ts`, reused by the public admin path and the installer. This
is behavior-preserving and prevents validation, hashing or archival semantics from
diverging between the two callers.

Extend `scripts/bootstrap-question-bank.mjs` with `--install-blueprints` and
`--verify-blueprints`. Both require `--target quilla-dev` and the same deployment
selection as the bootstrap, reuse existing retries, sanitized failure handling and
JSON output, and reject plan, run, checkpoint and reason flags. The installer passes
the pinned digest from the shared contract. Verification rejects a deployed
fixture-digest skew rather than reporting a false match, and its sanitized JSON
failure report retains both the expected and deployed digests.

## Rejected alternatives

- **Manual dashboard editing or direct database writes:** bypass validation, hash
  integrity, revision control and audit attribution.
- **Public admin blueprint mutations:** require an active admin that does not exist
  before provisioning, and widen the public API for a one-time seed operation.
- **Initial-admin provisioning:** a larger authentication and authorization change
  that the seed path does not need to block on.
- **A second bootstrap flag or window:** reuses the existing ADR 0022 authorization
  mechanism instead of weakening or duplicating it.
- **Installing each level in a separate transaction:** creates recoverable but
  unnecessary partial states; both reviewed blueprints fit in one bounded mutation.
- **A second blueprint validator or hash implementation:** duplicates semantics the
  admin path already owns; shared helpers keep one source of truth.
- **Automatic deletion or configuration rewrite of prior versions:** violates
  historical integrity and the no-hard-delete invariant.

## Consequences and boundaries

- Installing and activating the blueprints is not content approval, question-bank
  publication, coverage validation, exam generation, empirical calibration or
  pooled exam readiness. It does not complete #98.
- The installer writes only `blueprintVersions`, `activeBlueprints`, `auditEvents`
  and, on first use, the non-login installer user. It never writes questions,
  question versions, references, assets, taxonomy entries, imports, reviews or
  attempt snapshots.
- Historical blueprint versions and attempts are preserved. Archiving changes state
  and revision only; stored configuration and hashes remain intact.
- System identities remain non-login. No login session can acquire installer
  authority.
- The taxonomy must be installed and verified first. Installation against a missing,
  draft, archived or mismatched taxonomy fails closed.
- No schema change is required. Generated Convex bindings are not hand-edited.
- This decision does not deploy, install, activate or migrate anything. Each remains
  a separately approved action on the exact target.

## Follow-up after merge

1. Obtain fresh approval for the exact `quilla-dev` deployment and deploy the merged
   code.
2. Enable `SEED_BOOTSTRAP_ENABLED=true` only for the installation window and confirm
   the sealed taxonomy is installed and verified.
3. Verify blueprint absence, install, rerun to prove idempotency, and verify again
   against version IDs, revisions, active/sealed state, per-level hashes and counts.
4. Disable the window unless question-bank bootstrap follows immediately;
   verification remains available.
5. For production, repeat with a separate target registry change, fresh approval,
   deployment, taxonomy installation and blueprint installation authorization.

# Seed bootstrap rehearsal verification

This record accompanies the local #96 implementation. It documents commands run on
the `feat/s19-5-seed-publication-rehearsal` branch and their results. Nothing in
that #96 rehearsal was executed against a Convex deployment, and no live content,
storage or audit write occurred.

## Environment

- Date: 2026-11-12
- Platform: Windows, PowerShell
- Node.js: `22.14.0`
- npm: `11.21.0`
- Base revision: `ec86cbf` (`origin/main` when the branch was created)

## Offline plan evidence

```powershell
node scripts/bootstrap-question-bank.mjs
```

Output:

```text
dry-run: 1890 questions, 265 references, 59 images
Plan checksum: 71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38
No writes performed.
Bootstrap acceptance is not independent editorial review; exam readiness not evaluated.
```

The JSON form (`--json`) additionally reports `seedPolicy` with seven families,
1,890 questions, 265 references, 59 images and `verified: true`. Both commands only
read the local corpus. They make no network requests and write no checkpoint.

The real offline plan is asserted in `scripts/import-question-bank.test.mjs`.
`verifyBootstrapPlan` recomputes seven families at 270 questions each, 1,890 total,
265 references and 59 images, and fails if any count or family drifts. The frozen
plan and inventory checksums are recorded in
[the rehearsal document](development-import-rehearsal.md).

## Automated checks

| Command             | Result                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`      | Passed, no warnings or errors                                                     |
| `npm run typecheck` | Passed, no diagnostics                                                            |
| `npm run test:unit` | Passed: 42 files, 525 tests                                                       |
| `npm run knip`      | Passed, no unused files, exports or dependencies                                  |
| `npm run build`     | Passed; only the pre-existing Turbopack warning about an out-of-repo package-lock |
| `git diff --check`  | Passed, no whitespace errors                                                      |

The build warning is unrelated to this change: Next.js ignores a
`package-lock.json` located in `C:\Users\HP`, outside the repository.

## Targeted coverage

The files most directly affected by this change were run separately:

| File                                       | Tests | Result |
| ------------------------------------------ | ----- | ------ |
| `convex/seedBootstrap.test.ts`             | 14    | Passed |
| `convex/questionImports.test.ts`           | 29    | Passed |
| `convex/questions.test.ts`                 | 15    | Passed |
| `scripts/bootstrap-question-bank.test.mjs` | 26    | Passed |
| `scripts/import-question-bank.test.mjs`    | 13    | Passed |

The bootstrap test uses a mocked two-family, six-record corpus with a sealed test
taxonomy. It covers:

- exact plan, policy, target and bootstrap-window guards before writes;
- idempotent creation of two distinct non-login system actors;
- login denial for system identities and rejection of a non-system importer;
- public admin import calls rejecting a bootstrap run;
- ordered staging, publication as each batch lands, and completion;
- one `bootstrap_acceptance` review per version with run and plan evidence;
- system audit events for submit, accept, publish, resume and complete;
- idempotent completed reruns and resume with a new generation;
- stale-generation and lease rejection;
- deterministic source mismatch before content writes;
- idempotent asset completion without deleting the committed blob;
- refusal to adopt a draft created outside the bootstrap importer;
- archive-only rollback, full-rollback retry and archived-version reactivation;
- preserving an ordinary editorial archive across bootstrap rollback and retry;
- resuming the newest run when older attempts exceed the lookup bound.

`convex/questions.test.ts` covers `bulkSubmitForReview`, `bulkPublishVersions` and
`bulkArchiveVersions`: per-item success and failure results, stale revisions,
missing approval, invalid transitions, unauthorized callers and batch bounds. It
does not add bulk editorial review or approval. `convex/questionImports.test.ts`
retains coverage for the ordinary draft-only importer and the actor-aware asset,
reference and question helpers used by the bootstrap.

`scripts/bootstrap-question-bank.test.mjs` covers plan verification against both
frozen checksums, batching, bounded status reads, deployment selection (including
rejection of the unconfirmed `--deployment prod` alias), offline dry-run behavior,
transient retries, replayed batches, asset upload, preflight conflicts, recovery
metadata, initial-checkpoint failure, pause and rollback. It also asserts that
error reporting emits only allowlisted codes and never echoes a credential-bearing
transport message.

## Checks not run

- **End-to-end tests:** skipped because this change adds no UI or user journey.
  The #33 admin workspace does not exist yet, so the #34 admin UI remains blocked.
- **Live rehearsal:** not attempted. The `quilla-dev` target is now registered
  (#107), but the live rehearsal still requires explicit approval of that exact
  deployment, taxonomy installation and sealing, and the bootstrap window.
- **Production bootstrap:** not attempted. It requires fresh explicit approval of
  the exact production deployment and its confirmation flag.
- **Deployment, migration or production Convex commands:** none. No production
  configuration, secrets or data were touched.

## Boundary

This verification demonstrates local implementation behavior with synthetic
fixtures, mocked policy constants and mocked function transport. It does not
establish editorial correctness, empirical item calibration, CSC alignment or
pooled exam readiness, and it does not replace the deferred supplemental audit in
#98.

## S19.8a taxonomy installer verification (2026-11-16)

Issue #107 adds the reviewed `quilla-dev` target and the internal sealed-taxonomy
installer. These commands were run on the `feat/s19-8a-seed-target-taxonomy`
branch. Regenerating bindings ran `npx convex codegen`, which contacted the
configured development deployment to analyze functions and generate types. The
CLI did not finalize a push: no function was deployed, no schema or database
record changed, and no live taxonomy installation occurred.

- Platform: Windows, PowerShell
- Node.js: `22.14.0`

| Command             | Result                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`      | Passed, no warnings or errors                                                     |
| `npm run typecheck` | Passed, no diagnostics                                                            |
| `npm run test:unit` | Passed: 47 files, 651 tests                                                       |
| `npm run knip`      | Passed, no unused files, exports or dependencies                                  |
| `npm run build`     | Passed; only the pre-existing Turbopack warning about an out-of-repo package-lock |
| `git diff --check`  | Passed, no whitespace errors                                                      |

The files most directly affected by this change were also run separately: six
files and 130 tests passed.

| File                                       | Tests | Result |
| ------------------------------------------ | ----- | ------ |
| `convex/taxonomyBootstrap.test.ts`         | 15    | Passed |
| `convex/seedBootstrap.test.ts`             | 22    | Passed |
| `convex/questionImports.test.ts`           | 29    | Passed |
| `convex/referenceData.test.ts`             | 10    | Passed |
| `scripts/bootstrap-question-bank.test.mjs` | 41    | Passed |
| `scripts/import-question-bank.test.mjs`    | 13    | Passed |

`convex/taxonomyBootstrap.test.ts` proves:

- the frozen catalog digest matches both the backend and Node canonical hashes;
- the exact counts are 2 levels, 3 difficulties, 2 languages, 5 subjects,
  9 subtopics, 12 concepts and 33 entries;
- installation atomically creates a sealed revision-2 version, 33 entries and
  `seed_install` plus `sealed` audit events attributed to the non-login installer;
- an exact rerun returns `created: false` without new rows or audit events;
- unknown targets, URL mismatch, a closed window, a wrong digest, a draft version
  and a mismatched sealed version all fail before writing an installer identity,
  taxonomy entry or audit event;
- the installer takes no actor argument and system identities cannot log in;
- verification is read-only, reports absence, works with the window closed, and
  detects archived or mismatched content;
- question, reference, asset and import tables remain untouched.

The CLI tests cover both new modes, their flag conflicts, production confirmation,
the pinned digest transport and sanitized retries. The importer registry test now
asserts that only `quilla-dev` is registered and production is absent.

### Not run

- **Live installation or deployment:** not attempted. It requires fresh approval
  for the exact `quilla-dev` deployment, deployment of the merged code and an
  approved `SEED_BOOTSTRAP_ENABLED` window.
- **Question-bank bootstrap:** not attempted; #106 remains blocked until the live
  taxonomy is installed and verified.
- **Production registration or installation:** not attempted and not authorized.
- **End-to-end tests:** not applicable; this change adds no UI or user journey.
- **Editorial or content approval:** not established. Installing the frozen catalog
  is not taxonomy content approval or the deferred #98 audit.

## S19.8b blueprint installer verification (2026-11-22)

Issue #111 adds the guarded internal installer for the approved v3 blueprints. These
commands were run on the `feat/s19-8b-blueprint-installation` branch, based on
`origin/main` revision `48c852d`. No deployment, live installation, activation or
database write occurred. Regenerating bindings ran `npx convex codegen`, which
contacted the configured development deployment to analyze functions and generate
types. The Convex CLI documents code generation as read-only and states that it does
not modify the code running on the deployment; no function was deployed, no schema
or database record changed, and no live blueprint or taxonomy installation occurred.

- Platform: Windows, PowerShell
- Node.js: `22.14.0`

| Command             | Result                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`      | Passed, no warnings or errors                                                     |
| `npm run typecheck` | Passed, no diagnostics                                                            |
| `npm run test:unit` | Passed: 48 files, 694 tests                                                       |
| `npm run knip`      | Passed, no unused files, exports or dependencies                                  |
| `npm run build`     | Passed; only the pre-existing Turbopack warning about an out-of-repo package-lock |
| `git diff --check`  | Passed, no whitespace errors                                                      |

The files most directly affected by this change were also run separately: four
files and 108 tests passed.

| File                                       | Tests | Result |
| ------------------------------------------ | ----- | ------ |
| `convex/blueprintBootstrap.test.ts`        | 22    | Passed |
| `convex/blueprints.test.ts`                | 21    | Passed |
| `convex/taxonomyBootstrap.test.ts`         | 15    | Passed |
| `scripts/bootstrap-question-bank.test.mjs` | 50    | Passed |

`convex/blueprintBootstrap.test.ts` proves:

- the pinned fixture digest matches both the backend and Node canonical hashes, and
  the exact identities, levels and per-level counts are pinned;
- both levels install and activate atomically at revision 3, with configuration
  hashes, per-level pointers, `seed_install` and `activate` audit events, and the
  non-login `system:seed-blueprint-installer` identity; activation events record
  the level, revision and configuration format, and every event carries an audit
  timestamp;
- a prior active version is archived with revision 4 and an installer-attributed
  `supersede` event, while its configuration and content hash are unchanged;
- an exact rerun returns `created: false` with no new users, versions, pointers,
  audit events or timestamp changes, and rejects rows stored under a legacy
  configuration format even when their legacy hash recomputes;
- no question, question-version, reference, asset, taxonomy-entry or snapshot rows
  are written;
- wrong target, URL mismatch, closed window, wrong or malformed digest, missing,
  draft, archived, mismatched or duplicate taxonomy all fail before writing;
- partial presence, both-level draft or archived exact versions, both-level
  duplicate versions, unattributed active versions, configuration or hash drift and
  pointer anomalies fail without changing stored state;
- verification is read-only, works with the window closed, reports absence, reports
  both the expected and deployed fixture digests, and reports hashes, counts,
  pointer consistency, system attribution and per-level matches after installation;
- tampered hashes, archived state, legacy-format rows, duplicate versions, missing or
  duplicate pointers, missing pointers for present draft or archived versions and
  foreign active versions report `matchesExpected: false` rather than throwing;
- the installer takes no actor argument and exposes only internal functions.

`convex/blueprints.test.ts` retains the behavior-preserving coverage for the shared
`prepareBlueprintConfiguration` and `activateBlueprintVersion` helpers used by both
the public admin path and the installer. The CLI tests cover both new modes, their
flag conflicts, deployment selection, the pinned digest transport, retry behavior,
sanitized summaries and deployed fixture-digest skew, including retaining both
digests in the JSON failure report. The successful-install summary names the
per-level active pointers. The registry test asserts that only `quilla-dev` is
registered and production is absent.

### Not run

- **Live installation or deployment:** not attempted. It requires fresh approval for
  the exact `quilla-dev` deployment, deployment of the merged code, a verified
  sealed taxonomy and an approved `SEED_BOOTSTRAP_ENABLED` window.
- **Question-bank bootstrap:** not attempted; #106 remains blocked until the live
  taxonomy and blueprints are installed and verified.
- **Production registration or installation:** not attempted and not authorized.
- **End-to-end tests:** not applicable; this change adds no UI or user journey.
- **Editorial or content approval:** not established. Installing and activating
  blueprints is not question-bank publication, exam readiness or the deferred #98
  audit.

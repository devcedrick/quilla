# Seed bootstrap rehearsal verification

This record accompanies the local #96 implementation. It documents commands run on
the `feat/s19-5-seed-publication-rehearsal` branch and their results. Nothing here
was executed against a Convex deployment, and no live content, storage or audit
write occurred.

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
| `npm run test:unit` | Passed: 42 files, 519 tests                                                       |
| `npm run knip`      | Passed, no unused files, exports or dependencies                                  |
| `npm run build`     | Passed; only the pre-existing Turbopack warning about an out-of-repo package-lock |
| `git diff --check`  | Passed, no whitespace errors                                                      |

The build warning is unrelated to this change: Next.js ignores a
`package-lock.json` located in `C:\Users\HP`, outside the repository.

## Targeted coverage

The files most directly affected by this change were run separately:

| File                                       | Tests | Result |
| ------------------------------------------ | ----- | ------ |
| `convex/seedBootstrap.test.ts`             | 10    | Passed |
| `convex/questionImports.test.ts`           | 29    | Passed |
| `convex/questions.test.ts`                 | 15    | Passed |
| `scripts/bootstrap-question-bank.test.mjs` | 24    | Passed |
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
- archive-only rollback, full-rollback retry and archived-version reactivation.

`convex/questions.test.ts` covers `bulkSubmitForReview`, `bulkPublishVersions` and
`bulkArchiveVersions`: per-item success and failure results, stale revisions,
missing approval, invalid transitions, unauthorized callers and batch bounds. It
does not add bulk editorial review or approval. `convex/questionImports.test.ts`
retains coverage for the ordinary draft-only importer and the actor-aware asset,
reference and question helpers used by the bootstrap.

`scripts/bootstrap-question-bank.test.mjs` covers plan verification, batching,
bounded status reads, deployment selection, offline dry-run behavior, transient
retries, replayed batches, asset upload, preflight conflicts, recovery metadata,
pause and rollback. It also asserts that error reporting emits only allowlisted
codes and never echoes a credential-bearing transport message.

## Checks not run

- **End-to-end tests:** skipped because this change adds no UI or user journey.
  The #33 admin workspace does not exist yet, so the #34 admin UI remains blocked.
- **Live rehearsal:** not attempted. It remains blocked pending explicit approval
  of an exact development deployment, target registry registration, taxonomy
  installation and sealing, and the bootstrap window.
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

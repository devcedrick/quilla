# Seed publication rehearsal verification

This record accompanies the local #96 implementation. It documents commands run on
the `feat/s19-5-seed-publication-rehearsal` branch and their results. Nothing here
was executed against a Convex deployment, and no live content, storage or audit
write occurred.

## Environment

- Date: 2026-11-10
- Platform: Windows, PowerShell
- Node.js: `22.14.0`
- npm: `11.21.0`
- Base revision: `ec86cbf` (`origin/main` when the branch was created)

## Offline plan evidence

```powershell
node scripts/publish-seed-question-bank.mjs
```

Output:

```text
dry-run: 1890 questions, 265 references, 59 images
Plan checksum: 71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38
No writes performed.
Editorial review and exam readiness not evaluated.
```

The JSON form (`--json`) additionally reports `seedPolicy` with seven families,
1,890 questions, 265 references, 59 images and `verified: true`. Both commands
only read the local corpus. They make no network requests and write no checkpoint.

The real offline plan is asserted in `scripts/import-question-bank.test.mjs`.
`verifySeedPlan` recomputes seven families at 270 questions each, 1,890 total,
265 references and 59 images, and fails if any count or family drifts. The frozen
plan and inventory checksums are recorded in
[the rehearsal document](development-import-rehearsal.md).

## Automated checks

| Command             | Result                                                                            |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run lint`      | Passed, no warnings or errors                                                     |
| `npm run typecheck` | Passed, no diagnostics                                                            |
| `npm run test:unit` | Passed: 42 files, 506 tests                                                       |
| `npm run knip`      | Passed, no unused files, exports or dependencies                                  |
| `npm run build`     | Passed; only the pre-existing Turbopack warning about an out-of-repo package-lock |
| `git diff --check`  | Passed, no whitespace errors                                                      |

The build warning is unrelated to this change: Next.js ignores a
`package-lock.json` located in `C:\Users\HP`, outside the repository.

## Targeted coverage

The four files most directly affected by this change were run separately:

| File                                          | Tests | Result |
| --------------------------------------------- | ----- | ------ |
| `convex/questionImportRehearsal.test.ts`      | 11    | Passed |
| `convex/questions.test.ts`                    | 15    | Passed |
| `scripts/publish-seed-question-bank.test.mjs` | 10    | Passed |
| `scripts/import-question-bank.test.mjs`       | 13    | Passed |

The rehearsal file uses a mocked two-family, two-question policy and a completed
synthetic import. It covers:

- staging, independent acceptance and publication of the complete batch;
- serving denial before completion and serving after completion;
- the ordinary-lifecycle fence on pinned versions;
- pause, resume and stale-generation rejection;
- distinct active-admin and pinned-approver enforcement;
- unauthenticated, wrong-role, suspended, nonparticipant and expired-lease denial;
- target, environment and plan mismatches before writes;
- ordered staging, duplicate pins, batch bounds and phase ordering;
- archive-only rollback with retained questions and reviews;
- idempotent completed retries and rejection of a second plan.

`convex/questions.test.ts` covers `bulkSubmitForReview`, `bulkPublishVersions` and
`bulkArchiveVersions`: per-item success and failure results, stale revisions,
missing approval, invalid transitions, unauthorized callers and batch bounds.
It does not add bulk editorial review or approval.

`scripts/publish-seed-question-bank.test.mjs` covers plan verification, pin
derivation, batching, bounded status reads, two-client orchestration, idempotency,
recovery metadata, pause/rollback and argument parsing. It also asserts that the
seed error path never echoes a credential-bearing message.

## Checks not run

- **End-to-end tests:** skipped because this change adds no UI or user journey.
  The #33 admin workspace does not exist yet, so the #34 admin UI remains blocked.
- **Live rehearsal:** not attempted. It remains blocked pending explicit approval
  of an exact development deployment, target registry registration, taxonomy
  installation, two active admin accounts, short-lived credentials and a completed
  import run with the pinned plan.
- **Deployment, migration or production Convex commands:** none. No production
  configuration, secrets or data were touched.

## Boundary

This verification demonstrates local implementation behavior with synthetic
fixtures and mocked authorization. It does not establish editorial correctness,
empirical item calibration, CSC alignment or pooled exam readiness, and it does
not replace the deferred supplemental audit in #98.

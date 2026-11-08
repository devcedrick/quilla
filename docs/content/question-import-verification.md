# Issue #95: local implementation verification

Date: 2026-11-08. Branch: `feat/s19-4-guarded-draft-import`, based on merged
`main` commit `576164d`. This is local implementation evidence, not a deployment,
live import, editorial acceptance, publication or empirical calibration report.

## Offline inventory

The importer processed the validated snapshot of all seven current manifests:
**1,890 questions, 265 references and 59 images**, or 2,214 source entries. All 14
text/JSON seed command invocations passed with zero validation errors/warnings.
The simple normalized cross-family fingerprint check returned zero matches; this
does not establish semantic originality or replace #98.

| Family | Manifest revision | Questions | References | Images | Dataset SHA-256                                                    |
| ------ | ----------------- | --------- | ---------- | ------ | ------------------------------------------------------------------ |
| 01     | 5                 | 270       | 33         | 9      | `5719ab3ab51f53ef362dbaf25af624467719df184905388f73eeb295658de7df` |
| 02     | 4                 | 270       | 60         | 10     | `de9d8f96bea926512a1dedb38addf41c18a11e86b673337df04d6c1c398ee728` |
| 03     | 2                 | 270       | 34         | 10     | `b23cf7d1875e3e74e21a030fdab75686fa5b48490872ab7158d017741a144e39` |
| 04     | 2                 | 270       | 32         | 5      | `08b295229d83bb3f807448ada1f31b6e677e8282e36cf1dc3795c5eb339972ff` |
| 05     | 2                 | 270       | 34         | 7      | `fda9e925818518e70800d88eba022056fb15eb8c64010813366f82d832c305af` |
| 06     | 2                 | 270       | 38         | 8      | `766bc083283cb85052c0576fc0bc3629a8047f7f944b2e90ca37e0aa41227c30` |
| 07     | 1                 | 270       | 34         | 10     | `e34caf69c8cc0fab5de2418c1459f6dd49f4ed9c7884273e826401bfb4b1689b` |

Portable plan checksum:
`71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38`.
Ordered inventory checksum:
`c793d1fa22c9db9de587924f8ba55686001a54ade0ebce3ae1386488ea5f11e0`.
These identify the offline snapshot, not deployment-specific database IDs.

## Checks

- `npm run lint`, `npm run typecheck` and `npm run knip`: passed.
- Complete unit suite: **478 tests in 40 files passed**, using
  `npm run test:unit` for the final run.
- `npm run build`: passed on Next.js 16.4.5. The existing warning about an external
  `C:\Users\HP\package-lock.json` remained; that unrelated file was not modified.
- Changed-file formatting and `git diff --check`: passed.
- Earlier heavily parallel verification timed out in the bulk offline-inventory
  test and an existing OpenCode smoke test. The bulk test has an explicit 20-second
  allowance; its assertions remain intact. Isolated complete-suite execution
  passed. An earlier npm invocation ignored the requested worker-limit argument;
  the final direct Vitest invocation applied it without changing test selection.

New tests cover offline zero-network planning, deterministic inventory and image
hashes, safe reporting, explicit intent, disabled targets, every public endpoint's
negative authorization, competing begin requests and target aliases, ownership,
lease fencing/expiry, partial stage/apply recovery, atomic batch/audit rollback,
exact-version conflicts, missing dependencies, forged approval fields, unknown
taxonomy, invalid eligibility, protected uploads, corrupt bytes and compensation,
lost upload responses, preserved contributor/publication state and completed-plan
idempotency. Additional coverage verifies preflight parity for asset/reference
metadata, completed-batch and final-stage replays, staged upload reservations,
shared target fencing and normalized reference blocks. Further coverage verifies
CLI/server checksum parity, truncated-status rejection, distinct cross-question
duplicate counting, a maximum ten-question server batch, real-corpus descriptor and
batch validation, and different-admin begin/resume ownership. CLI tests also verify
bounded four-request read concurrency and bounded status traversal.

## Deferred or unavailable verification

- Browser E2E was not run: no browser route, UI or user journey changed.
- Deployment/schema-push/code-generation verification was not run: no deployment
  or exact live target is authorized. Generated bindings were not hand-edited.
- Live Clerk-token retrieval, token lifetime, network throughput and development
  database/storage recovery remain unmeasured. Synthetic identity and in-memory
  storage tests do not establish those operational results.
- Historical attempt tables are not implemented in the current schema; no live
  attempt-history integration test is possible. The importer introduces no
  attempt/history API and preserves existing question versions.
- No new dependency security audit or external peer review is claimed. No
  dependencies or CI workflows changed. Human PR review and remote CI remain
  pending until the separately authorized delivery and remote checks complete.
- A crash between storing an image blob and binding it may leave a private orphan
  blob; the documented recovery boundary requires separately authorized storage
  reconciliation. This cannot publish or approve content.

The development-target registry remains empty and the import switch was not set.
No credentials, live data, question-bank source edits, deployments, imports or
publication were involved. The maintainer subsequently authorized commits, a push
and a new issue-linked PR. The preexisting audit stash was preserved. See the
[runbook](question-import-runbook.md) for future authorized use.

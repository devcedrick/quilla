# Question-bank draft import: dry run and recovery

Issue #95 implements the importer locally. **No development target is approved or
enabled by this change.** The commands below describe future authorized use;
deployment, catalog installation and actual imports require separate approval.

## Offline inspection — no credentials required

From the repository root with Node 22.14.0:

```powershell
node scripts/import-question-bank.mjs
node scripts/import-question-bank.mjs --json
```

Both commands validate all seven families and retain the same validated records
and image bytes for subsequent processing. They make no network requests and
write no checkpoint. JSON includes every source ID/version/checksum, manifest
identity/revision/checksum, totals, coverage, duplicate candidates and a plan hash.
Question text, answer keys and explanations are excluded from reports. Exact
cross-family ID collisions are errors; normalized content matches are editorial
warnings, not a reason to silently combine questions. Editorial correctness and
pooled exam readiness remain unassessed.

The existing validator remains available in text and JSON seed modes:

```powershell
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed --json
```

Repeat for Families 02–07. Offline success does not prove that the target has a
sealed taxonomy or matching content: target comparison is reported as not checked.

## Prerequisites for a future authorized operation

1. Separately approve and deploy the implementation to an exact development
   deployment. Verify its deployment type through trusted Convex administration;
   a URL or client-supplied `dev` label alone does not prove its type.
2. Review a registry change binding an operator target name to that exact URL in
   `lib/question-import-contract.mjs`. The registry ships empty and no production
   target is registered by default. A production target requires its own reviewed
   registry change and fresh explicit approval under ADR 0022. Separately set
   `QUESTION_BANK_IMPORT_ENABLED=true` only on that development backend. The guard
   compares the registered URL against its system `CONVEX_CLOUD_URL`.
3. Provision an active Quilla admin and install/seal the matching v2 taxonomy
   through authorized operations. The importer never creates unknown taxonomy.
4. Sign in to the matching development Quilla app. Obtain a short-lived token from
   that signed-in Clerk session with `getToken()`, using its configured Convex
   audience (or the `convex` JWT template when that is how the Clerk instance is
   configured). This is a user token, not a Clerk secret key or Convex deploy key.
   The normal browser provider already obtains these tokens for app requests;
   this CLI does not introduce an automatic browser handoff or refresh mechanism.
5. Supply it as `QUESTION_BANK_IMPORT_TOKEN` only in the importing terminal. Do
   not paste a real token into a command committed to source or shared in chat.
   The standalone script deliberately does not load `.env.local`.

For PowerShell 7.1 or later, where `Read-Host` supports `-MaskInput`, a hidden
prompt can avoid entering the token directly in command history. Clear it
afterward:

```powershell
$env:QUESTION_BANK_IMPORT_TOKEN = Read-Host 'Short-lived Clerk token' -MaskInput
# Run separately approved preflight/import commands here.
Remove-Item Env:QUESTION_BANK_IMPORT_TOKEN
```

## Read-only target comparison

Replace `approved-dev` with the separately reviewed target name:

```powershell
node scripts/import-question-bank.mjs --check-target --target approved-dev --json
```

This makes authenticated reads only. Results identify new, identical, conflicting,
invalid or dependency-pending records by ordinal (joined to the reported source
inventory). Dependency-pending means a supplied reference/image has not yet been
created or uploaded; it does not permit substituting another version. Unknown
taxonomy, invalid eligibility and conflicts block application. Duplicate-candidate
counts are bounded at 51 and do not imply an exhaustive editorial review. Offline
duplicate fingerprints normalize reference-block text and case; the stored server
fingerprint hashes reference blocks as authored. Target comparison can therefore
report fewer duplicate candidates than the offline report. Both remain advisory
pending the editorial audit under #98.

Preflight runs at most four read requests concurrently, with at most ten records
and 256 KiB per request. Writes remain sequential. Token lifetime depends on the
Clerk configuration; the CLI does not extend or automatically refresh it. Obtain
a fresh token and resume if it expires during a long import. Status reads at most
100 receipts per request.

## Apply a pinned plan — future approval required

```powershell
node scripts/import-question-bank.mjs --apply --target approved-dev --expect-plan <plan-checksum> --checkpoint <private-checkpoint-path> --json
```

The importer repeats preflight before creating a run. It stages the pinned
inventory, then imports images, references and draft questions. Metadata batches
contain at most ten records and 256 KiB; each image uses the protected 1 MiB path.
The optional checkpoint contains target, run ID and plan checksum only. Treat its
path as operator-owned: the script replaces the specified checkpoint file.

Any failure stops processing. Its sanitized report contains the run ID when one
was created; it never prints raw transport errors, tokens, answers or explanations.
Exit status is nonzero for invalid input, target failure, conflict or interruption.

## Status and recovery

```powershell
node scripts/import-question-bank.mjs --status-run <run-id> --target approved-dev --json
node scripts/import-question-bank.mjs --apply --target approved-dev --expect-plan <same-plan-checksum> --resume-run <run-id> --json
```

Status reads bounded pages without writing or renewing a lease. Use a fresh token
if necessary. Resume preserves the original owner and requires unchanged source
content and the identical plan. A handled failure attempts to release its lease;
a killed process or expired token may require waiting for the five-minute lease
to expire. Do not override a live lease: another worker may still be running.

If `begin` commits but its response is lost, the report and checkpoint may not
contain the run ID. After the five-minute lease expires, the original owner can
retry the identical `--apply` command without `--resume-run`; the server resolves
the same target and plan to the existing run. Do not switch accounts or alter the
plan to work around a lost response.

Recovery is bound to the initiating admin account. If that account is suspended or
removed, another admin cannot resume the run or complete its pending image
reservations. A pending asset reservation is reusable only by its uploader; if the
bytes were never uploaded, it requires a separately authorized reconciliation
operation. No automatic takeover or storage sweep is provided.

Resume reads the server checkpoint rather than trusting local progress. A lost
response after a committed batch or verified upload does not cause duplicate
content. Same-plan completed reruns add no success audit events. Different plans
that reuse content still record their own administrative run/checkpoint events.

An ID/version conflict requires investigation and, for a material content change,
an explicit new immutable version. Never renumber silently, replace a blob, alter
an existing question, impersonate its contributor or reset progress manually.
Completed drafts remain after partial failure. A crash between storing an image
blob and binding it can leave a private orphan blob; inventory such blobs only
through a separately authorized reconciliation operation. No automatic sweep or
hard deletion of question/reference/history records is provided.

## One-time developer bootstrap — separate approval required

Issue #96 adds a developer-only bootstrap for the initial 1,890-question bank.
Import through the ordinary #95 path still creates drafts only; this bootstrap
instead imports, accepts and publishes the exact reviewed corpus through internal
Convex functions and two non-login system identities. It needs no Clerk account,
active admin or human approver. [ADR 0022](../ADR/0022-one-time-seed-bootstrap-publication.md),
policy issue [#104](https://github.com/devcedrick/quilla/issues/104) and
[the development rehearsal](development-import-rehearsal.md) define the exception:
exactly 1,890 questions (seven families at 270), 265 references and 59 images.

Run this against a development target first. A production bootstrap is permitted
only after a separately reviewed target registry change and fresh explicit approval
for that exact production deployment, and must use `--prod --confirm-production`;
`--deployment prod` is rejected so production cannot be selected without that
confirmation. The bootstrap requires the same reviewed target registry as the
importer, plus:

- `SEED_BOOTSTRAP_ENABLED=true` on that exact backend during the bootstrap window;
- a sealed `cse-taxonomy-2027-v2` taxonomy;
- deployment credentials for the Convex CLI `run` command: a Convex CLI login or
  `CONVEX_DEPLOY_KEY`, selected with `--deployment <name>`, `--prod
--confirm-production`, or the environment variable;
- the reviewed plan checksum
  `71636e194e0e88c443478243a8f3a38276a111c0aaec813b08c9447689e29f38`.

```powershell
# Offline plan check; no writes.
node scripts/bootstrap-question-bank.mjs
node scripts/bootstrap-question-bank.mjs --json

# Read-only status.
node scripts/bootstrap-question-bank.mjs --status --target <approved-target> --deployment <development-name> --run <run-id> --json

# Import, accept and publish in restartable batches.
node scripts/bootstrap-question-bank.mjs --apply --target <approved-target> --deployment <development-name> --expect-plan <plan-checksum> --checkpoint <private-checkpoint-path> --json

# Recovery.
node scripts/bootstrap-question-bank.mjs --pause --target <approved-target> --deployment <development-name> --run <run-id>
node scripts/bootstrap-question-bank.mjs --rollback --target <approved-target> --deployment <development-name> --run <run-id> --reason <incident-reference>
```

The CLI reuses the exact offline validated records, uploads the 59 images through the
protected Convex storage path, and retries transient transport or lease failures
against the server checkpoint. A live lease is refused; a paused or expired run
resumes with a new generation. Published versions become servable as their batches
land; there is no global all-or-nothing gate. Pause releases the lease without losing
progress. Rollback archives bootstrap-published versions and always preserves
questions, reviews and history; a partial rollback leaves the run paused and cannot
be resumed. A fully rolled-back run may be retried as a fresh run. Do not renumber,
replace content, bypass the frozen plan or delete records to force completion.

## Acceptance boundary

Successful import means validated source identities were staged as drafts or
matched existing immutable versions. Existing published versions are not
downgraded. Fresh drafts still require independent review and a separate authorized
publication action. The supplemental audit under #98, empirical calibration and
pooled assessment feasibility are separate work.

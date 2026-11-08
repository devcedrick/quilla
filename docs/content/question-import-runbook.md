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
   `lib/question-import-contract.mjs`. Never register production. Separately set
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

For PowerShell 7, a hidden prompt can avoid entering the token directly in command
history. Clear it afterward:

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
counts are bounded at 51 and do not imply an exhaustive editorial review.

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

## Acceptance boundary

Successful import means validated source identities were staged as drafts or
matched existing immutable versions. Existing published versions are not
downgraded. Fresh drafts still require independent review and a separate authorized
publication action. The supplemental audit under #98, empirical calibration and
pooled assessment feasibility are separate work.

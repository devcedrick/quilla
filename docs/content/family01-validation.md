# Family 01 seed validation

## Current revision 5 — editorial quality repair

- Date: 2026-11-01; [manifest](../../content/question-bank/family-01/manifest.json), revision 5.
- Result: **PASS — 270 questions, 33 references, nine assets; zero errors and warnings.**
- Dataset SHA-256: `5719ab3ab51f53ef362dbaf25af624467719df184905388f73eeb295658de7df`.
- Question-record fingerprint: `c210317d778e5a9edd74d1557791ca54a02687f265739ea6af0d13f65c7298e9`.
- [Item-level repair evidence](family01-quality-revision.md): 43 question versions
  changed, including 37 prompt/task repairs and six explanation-only repairs;
  five dedicated reading references changed. The other 227 questions are unchanged.
- All difficulty labels are unchanged. Substantive task changes strengthen the
  intended demand instead of manufacturing the ratio through relabeling.

| Subject             | Items | Easy | Medium | Hard |
| ------------------- | ----: | ---: | -----: | ---: |
| General Information |    40 |   12 |     20 |    8 |
| Verbal Ability      |    50 |   15 |     25 |   10 |
| Numerical Ability   |    60 |   18 |     30 |   12 |
| Analytical Ability  |    80 |   24 |     40 |   16 |
| Clerical Ability    |    40 |   12 |     20 |    8 |
| Total               |   270 |   81 |    135 |   54 |

Every subject meets the 30/50/20 authoring target. Verbal remains 25 English and
25 Filipino. All 24 reading/paragraph references still have one question consumer;
all new reference versions are pinned. No chart image or taxonomy changed.

Lint, typecheck, and Knip pass. A standalone full unit run passed 291 tests across
24 files. The earlier concurrent run hit three existing validator-fixture
five-second timeouts; the standalone rerun used unchanged assertions/timeouts.
The focused editorial/difficulty files contain 18 tests. Final formatting,
checksum validation, and diff checks are rerun after the identity pins.
Build/E2E are inapplicable to offline content/document/test changes. CI/human
review are not claimed. Difficulty remains an editorial cognitive-demand
estimate, not empirical learner calibration or publication permission.

## Historical revision 4 evidence

The report below preserves the previous revision's identities and checks. Where
content or difficulty rationale differs, revision 5 and its item-level report above
are current.

- Run date: 2026-11-01.
- Contract: [ADR 0013](../ADR/0013-seeding-families-and-pooled-exam-selection.md).
- Inventory: [family-01/manifest.json](../../content/question-bank/family-01/manifest.json), revision 4.
- Taxonomy: `cse-taxonomy-2027-v2`; blueprint metadata: Professional/Subprofessional v3.
- Result: **PASS — one complete 270-question seed family; zero errors and zero warnings.**
- Dataset SHA-256: `fca1890a1330accd5768f08a6efe535e864631818cd3c1a66db0e0625ce40700`.

## Reproduce

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed --json
```

The checksum covers the combined inventory and records; changing a record or
inventory invalidates the pinned checksum. This report applies only to that
reviewed dataset, not future edits.

## Inventory and actual difficulty

| Subject             | Required / actual | Easy   | Medium  | Hard   |
| ------------------- | ----------------- | ------ | ------- | ------ |
| General Information | 40 / 40           | 12     | 20      | 8      |
| Verbal Ability      | 50 / 50           | 15     | 25      | 10     |
| Numerical Ability   | 60 / 60           | 18     | 30      | 12     |
| Analytical Ability  | 80 / 80           | 24     | 40      | 16     |
| Clerical Ability    | 40 / 40           | 12     | 20      | 8      |
| **Total**           | **270 / 270**     | **81** | **135** | **54** |

The family inventory declares 17 topic/language/batch question files in
[`family-01/content/`](../../content/question-bank/family-01/content/), six reference-record files containing
33 references, and two asset-metadata files containing nine images. Verbal has
25 English and 25 Filipino items. All other items are English. Each canonical
question is counted once even if it is eligible for both levels. Consolidation
alone did not alter question records. The subsequent
[difficulty revision](family01-difficulty-revision.md) substantively changed 28
questions and eight dedicated reading references, with incremented versions.
The former
v1/v2 directory split and intermediate global question file have been replaced
by the family-owned content/reference layout. Historical tracked files remain
recoverable from Git history; 242 question records remain unchanged.

Structural checks cover record shapes, canonical identities, approved taxonomy
relationships, module/level eligibility, choices and answer-key references,
question/reference version links, image signatures/dimensions/byte hashes,
provenance, normalized exact duplicate candidates, inventory completeness under
declared record directories, and safe source-relative paths. No issue was found
by these checks. Tests also exercise invalid and cross-source cases; the legacy
draft/release contract remains separately testable.

## Findings and boundaries

Revision 3 honestly reported 30/20/0 Verbal and 37/38/5 Analytical rather than
inflating labels. At the maintainer's request, revision 4 rewrites 15 Verbal and
13 Analytical questions to increase their cognitive demand. Every subject now
meets 30/50/20; this is not a label-only correction. Verbal has five authored hard
items in each language. The item-level rationale, answer checks, and version
changes are recorded in the [difficulty revision](family01-difficulty-revision.md).
Difficulty remains an editorial estimate, not an empirically calibrated rate.

Those counts remove the previously observed hard-item shortfalls, but are not a
published-version feasibility dry run. Activation still requires the planned
eight-family corpus, exact pooled selection checks, and all other safeguards.

**Exam readiness is not evaluated by seed mode.** There are no publication-state
fields or live database queries in this offline validation. Success is not proof
of eligible published versions, feasible pooled v3 selections, empirical
difficulty, legal/linguistic accuracy, or absence of semantic near-duplicates.
Existing item-review notes remain truthful; no human review signature is invented.
Independent editorial approval and pooled selection/publication/snapshot tests
remain required before serving. No database, deployment, or runtime behavior changes.

## Consolidation preservation evidence

Before relocation, the two-source revision-1 dataset checksum was
`3d77245415798fe495afec4c04c0b89de4ed67ed7bc215a507a1ee60fb7490de`.
The intermediate global-file revision 2 had checksum
`0683396761e08e6a6206e1365931207f09a0f7eeb455f71a4a1f2320d5241d99`.
The family-owned revision 3 (checksum
`cddf65edb9ab5a1319d1871fafd2403f1d62aa2db2ebfd93fb0de6162cbe0ba9`) differed because inventory identity, revision,
file layout, and relative asset paths changed, not because any question record
changed. Its sorted complete-record fingerprints were:

- Questions: `d1401406f12021d377a63e2011598605022cafca23c002e43fc7860c344066c1`.
- References: `49dff538adeacde6b9aa86da4e7af1acd7b259d16e331164870e3d94d98c64d7`.
- Asset metadata: `352d0abb985578ddb7a4cbf7fb01472fc075aa0f14d278d12a6ef8f62715e38c`.

Those question and reference hashes matched both earlier layouts. Asset metadata formerly
hashed to `f905061f748b25f86e573b58a9c1e49cb58fe6dd4a14af52017ef9e46de76f34`;
its only record change is the relative path from `assets/...` to
`references/assets/...`. All other asset fields and all nine PNG byte hashes
match the original. No question IDs, versions, answers, explanations, provenance,
or reference-version links were rewritten during consolidation. Revision 4
deliberately revises the 28 question and eight reference versions listed above.
Current sorted complete-record fingerprints are:

- Questions: `bf9fb88245299dacfa2d0cc9040270eef811ff5ec40115fef6aa903aa8256ff8`.
- References: `40fdb49431bd21102f9ac58e8e244ab795583a53607c17257796ba5dc1535bee`.
- Asset metadata and image bytes: unchanged from revision 3.

Tests enforce independent family manifests, topic content files, the current
question fingerprint, per-subject 30/50/20, and dedicated passage ownership.
See [ADR 0015](../ADR/0015-per-family-content-and-reference-banks.md), which
supersedes the intermediate single-file decision.

The intermediate global-file run passed 262 tests and 63 local link checks; those
counts are historical, not evidence for the corrected family-owned layout.
Current seed validation passes with zero errors and warnings. The consolidation
preservation checks verified all question/reference fields and all image bytes
before the subsequent substantive revisions. The new undeclared
`content/` regression failed before the inventory scan fix and passes afterward.
The corrected per-family revision-3 layout passed 263 repository unit tests,
lint, typecheck, Knip, formatting, and 83 affected local documentation-link checks.
Revision 4 passes all 271 unit tests across 22 files, lint, typecheck, Knip,
formatting, seed validation, and 70 local content-documentation link checks.
The first full unit run, concurrent with other checks, had one existing CLI-test
timeout (270 passed, one timed out); a complete standalone rerun passed all 271
without changing tests or timeout settings. The focused content/validator run
also passed all 56 tests. Git-history comparison confirms 28 substantively
changed/versioned questions and 242 unchanged records.

Build and E2E are inapplicable to this offline script/content-inventory change;
the validator is not imported by application code. Human review and green CI
remain required before merge. The report is local evidence, not a merged release.

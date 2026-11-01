# CSE seeding families

Agents authoring or reviewing complete Families 02–08 should first read the
[family-generation and quality-review rules](rules.md).

Each seeding family has its own question bank and manifest. Family 01 is in
**[family-01/](family-01/manifest.json)** with 270 questions. Future families use
separate `family-02/`, `family-03/`, and subsequent folders, not one appended
global question file. There are no competing v1/v2 content folders.

The [Family 01 manifest](family-01/manifest.json) is its authoritative format-2
inventory: corpus ID `cse-2027-family01`, taxonomy `cse-taxonomy-2027-v2`, pooled
blueprint metadata Professional/Subprofessional v3, and `seedFamilies: [1]`.
Each later family has its own corpus ID, family number, revision, and checksum.

Family 03 is authored in **[family-03/](family-03/manifest.json)** with 270
questions, its own revision-2 manifest, ten chart images, and the same per-subject
30/50/20 editorial allocation. See its [review index](../../docs/content/family03-review.md)
and [quality repair](../../docs/content/family03-quality-revision.md), which records
64 revised questions and three revised dedicated passages, checks and pending
human review. This is offline authored content, not database publication.

Family 02 is authored in **[family-02/](family-02/manifest.json)** with 270
questions, its own revision-4 manifest, ten linked chart images, and the same per-subject 30/50/20
authoring allocation. See its [review/source record](../../docs/content/family02-review.md)
and [per-item register](../../docs/content/family02-item-register.md).
It is local authored content, not imported or published database content.

## Layout within each family

- `manifest.json`: the independent family inventory and validation metadata.
- `content/`: question arrays in separate topic/language/batch files, such as
  Reading Comprehension, Vocabulary, Graphs, Numerical Reasoning, and Spelling.
- `references/`: shared passages, tables, charts, paragraph parts, and image metadata.
- `references/assets/`: the original graphics and chart images.

Family 01 has 17 content files, 33 supporting reference records, and nine images.
Each reading passage and paragraph-part record belongs to one question only;
storing them in `references/` does not imply reuse. The
[substantive difficulty revision](../../docs/content/family01-difficulty-revision.md)
brings every subject to 30% easy / 50% medium / 20% hard, without changing the
270-question total.
Do not place this answer-bearing data in `public/`, import it
into application/client bundles, or infer database publication from its location.

## Validation

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed --json
```

Run these from the repository root. Each family manifest's single source has an
empty root, with `questionFiles` listing its `content/*.json` files and references
declared relative to that family. Seed validation checks the agreed
270-item subject allocation, identities, taxonomy, eligibility, references, and
images. It does not certify pooled exam readiness or publish anything.

Family 01 is complete for seeding: 40 General Information, 50 Verbal, 60 Numerical,
80 Analytical, and 40 Clerical. Future exams select eligible published versions
across seed families according to the separate exam blueprint, not one fixed family.
See the [seeding policy](../../docs/content/seeding-families.md),
[validation report](../../docs/content/family01-validation.md), and
[per-family storage decision](../../docs/ADR/0015-per-family-content-and-reference-banks.md).

Storage separation does not restrict exam selection to one family: serving will
select eligible published versions across all families under the pooled blueprint.
Historical paths/hashes in item ledgers identify earlier source layouts. Questions
were reorganized, not overwritten with new versions. No global `questions.json`
or root manifest competes with the independent family manifests.

# Family 04 — original CSE practice bank

> Current chart revision: [revision-2 visual practice](../../../docs/content/family04-chart-revision.md) adds versioned chart assets. Earlier table-only inventory statements below describe the original authoring pass.

This independent offline bank contains 270 original practice questions. Quilla is not affiliated with the Philippine Civil Service Commission. No actual or leaked CSC questions are used.

| Subject             | Total | Easy | Medium | Hard |
| ------------------- | ----: | ---: | -----: | ---: |
| General Information |    40 |   12 |     20 |    8 |
| Verbal Ability      |    50 |   15 |     25 |   10 |
| Numerical Ability   |    60 |   18 |     30 |   12 |
| Analytical Ability  |    80 |   24 |     40 |   16 |
| Clerical Ability    |    40 |   12 |     20 |    8 |
| Total               |   270 |   81 |    135 |   54 |

Verbal has 25 English and 25 Filipino questions; all other questions use English. Analytical is Professional only; Clerical is Subprofessional only. All Numerical questions in this family are shared-core, including Data Sufficiency. The family is an authoring batch, not a fixed mock exam or an official CSC allocation.

[manifest.json](manifest.json) declares every question and reference file. There are eight canonical data tables and 24 dedicated Verbal references, with no image assets. Data tables remain complete and independently answerable when linked questions are selected separately. Answer keys remain outside browser assets and application imports.

The [review ledger](../../../docs/content/family04-review.md) records final validation, checksum, originality and review findings. Separate AI author/reviewer passes do not grant human editorial approval or demonstrate measured difficulty. Human bilingual/domain review and empirical calibration remain pending. Nothing in this folder is imported, published or deployed.

From the repository root:

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-04/manifest.json --mode seed
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-04/manifest.json --mode seed --json
npm run test:unit -- scripts/family04-content.test.mjs
```

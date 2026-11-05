# Family 05 — original CSE practice bank

> Current chart revision: [revision-2 visual practice](../../../docs/content/family05-chart-revision.md) adds versioned chart assets. Earlier table-only inventory statements below describe the original authoring pass.

This independent offline authoring family contains270 original questions. Quilla is not affiliated with the Philippine Civil Service Commission. No actual or leaked CSC examination questions are used.

| Subject             | Total | Easy | Medium | Hard |
| ------------------- | ----: | ---: | -----: | ---: |
| General Information |    40 |   12 |     20 |    8 |
| Verbal Ability      |    50 |   15 |     25 |   10 |
| Numerical Ability   |    60 |   18 |     30 |   12 |
| Analytical Ability  |    80 |   24 |     40 |   16 |
| Clerical Ability    |    40 |   12 |     20 |    8 |
| Total               |   270 |   81 |    135 |   54 |

Verbal contains25 English and25 Filipino questions. All other items use English. Numerical is shared-core, Analytical Professional-only and Clerical Subprofessional-only. These are authoring allocations, not official CSC exam weights or a fixed mock exam.

[manifest.json](manifest.json) inventories all content and references. Reading and Paragraph Organisation have24 dedicated independently authored references; Analytical has10 canonical text/table datasets. No image assets are used. Complete references accompany each linked item when selected separately.

The [review ledger](../../../docs/content/family05-review.md) records final validation, reviewed checksum, source evidence, corrections and limitations. Separate AI review is not human bilingual/domain approval or empirical calibration. These remain pending. This bank has not been imported, published or deployed.

From the repository root:

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-05/manifest.json --mode seed
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-05/manifest.json --mode seed --json
npm run test:unit
```

# Graphs, Charts, and Data: batch 1 ledger

Status: draft; maintainer review and sign-off pending. The maintainer supplied five
reference images with ten numbered items and explicitly authorized two distinct
original drafts per reference item for this batch, overriding #90's one-to-one
rule for this batch only. The 20 drafts test the corresponding specific skill; this
does not alter the canonical taxonomy. Family 1 / Analytical is a provisional
assignment subject to future coverage and editorial review. This is not a complete
exam set, approved corpus, or authorization to publish.

| Source image | SHA-256                                                            | Items                      |
| ------------ | ------------------------------------------------------------------ | -------------------------- |
| image-1      | `0b1345b1b96887bb9731f1cf945878dc36dcbaa100fb87b286657f343e90d62f` | 1                          |
| image-2      | `ded3b0defac0ec7de7013227871ddeeb1b7752ab4d9f7ac698bc4612e88484ea` | 2 and shared chart for 3–6 |
| image-3      | `74408be25a2ef5b15b2c79b514a898e794694101b92b5f0e18dcf16a5a125394` | 3–6                        |
| image-4      | `59c41de06a513e297c6fd4f42ac29fe79bdf8511bc614ce240bd669e1c53e1e1` | 7–9                        |
| image-5      | `1d6f9f5c9fbc98180b5720013736cec848c267c7cfb3ae8e1523695c5015b182` | 10                         |

All drafts use canonical concept `graphs_charts_and_data`. IDs below have prefix
`f01-graphs-b01-`. Each source item maps to two distinct drafts. Corpus revision 2
uses the following five reference images; all reference versions are 1.

| Drafts | Reference                                                | Question version |
| ------ | -------------------------------------------------------- | ---------------- |
| 01–02  | `f01-nursery-composition` — bar chart and two pie charts | 2                |
| 03–12  | `f01-seedlings` — monthly distribution bar chart         | 1                |
| 13–18  | `f01-river-patrol` — monthly distance line chart         | 2                |
| 19     | `f01-club-allocations` — missing-value table             | 2                |
| 20     | `f01-nursery-allocations` — missing-value table          | 2                |

Version-2 drafts supersede the initial unreviewed drafts in this working corpus;
no attempt or published record exists. The new line chart uses 24, 32, 48, 40, 56,
and 72 kilometres, and its questions and solutions use those values. Every image
has an explicit accessible textual equivalent, including unknown table cells
without revealing their solutions.

| Source item | Specific tested skill                                                         | Draft IDs |
| ----------- | ----------------------------------------------------------------------------- | --------- |
| 1           | Derive a category count from a whole-group percentage and subtract a subgroup | 01, 02    |
| 2           | Compare chart values using a ratio                                            | 03, 04    |
| 3           | Calculate an absolute difference                                              | 05, 06    |
| 4           | Apply an unchanged subgroup proportion to a new total                         | 07, 08    |
| 5           | Identify the greatest consecutive-period growth                               | 09, 10    |
| 6           | Sum values displayed on a chart                                               | 11, 12    |
| 7           | Calculate an arithmetic mean                                                  | 13, 14    |
| 8           | Identify or measure a decrease relative to an earlier period                  | 15, 16    |
| 9           | Express one value as a percentage of another                                  | 17, 18    |
| 10          | Infer a missing value from an arithmetic mean                                 | 19, 20    |

Reconciliation: 10 distinct source items, 20 original drafts, zero unreadable
items and zero intentionally excluded items. The source images are not included
in the repository. Their status and redistribution rights have not been verified;
the generated chart is a new original asset, not a reproduction. Originality,
mathematical correctness, accessibility, difficulty, and source eligibility still
require maintainer review. Proposed difficulty: 6 easy, 10 medium, 4 hard.
Question counts do not imply empirical difficulty calibration.

The source investment question does not explicitly define whether "growth" is
absolute or percentage; draft 09 asks for absolute change and draft 10 explicitly
asks for percentage change. Source question 1 has unclear scale and chart scope;
drafts 01–02 state their entire population and subgroup relationships explicitly.
The line chart in source image 4 has no decrease; drafts 15–16 use a new dataset
with a decline, testing the same comparison skill.

The original bar chart was generated with the built-in imagegen tool. Prompt: "Create an
original clear bar chart for practice questions, white background, title Community
Seedlings Distributed; categories Jan, Feb, Mar, Apr, May, Jun; y-axis Seedlings
0 to 60 in increments of 10; bar values 20, 30, 40, 35, 50, 60; print each value
above its bar; accurate heights and readable labels." Its image and textual
equivalent must be reviewed together before publication.

Four additional built-in imagegen prompts specified original scientific-educational
visuals on white backgrounds with readable text:

- `assets/nursery-composition.png`: "Seedling Nursery Records"; monthly total
  bars May 50 and June 60, y-axis 0–60; May pie Native trees 60% / Other trees 40%;
  June pie Locally raised 75% / Externally raised 25%; accurate proportions and
  all values explicitly printed.
- `assets/river-patrol.png`: "River Patrol Distance"; Jan–Jun values
  24, 32, 48, 40, 56, 72 kilometres; y-axis 0–80 with ticks every 8; blue straight
  segments and labelled points.
- `assets/club-allocations.png`: "School Club Seedling Allocations"; Club and
  Seedlings columns; Garden Club 12, Science Club 18, Nature Club ?, mean 15;
  preserve the unknown and do not include the answer.
- `assets/nursery-allocations.png`: "Nursery Seedling Allocations"; Nursery and
  Seedlings columns; North 5, East 8, South 12, West ?, mean 10; footer "Total
  seedlings available: 60"; preserve the unknown and do not include the answer.

The generated labels and plotted positions were visually checked against these
data. Maintainer review remains pending. Source-to-output mapping, the 20-item
total, and the 6 easy / 10 medium / 4 hard distribution are unchanged.

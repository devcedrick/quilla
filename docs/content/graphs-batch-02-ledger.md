# Family 01 Graphs — batch 2, items 21–40

> Current policy: [seeding families](seeding-families.md) and ADR 0013 supersede
> this ledger's historical draft/candidate and exam-family completion wording.
> Family 01 is complete as a 270-question seed batch. Publication and pooled exam
> readiness are separate; source notes, hashes, and review evidence below remain historical records.

Created 31 October 2026 at the maintainer's request for another 20 original items
and multiple original visuals. This is an independently authored extension of the
earlier skill categories; no new source-image items were supplied, and no false
one-to-one source mapping is claimed. All drafts require maintainer review and
sign-off. No import, publication, or empirical difficulty calibration has occurred.

Corpus revision 6 includes both Graphs batches and the separately authored
Analogy/Logic pool. Batch 2 has 9 easy, 11 medium, and 0 hard questions. Both Graphs
batches together contain 40 drafts: 21 easy, 17 medium, and 2 hard. Question IDs
have prefix `f01-graphs-b02-`, followed by the numbers below.
Items 23, 25, 27, 30, 34, 35, 39, and 40 are question version 2; all other batch 2
questions remain version 1. All reference versions
remain 1. The canonical concept is
`graphs_charts_and_data`, Professional-only Analytical Ability.

| Items | Reference                | Specific skills                                                                                                      |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 21–25 | `f01-b02-clinic-visits`  | Direct reading; grouped sum; ratio; percentage comparison; reclassification and overall share                        |
| 26–30 | `f01-b02-water-use`      | Absolute difference; arithmetic mean; greatest percentage growth; aggregate fraction; missing value from target mean |
| 31–35 | `f01-b02-project-budget` | Compare sectors; allocation difference; combined allocation; allocation ratio; nested percentage transfer            |
| 36–40 | `f01-b02-relief-packs`   | Missing value from mean; table shortfall; overall completion rate; table ratio; inferred shortfall and surcharge     |

Easy items: 21, 22, 26, 27, 31, 34, 36, 37, 39. All other batch 2 items are medium.
These are proposed editorial difficulties.
All items are independently answerable from their own reference and stem.
Explanations recompute intermediate totals rather than relying on other items.

## Coverage limitation

The maintainer called this the last Graphs batch for Family 01. This completes
the requested 40-item Graphs draft pool, not a valid 40-item Analytical exam
module: ADR 0008 also requires the `word_analogy_and_logic_test` concept in every
Professional family. Final assembly must select fewer Graphs items and include
eligible Word Analogy/Logic items while retaining the 12/20/8 Analytical cells.
Keep these drafts available for editorial selection; do not silently change
taxonomy, family assignments, or the blueprint to mark this module complete.

With the existing 40 Analogy/Logic drafts, the revision 6 Analytical pool contains
80 drafts: 33 easy, 40 medium, and 7 hard. It is at least one hard item short of
the required eight for a 40-item Analytical module; selecting from the pool cannot
fix that shortage. A later substantive revision or separately authorized original
draft is needed, followed by review. This count supersedes earlier pool summaries.

## Visuals and exact prompt specifications

All four visuals were generated using the built-in imagegen tool in
`scientific-educational` mode. Each prompt requested an original white-background
visual with readable labels and no questions or solutions. Assets are stored
under `content/question-bank/cse-2027-v1/assets/`; hashes and actual pixel
dimensions are recorded in `references/f01-graphs-b02-assets.json`.

- `b02-clinic-visits.png`: grouped bar chart titled "Clinic Visits by Session";
  legend Morning blue / Afternoon orange; Mon 40/20, Tue 30/30, Wed 50/30,
  Thu 60/40; Visits axis 0–70 with ticks every 10; values above every bar.
- `b02-water-use.png`: line chart titled "Community Water Use"; Mon 100,
  Tue 120, Wed 90, Thu 150, Fri 140; Cubic metres axis 0–180 with ticks every 30;
  blue straight segments and labelled points.
- `b02-project-budget.png`: pie chart titled "Community Project Budget";
  subtitle "Total: PHP 240,000"; Health 40%, Transport 25%, Education 20%,
  Parks 15%; proportional sectors, distinct colours, explicit percentage labels.
- `b02-relief-packs.png`: table caption "Relief Pack Deliveries"; columns District,
  Planned packs, Delivered packs; A 80/72, B 100/90, C 120/108, D 100/?;
  footer "Mean delivered per district: 90 packs". Keep the unknown unresolved.
  The caption is supplied by the reference record because the generated image
  contains the column labels and footer but omits the requested title.

Generated values, labels, and plot positions were visually checked against these
specifications. Accessible descriptions repeat only supplied information; they
do not disclose the unknown table value. Maintainer review of visual accuracy,
answer keys, originality, and accessibility remains pending.

## Validation

Corpus revision 4 revises item 23 to compare the aggregate morning and afternoon
visits over all four days, rather than repeating item 04's 50:30 simplification.
The answer is 3:2 from 180 morning and 120 afternoon visits. Its distractors cover
the reversed aggregate ratio, the Wednesday-only ratio, and a total that omits
Monday afternoon visits. Item 08 in batch 1 also receives an editorial revision;
see its ledger. Counts and proposed difficulty distributions are unchanged.
Maintainer review of both revised questions remains pending.

## Difficulty corrections — corpus revision 6

| Items      | Change        | Reason                                                               |
| ---------- | ------------- | -------------------------------------------------------------------- |
| 27, 34, 39 | Medium → easy | Routine mean or direct ratio calculation                             |
| 25         | Hard → medium | Aggregate visits, reclassify a known count, and calculate its share  |
| 30         | Hard → medium | Reconstruct a target total from a mean and subtract the known total  |
| 35         | Hard → medium | Calculate a percentage of one allocation and add it to another share |
| 40         | Hard → medium | Infer the shortfall, price it, and apply a stated surcharge          |

The revised labels follow the reasoning-demand rubric in the batch 1 ledger.
All affected questions increment to version 2; their stems, answers, explanations,
and references are unchanged. Hard labels are not retained merely to preserve the
former 12/20/8 Graphs distribution. Estimates still require maintainer review.

Combined revision 6 draft validation: 80 questions, 9 references, 9 assets, zero errors or
duplicate-candidate warnings. All image hashes, dimensions, and links resolve.
Dataset checksum: `37adfb0463582dcf020a10b8c0d27dbfc7e909e97df5339844a47d7884234bb5`.
This diagnostic checksum is not a sign-off or authorization to publish.
Full release validation is not expected to pass for an incomplete corpus.

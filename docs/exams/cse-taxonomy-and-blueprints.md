# Initial CSE Taxonomy and Mock-Exam Blueprints

## Status and authority

This document defines Quilla's initial reference-data contract for Career Service
Examination preparation. It is a product specification, not a claim that the
taxonomy, question corpus, or mock-exam runtime is already implemented.

The current official sources are Civil Service Commission (CSC)
[Examination Announcement No. 06, s. 2026](https://csc.gov.ph/examination-advisories/examination-announcement-no-06-s-2026-career-service-examination-pen-and-paper-test-for-professional-and-sub-professional-levels-14-march-2027),
published 22 October 2026 for the 14 March 2027 CSE-PPT, and
[Examination Advisory No. 02, s. 2026](https://csc.gov.ph/phocadownload/userupload/erpo/advisories/2026/ExamAdvisory_2026_02_School%20Assignment%20Impt%20Reminders%20for%2008%20March%202026%20CSE-PPT%20Sgd.pdf),
signed 18 February 2026 for the 8 March 2026 CSE-PPT. Both were retrieved 30
October 2026. The announcement establishes the current scope, level boundaries,
and 80.00 passing grade. The advisory explicitly records 150/145 test-proper
items, 20 Examinee Descriptive Questionnaire (EDQ) items per level, 170/165
total items, and 190/160-minute limits. It is the latest available official
structural reference, and this policy carries those figures into the 2027
blueprints provisionally. Activation requires confirmation against every
applicable 2027 announcement and advisory; a changed official figure requires a
new corrected blueprint version before use.

The taxonomy grouping, subject allocations, difficulty mix, pooled-bank model,
scaled mock time limits, corpus threshold, and shortage policy below are
Quilla-authored preparation policies. Quilla is not affiliated with or endorsed
by the Philippine Civil Service Commission. Quilla must never reproduce leaked
or actual examination questions.

The original immutable policy identifiers, retained for historical data, are:

- taxonomy: `cse-taxonomy-2027-v1`;
- Professional blueprint: `cse-professional-2027-v1`;
- Subprofessional blueprint: `cse-subprofessional-2027-v1`.

The current approved documentation policy is
[ADR 0013](../ADR/0013-seeding-families-and-pooled-exam-selection.md): seed
families are 270-question authoring batches, not paired exams. Its selection
contract uses `cse-professional-2027-v3` and `cse-subprofessional-2027-v3`, with
`cse-taxonomy-2027-v2`. Implementation and metadata adoption remain pending;
existing manifests and historical attempts are not rewritten by this document.

Display labels may change without becoming identity. Storage and APIs must use
the stable identifiers defined here.

## Stable reference identifiers

### Levels, difficulties, and languages

| Kind       | Stable identifier | Display label   |
| ---------- | ----------------- | --------------- |
| Level      | `professional`    | Professional    |
| Level      | `subprofessional` | Subprofessional |
| Difficulty | `easy`            | Easy            |
| Difficulty | `medium`          | Medium          |
| Difficulty | `hard`            | Hard            |
| Language   | `english`         | English         |
| Language   | `filipino`        | Filipino        |

Difficulty is an editorial classification until performance data supports a
versioned calibration policy.

### Subjects, subtopics, and concepts

The initial canonical concepts follow the content headings in the
maintainer-supplied preparation reference reviewed 30 October 2026. The reference
is an organizational input, not official CSC material or evidence of official
subject weights. Quilla normalizes the headings into stable identities and maps
them to the official subject boundaries.

The reference combines idiomatic expressions, grammar, and spelling in one
heading. Quilla separates `spelling` into Clerical Ability so Professional exams
cannot receive Subprofessional-only Clerical coverage. The EDQ heading is not a
mastery concept because the initial blueprint excludes that unscored
questionnaire.

The table includes the approved v2 Data Sufficiency and Alphabetizing additions,
and groups Spelling under Clerical Operations for v2. Other rows retain their v1
identities. These additions and the Spelling subtopic change are pending v2
implementation; the current v1 validator contract remains unchanged.

| Subject ID            | Applicability        | Subtopic ID                     | Concept ID                                           | Reference-aligned display label                       |
| --------------------- | -------------------- | ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `general_information` | Shared               | `civic_and_general_information` | `philippine_constitution_general_information_events` | Philippine Constitutions, General Information, Events |
| `verbal_ability`      | Shared               | `vocabulary`                    | `vocabulary_questions`                               | Vocabulary Questions                                  |
| `verbal_ability`      | Shared               | `grammar_and_usage`             | `idiomatic_expressions_and_correct_grammar`          | Idiomatic Expressions and Correct Grammar             |
| `verbal_ability`      | Shared               | `reading`                       | `reading_comprehension_test`                         | Reading Comprehension Test                            |
| `verbal_ability`      | Shared               | `discourse`                     | `paragraph_organization_test_questions`              | Paragraph Organization Test Questions Civil Service   |
| `numerical_ability`   | Shared               | `numerical_reasoning`           | `numerical_reasoning`                                | Numerical Reasoning                                   |
| `numerical_ability`   | Shared               | `numerical_reasoning`           | `data_sufficiency`                                   | Data Sufficiency                                      |
| `analytical_ability`  | Professional only    | `data_reasoning`                | `graphs_charts_and_data`                             | Graphs / Charts / Data                                |
| `analytical_ability`  | Professional only    | `logic_and_analogy`             | `word_analogy_and_logic_test`                        | Word Analogy and Logic Test                           |
| `clerical_ability`    | Subprofessional only | `clerical_operations`           | `clerical_operations`                                | Clerical Operations                                   |
| `clerical_ability`    | Subprofessional only | `clerical_operations`           | `alphabetizing`                                      | Alphabetizing                                         |
| `clerical_ability`    | Subprofessional only | `clerical_operations`           | `spelling`                                           | Spelling                                              |

General Information, Numerical Ability, Analytical Ability, and Clerical Ability
items are English in the initial blueprint. Verbal Ability uses both English and
Filipino as specified below.

Professional questions must never use `clerical_ability`. Subprofessional
questions must never use `analytical_ability`. A shared concept retains one
canonical identity across levels; question-level applicability remains an
independent eligibility constraint.

### Approved addition: Numerical Data Sufficiency

The maintainer approved Data Sufficiency on 31 October 2026 as an additional
Numerical Ability concept. It measures whether the available information is
enough to determine an answer, rather than only the ability to calculate it.
This is Quilla-authored preparation coverage, not a claim about an official CSC
subtopic allocation. [ADR 0011](../ADR/0011-numerical-data-sufficiency.md) records
the versioned addition, shown alongside the retained concepts in the main table
above. Existing v1 policy and historical snapshots remain unchanged.

ADR 0011 introduced `cse-taxonomy-2027-v2` and planned v2 blueprints. ADR 0013
retains that taxonomy while superseding the selection policy with v3 blueprints.
The taxonomy retains every v1 concept and adds
`data_sufficiency` as a distinct canonical concept, so mastery evidence is not
silently merged with computation-only `numerical_reasoning` evidence.

Under the pooled policy, each generated exam must include Data Sufficiency in
its 35-item shared Numerical selection, so both levels receive this coverage.
The five-item Professional extension may also contain Data Sufficiency. The exact
split between the two Numerical concepts beyond the existing per-concept minimum
is not yet decided; do not assume a 20/20 split or add extra exam questions.

Numerical totals and difficulty cells remain unchanged: the shared core has
10 easy, 18 medium, and 7 hard items; the Professional extension has 2 easy,
2 medium, and 1 hard item. Thus Numerical Ability remains 35 items for
Subprofessional and 40 for Professional, with 12/20/8 in the Professional total.
Data Sufficiency questions count inside those cells, not on top of them.

Authoring and review requirements:

- Provide a precise question, explicit domain restrictions, and two statements
  whose sufficiency can be assessed separately and together. Sufficiency means
  that all cases allowed by the information give the same answer. For a yes/no
  question, a definite no is just as sufficient as a definite yes.
- Use five semantic outcomes: statement 1 alone only; statement 2 alone only;
  both together but neither alone; either statement alone; or neither alone nor
  both together. Use full choice text and stable choice IDs rather than relying
  on memorised A–E positions, which may change when choices are shuffled.
- The combined statements must be mutually consistent and admit at least one
  possible case. Contradictory premises are defective, not sufficient by default.
  Do not assume unstated positivity, integrality, nonzero values, or diagram scale.
- Explain what each statement establishes, why any insufficient statement allows
  different answers, and what changes when the statements are combined. Use
  counterexamples where helpful; the learner need not compute an exact value when
  uniqueness alone establishes sufficiency.
- Classify difficulty by reasoning demand. The five-choice format does not make
  an item hard: direct uniqueness checks can be easy, linked constraints medium,
  and interacting cases or subtle domain restrictions hard, pending calibration.

This is a documentation-level decision, not implemented v2 support. The current
corpus manifest and offline validator still use v1. Do not relabel existing
Numerical questions or submit `data_sufficiency` records under the v1 manifest.
Before pooled v3 exam activation, synchronize validator/reference policy and tests, adopt
versioned corpus metadata, author and review the required coverage, and rerun
the pooled exam-feasibility dry run. Preserve existing question and attempt versions.

### Approved v2 grouping: Clerical Operations

Clerical Operations includes Alphabetizing (`alphabetizing`) and Spelling
(`spelling`), both under subject `clerical_ability` and subtopic
`clerical_operations`. Both are English and Subprofessional only; neither may
appear in a Professional exam. The existing general `clerical_operations`
concept is retained rather than silently replaced.

Alphabetizing assesses arranging words, names, or records in alphabetical order,
including resolving shared prefixes. Each item must state any convention that
could change the answer, such as surname-first filing or treatment of spaces,
hyphens, and punctuation. Spelling assesses identifying or supplying correctly
spelled words; authoring must avoid alternatives that are both accepted variants
unless the stem explicitly specifies the required convention.

[ADR 0012](../ADR/0012-clerical-alphabetizing-and-spelling.md) records this
refinement of the pending v2 contract. Spelling keeps its canonical concept ID;
v1 questions remain under `language_accuracy` in their historical versions.
Adopting the new parent requires explicit versioned classification, not rewriting
past question or attempt snapshots or discarding existing Spelling evidence.

The existing per-concept minimum applies to all three Clerical concepts in each
generated Subprofessional exam, including Alphabetizing. The Clerical module remains 40 questions:
12 easy, 20 medium, and 8 hard. No split among these concepts beyond the minimum
has been decided, and these topics do not add extra exam slots. This remains
Quilla-authored preparation coverage, not a claim about official CSC weights.
Validator/policy synchronization and reviewed coverage are required before v2
activation; this documentation does not change the v1 corpus or runtime.

## Seeding families and generated exam sets

A seeding family is an authoring batch, not an exam. The initial plan is eight
families of 270 unique questions each: 40 General, 50 Verbal, 60 Numerical,
80 Analytical, and 40 Clerical. Family 01 is complete for seeding by maintainer
confirmation. See the [seeding policy](../content/seeding-families.md) for the
allocation table and the distinction between content completion and exam readiness.

Mock exams randomly select eligible published versions from all seed families
combined, constrained by the exam tables below. They need not be drawn from one
family or draw equal amounts from each family. The 105 shared exam slots and
five Professional Numerical extension slots remain eligibility partitions, not
an identical shared question set between two paired exams.

Each canonical question has one seed-family origin; versions, translations, or
cosmetic rewrites do not add unique corpus coverage. The same eligible canonical
question may recur across separate attempts, but never twice within one attempt.
There is no guaranteed non-overlap across exams or reserved family-to-exam mapping.
Preserve seed provenance and exact served versions in immutable attempt snapshots.
Shared-concept evidence still follows
[ADR 0003](../ADR/0003-exam-level-selection-policy.md).

### Subject and language totals

| Level           | General | Verbal | Numerical | Analytical | Clerical | Scored total |
| --------------- | ------: | -----: | --------: | ---------: | -------: | -----------: |
| Professional    |      20 |     50 |        40 |         40 |        0 |          150 |
| Subprofessional |      20 |     50 |        35 |          0 |       40 |          145 |

Every set contains exactly 25 English and 25 Filipino Verbal items. The remaining
subjects use English in this initial version.

The 20-item Examinee Descriptive Questionnaire (EDQ) is not included. A future
EDQ-enabled configuration requires a new blueprint version and must keep EDQ
responses unscored.

### Difficulty cells

| Subject or module                | Easy | Medium | Hard | Total |
| -------------------------------- | ---: | -----: | ---: | ----: |
| General Information              |    6 |     10 |    4 |    20 |
| Verbal Ability                   |   15 |     25 |   10 |    50 |
| Shared Numerical core            |   10 |     18 |    7 |    35 |
| Professional Numerical extension |    2 |      2 |    1 |     5 |
| Analytical Ability               |   12 |     20 |    8 |    40 |
| Clerical Ability                 |   12 |     20 |    8 |    40 |

The Professional aggregate is 45 easy, 75 medium, and 30 hard items: exactly
30%, 50%, and 20%. The Subprofessional integer aggregate is 43 easy, 73 medium,
and 29 hard items: approximately 29.66%, 50.34%, and 20%.

### Time limit and passing reference

The official full-session limits include the 20-item EDQ. Because Quilla's
initial mock excludes it, the product scales the official limits by the scored
item share and rounds to the nearest whole minute:

| Level           | Calculation             |  Mock limit | Passing reference |
| --------------- | ----------------------- | ----------: | ----------------: |
| Professional    | 190 minutes × 150 / 170 | 168 minutes |        120 of 150 |
| Subprofessional | 160 minutes × 145 / 165 | 141 minutes |        116 of 145 |

The passing reference is 80% of scored mock items. These thresholds support
practice feedback; they are not a guarantee of eligibility and do not claim to
reproduce CSC's rating methodology.

## Coverage and activation

Seed-authoring completion and exam activation are separate. The planned initial
corpus has eight 270-question seeding families, totaling 2,160 unique questions:

| Subject             | Per seed family | Eight-family total |
| ------------------- | --------------: | -----------------: |
| General Information |              40 |                320 |
| Verbal Ability      |              50 |                400 |
| Numerical Ability   |              60 |                480 |
| Analytical Ability  |              80 |                640 |
| Clerical Ability    |              40 |                320 |
| **Total**           |         **270** |          **2,160** |

Family 01's final authored status does not depend on its independently matching
exam difficulty cells. New seeding batches still target honest 30/50/20 difficulty;
do not inflate labels or rewrite completed content merely to meet an exam quota.

Activation requires completion/integration of the planned initial corpus and a
dry run proving that each level's exam can be assembled from the eligible
published combined bank. It no longer requires eight simultaneously disjoint
exam pairs or a complete exam drawn from each seed family. Verify:

- exact per-attempt level, subject, language, and difficulty totals;
- at least one item for every applicable canonical concept in each generated exam;
- the Professional/Clerical and Subprofessional/Analytical exclusions;
- one seed origin per unique canonical question, with no duplicate canonical
  question inside an attempt, without a cross-attempt disjointness requirement; and
- immutable question and blueprint versions plus actionable identifiers for
  every shortage or conflict.

A shared-core question counts once in the authored corpus and once in whichever
attempt serves it. It receives no extra score or blueprint weight because it is
eligible for both levels. Mock results remain level-specific, while submitted
evidence for a genuinely shared canonical concept follows ADR 0003.

### Shortage handling after activation

If archival, exclusion, or another eligibility change creates a difficulty-cell
shortage after activation, generation may substitute only within the same
subject:

1. choose the nearest difficulty on the ordered scale `easy` → `medium` →
   `hard`;
2. when two choices are equally distant, choose the easier difficulty first;
3. preserve per-exam level, subject, language totals, and the one-item-per-concept
   minimum; and
4. block generation if the complete set still cannot be assembled.

For example, a missing hard Numerical item is replaced by medium before easy. A
missing medium item tries easy before hard. No shortage may be hidden by moving a
slot to another subject, using an ineligible level, dropping a required language
count, or omitting a canonical concept. The dry-run and runtime response must
report every relaxed cell and every blocking gap.

## Version and source governance

Before each CSE-PPT exam cycle—and before activating the initial 2027
blueprints—a maintainer must review all applicable official CSC announcements
and advisories and record each source URL, issuance, retrieval date, effective
cycle, reviewer, and outcome.

- If official scope, item totals, timing, or passing references change, create
  new immutable taxonomy or blueprint versions as applicable. Never rewrite an
  active or historical attempt snapshot.
- If the official facts are unchanged, record the completed review without
  manufacturing a new version.
- Changes to Quilla-authored allocations, difficulty cells, coverage gates,
  shortage behavior, or EDQ policy also require a new blueprint version and an
  architecture decision when they materially alter this policy.
- Official facts and Quilla-authored policy fields must remain distinguishable
  in documentation and future storage contracts.

## Downstream contract

This document is the input contract for taxonomy storage, blueprint validation,
question lifecycle, corpus import, coverage dry runs, and immutable attempt
snapshots. It introduces no runtime API or schema by itself. Implementations must
not use display labels as identity, trust client-supplied applicability, or alter
historical versions when this policy is superseded.

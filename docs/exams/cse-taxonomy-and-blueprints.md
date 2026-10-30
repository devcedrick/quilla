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

The taxonomy grouping, subject allocations, difficulty mix, paired-set model,
scaled mock time limits, corpus threshold, and shortage policy below are
Quilla-authored preparation policies. Quilla is not affiliated with or endorsed
by the Philippine Civil Service Commission. Quilla must never reproduce leaked
or actual examination questions.

The initial immutable policy identifiers are:

- taxonomy: `cse-taxonomy-2027-v1`;
- Professional blueprint: `cse-professional-2027-v1`;
- Subprofessional blueprint: `cse-subprofessional-2027-v1`.

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

| Subject ID            | Applicability        | Subtopic ID                     | Concept ID                                           | Reference-aligned display label                       |
| --------------------- | -------------------- | ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `general_information` | Shared               | `civic_and_general_information` | `philippine_constitution_general_information_events` | Philippine Constitutions, General Information, Events |
| `verbal_ability`      | Shared               | `vocabulary`                    | `vocabulary_questions`                               | Vocabulary Questions                                  |
| `verbal_ability`      | Shared               | `grammar_and_usage`             | `idiomatic_expressions_and_correct_grammar`          | Idiomatic Expressions and Correct Grammar             |
| `verbal_ability`      | Shared               | `reading`                       | `reading_comprehension_test`                         | Reading Comprehension Test                            |
| `verbal_ability`      | Shared               | `discourse`                     | `paragraph_organization_test_questions`              | Paragraph Organization Test Questions Civil Service   |
| `numerical_ability`   | Shared               | `numerical_reasoning`           | `numerical_reasoning`                                | Numerical Reasoning                                   |
| `analytical_ability`  | Professional only    | `data_reasoning`                | `graphs_charts_and_data`                             | Graphs / Charts / Data                                |
| `analytical_ability`  | Professional only    | `logic_and_analogy`             | `word_analogy_and_logic_test`                        | Word Analogy and Logic Test                           |
| `clerical_ability`    | Subprofessional only | `clerical_operations`           | `clerical_operations`                                | Clerical Operations                                   |
| `clerical_ability`    | Subprofessional only | `language_accuracy`             | `spelling`                                           | Spelling                                              |

General Information, Numerical Ability, Analytical Ability, and Clerical Ability
items are English in the initial blueprint. Verbal Ability uses both English and
Filipino as specified below.

Professional questions must never use `clerical_ability`. Subprofessional
questions must never use `analytical_ability`. A shared concept retains one
canonical identity across levels; question-level applicability remains an
independent eligibility constraint.

## Paired exam-set families

The initial corpus contains eight numbered paired families. Each family certifies
one complete Professional mock and one complete Subprofessional mock:

| Module                           | Unique items per family | Eligibility                    |
| -------------------------------- | ----------------------: | ------------------------------ |
| Shared core                      |                     105 | Both levels in the same family |
| Professional Numerical extension |                       5 | Professional only              |
| Analytical                       |                      40 | Professional only              |
| Clerical                         |                      40 | Subprofessional only           |

The shared core appears in both level variants of its family. The five-item
Numerical extension uses shared Numerical concepts but contains questions whose
selection eligibility is Professional only. Submitted evidence still follows the
shared-concept policy in [ADR 0003](../ADR/0003-exam-level-selection-policy.md).

No canonical question may appear in two different family numbers. A version,
translation, or cosmetic rewording of the same canonical question does not create
another unique item or another family. Presentation order may be randomized,
but family membership and the immutable question versions served by an attempt
must remain auditable.

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

Neither initial blueprint may be activated until a dry run proves that all eight
paired families can be assembled simultaneously from eligible published question
versions. The dry run must verify:

- exact level, family, subject, language, and difficulty totals;
- at least one item for every applicable canonical concept in every family;
- the Professional/Clerical and Subprofessional/Analytical exclusions;
- no canonical-question reuse between family numbers;
- the permitted shared-core reuse only within the two level variants of one
  family; and
- immutable question and blueprint versions plus actionable identifiers for
  every shortage or conflict.

The minimum initial corpus is therefore 1,520 unique canonical questions:

| Corpus partition                 | Calculation | Minimum unique questions |
| -------------------------------- | ----------- | -----------------------: |
| Shared core                      | 105 × 8     |                      840 |
| Professional Numerical extension | 5 × 8       |                       40 |
| Analytical                       | 40 × 8      |                      320 |
| Clerical                         | 40 × 8      |                      320 |
| **Total**                        |             |                **1,520** |

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
3. preserve level, family, subject, language totals, and the one-item-per-concept
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

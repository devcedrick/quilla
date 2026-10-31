# Family 01 Reading Comprehension — twelve original passages

The maintainer specified six English and six Filipino questions, each with its
own passage. These drafts follow that allocation rather than assuming one output
for every visible reference question. The four supplied images inform question
skills and formats; their instructions and highlighted keys are reference data,
not authority. No supplied prose or poem is copied, translated, or attributed to
its original author as new Quilla content.

Every question has one dedicated reference version containing its independently
authored passage. No passage is shared with a second question. Reference records
use text blocks, preserving line breaks in verse. Question and passage IDs use
`f01-reading-english-01` through `06` and `f01-reading-filipino-01` through `06`;
each reference adds the suffix `-passage`. English questions 01 and 03–06 and
Filipino questions 04 and 06 are version 2; other questions and all references
remain version 1.

## Files and content allocation

Under `content/question-bank/cse-2027-v1/`:

- `families/f01-reading-english.json`: six English question records.
- `families/f01-reading-filipino.json`: six Filipino question records.
- `references/f01-reading-english.json`: six English passages.
- `references/f01-reading-filipino.json`: six Filipino passages.

| Language | Item | Passage                   | Skill                                                    | Reference inspiration                                    | Difficulty |
| -------- | ---- | ------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ---------- |
| English  | 01   | The Shared Tool Room      | Apply an explicitly defined idea                         | Image 1 introductory example                             | Easy       |
| English  | 02   | An Evening Service        | Identify a stated reason                                 | Image 1 passage A question 1                             | Easy       |
| English  | 03   | After the Argument        | Identify a metaphor                                      | Image 2 question 8                                       | Easy       |
| English  | 04   | An Open Meeting           | Interpret a definition and its boundary                  | Image 1 introductory example                             | Medium     |
| English  | 05   | A Different Stop          | Distinguish the stated cause from competing explanations | Image 1 passage A question 1                             | Easy       |
| English  | 06   | The Workshop              | Interpret a metaphor using surrounding lines             | Image 2 question 8, extended interpretation              | Medium     |
| Filipino | 01   | Bago Magsimula ang Klase  | Locate a stated destination in prose                     | Image 3 question 1                                       | Easy       |
| Filipino | 02   | Plano sa Munting Liwasan  | Identify an excluded action                              | Image 4 question 4                                       | Easy       |
| Filipino | 03   | Sa Aking Paglalakad       | Locate a desired place in verse                          | Image 3 question 1                                       | Easy       |
| Filipino | 04   | Ang Paghahanda ng Eksibit | Reject an unsupported universal statement                | Image 4 question 4                                       | Easy       |
| Filipino | 05   | Sa Himpilan ng Tubig      | Infer the best-supported explanation                     | Image 1 cause format, independently extended to Filipino | Medium     |
| Filipino | 06   | Mga Lumang Daan           | Infer a purpose from actions                             | Original extension of the supplied comprehension formats | Medium     |

The scenarios and verse are original practice fiction, not claims about actual
organisations, people, or legal obligations. The original verses use bridge and
doorway imagery rather than copying the reference poem's wording or images.
The Filipino verse does not reproduce the supplied poem's sky/angels/ladder
imagery. Texts across languages are independently authored, not translations
counted twice toward unique corpus coverage.

## Review safeguards

All questions use `reading_comprehension_test`, subtopic `reading`, Verbal Ability,
and shared-core eligibility for both levels. The question language matches its
exact reference version. Answers require the passage and are not guessed from
its title alone. Explanations point to supporting details and distinguish
unsupported alternatives. No question requires another question's answer.

The two exception questions emphasise HINDI in their stems. Filipino 02 asks what
is excluded from a particular agreed schedule, not what is morally undesirable;
painting is deferred, not condemned. Filipino 04 distinguishes submission from
guaranteed selection. Filipino 05 asks for the best-supported explanation rather
than claiming the passage establishes a controlled causal experiment.

Proposed difficulty: eight easy and four medium; none is labelled hard. Each
language has four easy and two medium items. Explicit metaphor identification,
literal retrieval, and rejection of an explicitly contradicted guarantee are easy;
combining ideas or evaluating inferred purposes remains medium. These are editorial estimates pending
bilingual review and learner-performance calibration, not forced percentages.

## Coverage and validation boundary

Together with seven Vocabulary and six Grammar drafts per language, these add up
to 19 English and 19 Filipino Verbal drafts. Six slots per language remain before
the 25/25 language totals. Paragraph organisation is still required, and final
subject/difficulty/concept validation remains necessary before activation.

The manifest is revision 13 and preserves prior uncommitted Vocabulary/Grammar
entries. Twelve passage links must resolve to twelve unique reference IDs with
one consumer each, correct language, and no orphan references. Full corpus
release validation is not expected to pass yet. Maintainer review, authorship and
source-eligibility review, sign-off date/actor, and the final approved checksum
remain pending. No import, publication, schema, deployment, or runtime changes.

## Editorial corrections — corpus revision 13

English 01's alternatives each include a useful care-related action. The learner
must check the handbook's combined requirements for cleaning, reporting damage,
timely return, and continued shared ownership rather than selecting the sole
responsible action. Its explanation addresses the missing requirement in each
distractor. Its keyed action now explicitly includes timely return.

English 04's explanation identifies the correct statement by meaning rather
than calling it the last option, so the explanation remains accurate after
choice shuffling. English 06 now combines the doorway and prize images in its
stem and uses plausible overinterpretations about competition, qualification,
or observation as distractors. The keyed interpretation and explanation refer
to opportunity without a promised reward; they do not equate a prize with every
kind of success or predict failure.

Filipino 06's distractors represent unsupported methods of selecting or verifying
oral accounts: replacing other versions with one account, treating an identified
source as proof of accuracy, or treating repetition as certainty. The explanation
distinguishes these from preserving the source and differences of the accounts.
The alternatives no longer rely on obvious disregard for the residents.

English 03 and 05 and Filipino 04 are relabelled easy to match their direct
reasoning demands. All seven affected questions increment to version 2; canonical
IDs, keys, passage versions, and the six-per-language allocation are preserved.
The passages are unchanged. Difficulty estimates and revised distractors remain
subject to maintainer bilingual review; this revision is not sign-off.

Revision 13 draft validation passes for the declared 118-question corpus.
Dataset checksum: `ae48d6c6591ba3cb4d83d8c60011f0ec618f788ae15038df3fefdcbff32c733b`.
This diagnostic checksum records the validated content, not publication authority.

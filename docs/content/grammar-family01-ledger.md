# Family 01 Grammar and Usage — English and Filipino

The maintainer specified six items per language: three identifying-errors items
and three correct-usage items. These twelve original drafts use the supplied
reference images as skill and format input, not as authoritative instructions or
answer keys. Selected source structures are independently reconstructed in new
contexts; source sentences and images are not copied into the corpus.

English 03 and Filipino 03–04 are version 2; all other items remain version 1.
Files are `families/f01-grammar-english.json` and
`families/f01-grammar-filipino.json` under the corpus root. Each uses family 1,
shared-core applicability to both levels, Verbal Ability, `grammar_and_usage`,
and canonical concept `idiomatic_expressions_and_correct_grammar`.

## Allocation and source-skill mapping

Question ID prefixes are `f01-grammar-english-` and `f01-grammar-filipino-`.

| Language | Item | Task               | Specific skill                                  | Reference                                                      |
| -------- | ---- | ------------------ | ----------------------------------------------- | -------------------------------------------------------------- |
| English  | 01   | Identifying errors | Singular no one and was/were                    | Image 1, item 1                                                |
| English  | 02   | Identifying errors | Both ... and compound-subject agreement         | Image 1, item 4                                                |
| English  | 03   | Identifying errors | Recognise a fully correct sentence              | Image 1, item 6                                                |
| English  | 04   | Correct usage      | Possessive their versus homophones/contractions | Image 2, item 4                                                |
| English  | 05   | Correct usage      | To-infinitive versus too/two                    | Image 2, item 3                                                |
| English  | 06   | Correct usage      | Context-appropriate phrasal verb                | Image 3, items 34–37, with a new put-off example               |
| Filipino | 01   | Pagkilala sa mali  | Ni before a singular personal name              | Image 4, item 1                                                |
| Filipino | 02   | Pagkilala sa mali  | Sina for two named people                       | Image 4, item 2                                                |
| Filipino | 03   | Pagkilala sa mali  | Ng before the object, not nang                  | Image 4, item 3                                                |
| Filipino | 04   | Wastong gamit      | Noun pakiusap versus related verb forms         | Image 6, item 3                                                |
| Filipino | 05   | Wastong gamit      | Kung expressing a condition                     | Image 7, item 16                                               |
| Filipino | 06   | Wastong gamit      | Nang/ng distinction in a manner expression      | Image 7, item 20; changed grammatical role from time to manner |

This is a selected twelve-item allocation, not one output for every image item.
Image 5's additional error-identification items are not needed to fill the three
Filipino slots. Source examples involving disputed phrasing, legal facts, or
collective-noun dialect variation were not adopted.

## Presentation and correctness safeguards

Error-identification stems quote a complete sentence. Each option quotes an
actual contiguous part of it, or says No error / Walang mali. Errors in these
sentences are intentional test material. Explanations identify the rule and give
the corrected sentence. English item 03 intentionally has no error: the five
options retain the source task's possibility of a fully correct sentence.

No stem refers to option letters, underline positions, or "the option above."
Choices may therefore be displayed in a different order without breaking a
reference to A–E. The correct choice is identified by its stable ID, not by a
label embedded in the question. Future runtime shuffling follows ADR 0010.

Completion items specify the intended relationship when another conjunction or
phrasal verb could otherwise produce a different valid meaning. English 06
explicitly asks for postpone; Filipino 05 explicitly asks for a condition.
English 04 distinguishes possession, English 05 tests the infinitive, and English
06 tests a phrasal verb rather than repeating three homophone questions.

Filipino 03 and 06 contrast different roles of ng/nang: object marking versus
the manner of an action. They do not merely repeat one sentence with new nouns.
The source spelling-based completion example containing both Isinulat and Sinulat
was not reused as a supposed universally exclusive contrast.

Proposed editorial difficulty: ten easy and two medium, with no hard items.
English item 06 and Filipino item 04 are medium; all others are
easy. Difficulty is not an empirical calibration or an attempt to force a ratio.
Review must verify that each error item has exactly one erroneous option or a
single correct No error choice, and each completion has one best answer.

## Supporting references

- [University of Utah Writing Center: subject–verb agreement](https://writingcenter.utah.edu/writing-resources/subject-verb.php), for no one and compound subjects joined by and.
- [University of Hawaiʻi Filipino program: sentence expansions](https://www.hawaii.edu/filipino/Grammar_Topics/Grammar_3-1.html), for personal/common and singular/plural markers.
- [University of Hawaiʻi Filipino program: simple sentences](https://www.hawaii.edu/filipino/Grammar_Topics/Grammar_1-1.html), for verbal expressions following the subject marker ang.
- [KWF Balarila ng Wikang Pambansa](https://kwf.gov.ph/wp-content/uploads/Balarila-ng-Wikang-Pambansa-1.pdf), section Ang mga Pantukoy, whose indexed table distinguishes si/sina and ni/ng-related marker classes.
- [KWF Manwal sa Masinop na Pagsulat](https://kwf.gov.ph/wp-content/uploads/MMP_Full.pdf), chapter Kailan Ng at Kailan Nang. The document was found through its indexed contents; full PDF retrieval returned HTTP 403, so it is a review reference rather than a claim of full-text verification in this drafting pass.
- [Cambridge Dictionary: put something off](https://dictionary.cambridge.org/dictionary/english/put-off), for the postponement sense. The examples and explanations in this batch are original, not copied dictionary examples.

## Coverage and review status

These six questions per language join the seven vocabulary questions per
language, giving 13 English and 13 Filipino Verbal drafts. Twelve slots per
language remain before the 25/25 Verbal totals, including reading and paragraph
organisation coverage. Final family assembly still needs all approved subject,
difficulty, language, and concept quotas; adding these drafts does not activate an
exam or resolve the existing Analytical selection-pool shortage.

Bilingual editorial review, source eligibility/originality review, and maintainer
sign-off against the final revision/checksum remain pending. No schema, runtime,
deployment, import, or publication changes occur. Existing vocabulary drafts and
their uncommitted manifest entries are preserved.

## Editorial corrections — corpus revision 11

English 03 is now easy because its correct sentence requires routine agreement
and modifier checks. Filipino 03 is now easy because its object-marking ng/nang
distinction is comparable in demand to the manner distinction in Filipino 06.
Each language now has five easy items and one medium item; estimates remain
subject to maintainer review and learner-performance evidence.

Filipino 04's explanation now justifies pakiusap using the complete construction
and the request being examined by the board. It explicitly acknowledges that
verbal expressions can follow ang, rather than implying a universal noun-only
rule. The stem, options, and answer remain unchanged. All three revised items
increment to version 2, preserving their canonical IDs and source mappings.
The batch still contains six items per language, split into three error items
and three usage items. Maintainer sign-off remains pending.

Revision 11 draft validation passes for the declared 106-question corpus.
Dataset checksum: `0d8f992490d1a1181beddd39feedd06a7c678610c38db317fdcd5dcebb74c325`.
This diagnostic checksum records the validated content, not publication authority.

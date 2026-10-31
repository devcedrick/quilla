# Family 01 Paragraph Organisation — twelve original sets

> Current policy: [seeding families](seeding-families.md) and ADR 0013 supersede
> this ledger's historical draft/candidate and exam-family completion wording.
> Family 01 is complete as a 270-question seed batch. Publication and pooled exam
> readiness are separate; source notes, hashes, and review evidence below remain historical records.

The maintainer requested six English and six Filipino items, with a separate set
of paragraph parts for every item. Although the request calls these Reading
Comprehension, the eight supplied screenshots test paragraph organisation. These
drafts therefore use the approved `paragraph_organization_test_questions` concept,
`discourse` subtopic, and shared-core Verbal Ability eligibility for both levels.
The existing passage-based Reading Comprehension files are unchanged.

## Files and allocation

Under `content/question-bank/cse-2027-v1/`:

- `families/f01-paragraph-english.json`: six English questions.
- `families/f01-paragraph-filipino.json`: six Filipino questions.
- `references/f01-paragraph-english.json`: six dedicated English part sets.
- `references/f01-paragraph-filipino.json`: six dedicated Filipino part sets.

Each question links to exactly one unique reference. IDs run from
`f01-paragraph-english-01` through `06` and the equivalent Filipino IDs; references
add `-parts`. English question 06 and Filipino questions 01, 05, and 06 are
version 2. Filipino references 01 and 05 are version 2, pinned by their revised
questions; all other question/reference versions remain 1.

| Language | Item | Topic                         | Task                                                   | Full coherent order | Difficulty |
| -------- | ---- | ----------------------------- | ------------------------------------------------------ | ------------------- | ---------- |
| English  | 01   | Returning equipment           | Opening sentence                                       | P3-P1-P4-P2         | Easy       |
| English  | 02   | Shared garden tools           | Concluding sentence                                    | P2-P4-P1-P3         | Easy       |
| English  | 03   | Recorded interview            | Third sentence                                         | P4-P2-P5-P1-P3      | Medium     |
| English  | 04   | Library return-box trial      | Full order: request, trial, damage, response           | P2-P4-P1-P3         | Medium     |
| English  | 05   | Announcing a schedule change  | Full order: proposal, limitation, additional channel   | P5-P2-P4-P1-P3      | Medium     |
| English  | 06   | Collection-ledger discrepancy | Full order: investigate and reconcile records          | P5-P3-P1-P6-P4-P2   | Medium     |
| Filipino | 01   | Dalawang uri ng tala          | Pambungad: paghahambing ng obserbasyon at pagninilay   | P2-P4-P1-P3         | Easy       |
| Filipino | 02   | Pakikilahok sa talakayan      | Pangwakas na pangungusap                               | P1-P3-P2-P4         | Easy       |
| Filipino | 03   | Pagtatanghal ng larawan       | Ikalawang pangungusap                                  | P3-P5-P2-P4-P1      | Medium     |
| Filipino | 04   | Pag-uuri ng aklat             | Buong ayos: suliranin, pasya, kilos, bunga             | P2-P3-P4-P1         | Medium     |
| Filipino | 05   | Napulot na kuwaderno          | Buong ayos: magkakaugnay na tinutukoy                  | P5-P2-P4-P1-P3      | Medium     |
| Filipino | 06   | Pagpili ng lalagyan           | Buong ayos: sukat, limitasyon, modelo, pagsubok, pasya | P4-P1-P6-P2-P5-P3   | Medium     |

## Difficulty and editorial safeguards

Each language has two easy and four medium items: four easy, eight medium,
and no hard items overall. The original two hard labels were lowered after
editorial review; labels are not forced to match the requested 30%/50%/20% mix.
Easy items identify an explicit introduction or summary. Medium items reconstruct
chronology, cause and effect, comparisons, or arguments using antecedents and
logical dependencies. The six-part items retain clear links, so their length
alone does not justify hard difficulty. These are editorial estimates pending
bilingual maintainer review and learner-performance calibration. Any downstream
difficulty shortage must be reported instead of hidden by inflated labels.

P1, P2, and similar labels name fixed paragraph parts, not displayed answer-option
letters. Choice IDs remain stable when an interface shuffles choices. Explanations
identify parts and their logical links, never the displayed position of an answer.
Every full-order choice includes each part exactly once. Position questions use
all available parts as alternatives. Learner explanations provide the full order
and explain the relevant transitions or antecedents.

The supplied screenshots inform opening, position, conclusion, and full-order
formats. Images 2 and 3 repeat the same source paragraph; they are not counted as
two original sources. Screenshot instructions and highlighted keys are reference
data, not authority. No reference paragraph is copied or translated. In particular,
these original practice scenarios make no constitutional, tax-law, or historical
migration claims drawn from the screenshots. Topics and paragraph sets are distinct;
the languages are not translations counted twice. Repeated task formats assess the
same skill, but are not number/name substitutions of one shared paragraph.

## Coverage boundary

Manifest revision 15 includes these files while preserving prior uncommitted
Vocabulary, Grammar, and Reading work. The Verbal draft inventory now has 25
English and 25 Filipino questions: seven Vocabulary, six Grammar, six Reading,
and six Paragraph Organisation per language. This completes the language/count
allocation, not release approval or subject-level difficulty validation.

The Analytical inventory remains an 80-question draft pool, not a validated
40-question exam selection. Other subjects and release conditions remain outside
this addition. Draft corpus validation, unique-reference checks, and structural
choice checks do not replace editorial review. No database import, publication,
schema, deployment, or runtime changes are included. Authorship/source eligibility,
bilingual sign-off, and learner-performance calibration remain pending.

## Editorial corrections — corpus revision 15

Filipino 01 replaces the inspect–label–store process, which mirrored English 01,
with a comparison of observation notes and reflective notes in a class field trip.
It still tests identification of an opening sentence. The introduction names the
two note types, the examples refer to the first and second types, and the closing
sentence summarises their difference. The full order and keyed opening remain
P2–P4–P1–P3 and P2; the reference and adopting question both increment to version 2.

English 06 and Filipino 06 now use neutral ordering questions, without naming the
antecedents to track or supplying the intended sequence of rhetorical stages.
Both are classified medium: learners still reconstruct the dependencies, but the
explicit links do not establish hard difficulty. Their keys, part sets, and
explanations are preserved; question versions increment to 2.

Filipino 05's inscription now explicitly identifies the named colleague as the
owner of the notebook. Its explanation uses that ownership statement, rather
than assuming that any name on a photograph identifies the notebook's owner.
The revised question pins reference version 2. Its full order and key are
unchanged. The allocation remains six questions and six dedicated references per
language. Maintainer bilingual review and sign-off remain pending.

Revision 15 draft validation passes for 130 declared questions.
Dataset checksum: `ad1c99032fc78dc45620f2eb075c5f3d78ed2f67256f9cbf93a8a3f7a61ff31a`.
This diagnostic checksum is not publication sign-off.

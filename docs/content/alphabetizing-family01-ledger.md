# Family 01 Alphabetizing — ten original draft lists

The maintainer requested ten Family 01 items, each with its own records to sort,
using the 30% easy / 50% medium / 20% hard proportions. This batch has three
easy, five medium, and two hard items. Every item embeds its complete record
list, filing rules, four distinct sequence choices, and worked explanation.
No image, shared record list, or separate batch-wide directions are needed.

## File and taxonomy

The records are in
`content/question-bank/cse-2027-v2/families/f01-alphabetizing.json`.
IDs run from `f01-alphabetizing-01` through `10`, all family 1,
module `clerical`, subject `clerical_ability`, subtopic `clerical_operations`,
concept `alphabetizing`, language `english`, and applicability
`["subprofessional"]`. These questions must never be served to Professional
learners.

Items 03, 09, and 10 are version 2 following quality review. The other seven
records remain version 1. Question IDs and choice IDs remain stable; revised
choice text and order apply only to the new question versions.

These are staged v2 candidates under
[ADR 0012](../ADR/0012-clerical-alphabetizing-and-spelling.md), not additions to
the current v1 manifest. The v1 validator does not accept this concept. Final
selection must preserve the 40-item Clerical total, its 12/20/8 difficulty cells,
and coverage of all required concepts. Ten candidate Alphabetizing questions do
not establish a permanent concept quota or add exam slots.

## Item ledger

| Item | Records | Skill                                                                      | Difficulty | Correct record order |
| ---- | ------: | -------------------------------------------------------------------------- | ---------- | -------------------- |
| 01   |       4 | Distinct supply labels, first-letter comparison                            | Easy       | R2-R4-R1-R3          |
| 02   |       4 | Shared first word, distinct second-word initials                           | Easy       | R3-R1-R4-R2          |
| 03   |       4 | Surname-first filing with distinct surnames                                | Easy       | R4-R2-R1-R3          |
| 04   |       5 | Given-name prefixes and later-letter comparisons                           | Medium     | R2-R5-R1-R4-R3       |
| 05   |       5 | Shared organisation prefix and deep word comparisons                       | Medium     | R2-R1-R4-R3-R5       |
| 06   |       5 | Similar surname branches with given-name tie-breaks                        | Medium     | R4-R2-R5-R3-R1       |
| 07   |       5 | Word boundaries, joined words, and shorter-prefix priority                 | Medium     | R2-R5-R3-R4-R1       |
| 08   |       5 | Literal abbreviations, ignored periods, and multi-word ties                | Medium     | R4-R1-R3-R2-R5       |
| 09   |       6 | Article/punctuation normalization, complete-name prefixes and deeper words | Hard       | R5-R1-R4-R6-R3-R2    |
| 10   |       6 | Title removal, surname normalization and nested given-name prefixes        | Hard       | R4-R6-R2-R1-R3-R5    |

## Filing rules and difficulty

Rules are item-specific exercise conventions, not a claim that every real filing
system uses the same policy. Comparisons ignore case. Word-by-word items compare
letters within each word, then later words; a shorter exact word/name prefix
comes first. Personal-name items explicitly use Surname, Given name. Item 06
forbids interpreting a written surname as separate name components.

Item 07 intentionally distinguishes Green from Greene and Greenfield rather
than silently using a letter-by-letter, spaces-ignored rule. Item 08 ignores
periods but explicitly does not expand St. to Saint. Item 09 omits leading
articles, joins apostrophe/hyphen fragments, and compares complete-name prefixes
and later words without numeric tie-breaks. Item 10 removes only the specified
titles, joins surname spaces and hyphens, and compares distinct multi-part given
names while retaining their word boundaries. All six normalized full names in
each hard item are distinct. No item requires guessing how particles,
abbreviations, or punctuation are treated.

The easy items require direct first-differing-letter or surname comparison.
Medium items require resolving common prefixes, multiple name branches, or
word boundaries. The hard items combine transformations, primary and secondary
alphabetical keys, and nested word/complete-name prefixes whose precedence matters. More records
alone are not the basis for a hard label. These classifications remain editorial
estimates pending human review and learner-performance calibration; labels must
change if evidence contradicts them.

Each distractor is a complete permutation of the same records, with no omission
or repetition. Alternatives model mistakes such as reversing a local prefix
comparison, expanding abbreviations, sorting by given names before surnames, or
misplacing a complete-name extension. Fixed R-labels identify source records rather than
displayed answer positions. Stable choice IDs and explanations remain accurate
after answer-choice shuffling; no explanation points to a visible answer letter.

## Sources and originality boundary

The seven supplied images inform organisation-name filing, shared prefixes,
personal surnames/given names, and sequence-answer presentation. Their highlighted
keys and directions are reference data, not authoritative answers for these
items. No supplied record list is copied or renamed one entry at a time. The
new exercise names are fictional, not claims about actual
organisations or real people. The added normalization/tie-break exercises extend
the format rather than reusing the reference keys. Human source-eligibility and
editorial sign-off remain pending.

## Verification and release boundary

Rule-based sorting independently recomputed all ten authored orders before JSON
serialization. Every item has four distinct options, and each option contains
every record label exactly once. The declared 3/5/2 counts and Subprofessional-only
eligibility are checked separately on the saved file. Explanations identify the
decisive comparisons and give the full keyed order.

These checks are not v2 release validation or publication approval. Adopting the
v2 policy requires synchronized validator/tests, versioned manifest/blueprints,
complete-family selection and review. This batch does not change the existing
Data Sufficiency or Spelling records, any v1 manifest, runtime, schema, deployment,
or published data. Build and browser tests are not required for this offline
content-and-documentation addition. No commit or push is implied.

The initial saved-file audit confirmed 49 distinct source entries across the ten lists,
40 valid complete-permutation choices, correct keys and explanation orders, and
the exact 3/5/2 allocation. All 237 repository unit tests pass. The formatted
superseded version-1-only JSON had SHA-256
`1d40672582409bf4194d669c1bbf3c5b07a51e03dff6931fa0b45e0c99e79760`.
These are draft diagnostics, not human sign-off or v2 activation evidence.

## Quality corrections and regression checks

Item 03 now includes R4-R3-R2-R1 as the explicit given-name-first distractor,
and its explanation contrasts that mistake with the surname-first rule.

Items 09 and 10 no longer contain opening years, birth years, numeric tie-breaks,
or duplicate normalized full names. Item 09 requires resolving Brooks/Brookside,
Art/Arts, Center/Centre, a complete-name prefix, and Annex/Archives after the
specified normalization. Its distractors reverse a deep word comparison, misfile
the apostrophe-normalized entry, or put Arts before an Art entry. Item 10 requires
title/surname normalization and comparisons between Ana, Ana Maria, Ana Maria
Luisa, Ana Marie, and Ana Mariel, while keeping the different surname Deveras
outside that group. Its distractors reverse complete-name or word-prefix priority,
or incorrectly make given names the primary key.

The new regression check failed against the old item 03 and passes against the
revised batch. Independent rule-based checks recompute all ten alphabetical
orders from the saved stems. Each hard item now has exactly one alphabetically
valid option even without a secondary numeric key. All 40 choices remain complete
permutations; checks also confirm the 49 distinct entries, exact 3/5/2 counts,
three version increments, unchanged canonical IDs and Subprofessional-only
eligibility. The difficulty labels remain editorial estimates pending learner
calibration; the revisions remove the reviewed shortcut rather than treating
longer directions as proof of difficulty.

The formatted revised JSON has SHA-256
`aeeec1abed1551eeeea74f577ed0f8b783f0cefa8535feeeec5b7a773a4d4373`.
All 237 repository unit tests pass after the corrections. Build and browser tests
are not run for these offline content changes. No v2 activation, import, commit,
or push has been performed.

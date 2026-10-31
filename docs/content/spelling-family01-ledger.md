# Family 01 Spelling — ten original items

> Current policy: [seeding families](seeding-families.md) and ADR 0013 supersede
> this ledger's historical draft/candidate and exam-family completion wording.
> Family 01 is complete as a 270-question seed batch. Publication and pooled exam
> readiness are separate; source notes, hashes, and review evidence below remain historical records.

The batch contains **3 easy, 5 medium, and 2 hard** items (30/50/20).
Each has a self-contained prompt, four unique options, one answer key, and an
explanation. Seven use single-word sentence completion; Item 06 requires a
correctly spelled pair to complete two blanks. The last two require
proofreading three words and selecting a complete, non-destructive edit set.

## Location and taxonomy boundary

The records are in
`content/question-bank/cse-2027-v2/families/f01-spelling.json`, with IDs
`f01-spelling-01` through `f01-spelling-10`, version 1, family 1.
All use module `clerical`, subject `clerical_ability`, subtopic
`clerical_operations`, concept `spelling`, language `english`, and applicability
`["subprofessional"]`. Professional learners must never receive these items.

These are staged candidates under [ADR 0012](../ADR/0012-clerical-alphabetizing-and-spelling.md),
not additions to the v1 manifest. The v1 validator still expects Spelling under
`language_accuracy`; its success cannot validate this v2 grouping. No historical
classification, manifest, runtime policy, schema, deployment, or published data
is changed. Adoption requires synchronized v2 policy, tests, versioned manifest
and blueprint metadata, complete-family checks, and human sign-off. Ten candidates
do not establish a permanent per-concept quota or increase the 40-item Clerical
module and its 12/20/8 difficulty cells.

## Item ledger

Stored key IDs are not display letters after shuffling. No explanation depends
on a choice's position, and the editing options refer to source words, not to
other options.

| Item | Skill / target                                                    | Difficulty | Key ID |
| ---- | ----------------------------------------------------------------- | ---------- | ------ |
| 01   | Doubled consonants in address                                     | Easy       | c      |
| 02   | Internal vowel order in receive                                   | Easy       | a      |
| 03   | Unstressed vowels in separate                                     | Easy       | d      |
| 04   | Single c, double s, and -ary in necessary                         | Medium     | b      |
| 05   | Vowel sequence and no inserted d in privilege                     | Medium     | c      |
| 06   | Check consonant doubling in accommodation and vowels in itinerary | Medium     | a      |
| 07   | Double n and -aire in questionnaire                               | Medium     | d      |
| 08   | Double r, single s, and -ence in correspondence                   | Medium     | b      |
| 09   | Repair maintenance and perseverance; retain occurrence            | Hard       | a      |
| 10   | Retain conscientious; repair indispensable and miscellaneous      | Hard       | c      |

Easy items isolate familiar spelling patterns. Medium items distinguish close
forms with several plausible consonant or vowel errors. Item 06 checks two
independent words: knowing either alone leaves at least two candidate pairs,
and the correct option is not uniquely longest. Hard items require a
complete three-word audit: correct all errors while preserving a correct word;
no single-word recognition establishes the whole answer. These are provisional
editorial labels, not learner-calibrated measurements. Human review may require
revising the task or difficulty rather than preserving the ratio artificially.

## Reference and lexical checks

The supplied image is a format reference only, not licensed question text or an
official CSC source. All sentences, target selection, options, and explanations
in this batch are original; none reproduces the source's ten question sentences.
No claim is made that the reference contains actual CSC questions. Quilla is not
affiliated with the Philippine Civil Service Commission.

- Source filename: `codex-clipboard-98302b3d-2c16-4a1e-a688-870a0a71940a.png`.
- Source range: items 41–50; sentence completion with spelling distractors.
- Source SHA-256: `52961479fead984182162a7b69ade97dc1b660fa14c4e77b2f0c6c9a437e2696`.
- Lexical review date: 2026-10-31.
- The supplied image is not copied into the corpus and is not needed at runtime.

Correct forms and contextual senses were checked against Cambridge Dictionary:
[address](https://dictionary.cambridge.org/dictionary/english/address),
[receive](https://dictionary.cambridge.org/dictionary/english/receive),
[separate](https://dictionary.cambridge.org/dictionary/english/separate),
[necessary](https://dictionary.cambridge.org/dictionary/english/necessary),
[privilege](https://dictionary.cambridge.org/dictionary/english/privilege),
[accommodation](https://dictionary.cambridge.org/dictionary/english/accommodation?topic=home),
[itinerary](https://dictionary.cambridge.org/dictionary/english/itinerary),
[questionnaire](https://dictionary.cambridge.org/us/dictionary/english/questionnaire),
[correspondence](https://dictionary.cambridge.org/us/dictionary/english/correspondence?topic=letters-notes-and-cards),
[maintenance](https://dictionary.cambridge.org/dictionary/english/maintenance),
[occurrence](https://dictionary.cambridge.org/dictionary/english/occurrence),
[perseverance](https://dictionary.cambridge.org/us/dictionary/english/perseverance),
[conscientious](https://dictionary.cambridge.org/dictionary/english/conscientious),
[indispensable](https://dictionary.cambridge.org/us/dictionary/english/indispensable),
and [miscellaneous](https://dictionary.cambridge.org/us/dictionary/english/miscellaneous).
Dictionary definitions and examples were not copied. Distractors are deliberate
letter errors, not accepted regional spelling variants. The easy items do not
teach an exception-free spelling rule such as a universal “i before e” rule.

## Review and verification limits

Review checks include record shape, stable unique IDs, four unique choices,
existing correct-choice IDs, exact 3/5/2 allocation, v2 classification,
Subprofessional-only applicability, and distinct targets between items. Both
proofreading keys were checked against all three source words; each competing
edit set leaves an error or introduces one. Neither hard item reveals the key to
an earlier target in this batch.

Repository checks do not certify linguistic quality or v2 release eligibility.
Human editorial review, spelling-variant adjudication, learner calibration, and
v2 activation checks remain pending. Build and E2E are inapplicable to these
offline content-only additions; no application module imports the answer bank.

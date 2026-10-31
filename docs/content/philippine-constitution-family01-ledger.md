# Family 01 Philippine Constitution — forty original items

> Current policy: [seeding families](seeding-families.md) and ADR 0013 supersede
> this ledger's historical draft/candidate and exam-family completion wording.
> Family 01 is complete as a 270-question seed batch. Publication and pooled exam
> readiness are separate; source notes, hashes, and review evidence below remain historical records.

This candidate pool contains **12 easy, 20 medium, and 8 hard** items, exactly
30/50/20. Every item has its own four choices, stable answer key, explanation,
and article/section citation. All forty questions are original practice material,
not transcriptions of the supplied reviewer and not actual or leaked CSC items.

## Location, taxonomy, and selection boundary

The records are in
`content/question-bank/cse-2027-v2/families/f01-philippine-constitution.json`.
IDs run from `f01-philippine-constitution-01` through `40`, version 1, family 1.
All are English, module `shared-core`, applicable to both `professional` and
`subprofessional`, subject `general_information`, subtopic
`civic_and_general_information`, and the existing canonical concept
`philippine_constitution_general_information_events`. The Constitution topic
does not introduce a new concept ID or hardcode a display label as identity.

The v2 directory is the current staging area. This classification already exists
in v1, but this file is not included in the v1 manifest or certified by a v1 run.
Neither a v2 manifest nor runtime v2 policy is introduced here.

**Forty candidates are not forty slots in an exam.** General Information remains
20 questions per selected family, with 6 easy / 10 medium / 4 hard. Final assembly
must select within that cap, provide the planned wider General Information
coverage, and pass the eventual versioned-policy dry run. This pool does not
establish a permanent Constitution quota, constitute a complete family, or
increase the corpus minimum. It may not be served or published without the
required release validation and human sign-off.

## Item ledger

Key IDs identify options, not display letters after a future shuffle. All options
and explanations are position-independent.

| Item | Distinct target                                  | Difficulty | Key ID | Constitutional authority                           |
| ---- | ------------------------------------------------ | ---------- | ------ | -------------------------------------------------- |
| 01   | Preamble                                         | Easy       | a      | Preamble                                           |
| 02   | Popular sovereignty                              | Easy       | c      | Article II, Section 1                              |
| 03   | Civilian supremacy                               | Easy       | b      | Article II, Section 3                              |
| 04   | Senate membership                                | Easy       | d      | Article VI, Section 2                              |
| 05   | Executive power                                  | Easy       | a      | Article VII, Section 1                             |
| 06   | Judicial power                                   | Easy       | c      | Article VIII, Section 1                            |
| 07   | Public office                                    | Easy       | b      | Article XI, Section 1                              |
| 08   | National language                                | Easy       | d      | Article XIV, Sections 6–7                          |
| 09   | Family                                           | Easy       | a      | Article XV, Sections 1–2                           |
| 10   | Constitutional Commissions                       | Easy       | c      | Article IX-A, Section 1                            |
| 11   | Naturalization                                   | Easy       | b      | Article IV, Section 1(4)                           |
| 12   | Supreme Court composition                        | Easy       | d      | Article VIII, Section 4(1)                         |
| 13   | Taking for public use                            | Medium     | d      | Article III, Section 9                             |
| 14   | Judicial warrants                                | Medium     | b      | Article III, Section 2                             |
| 15   | Suffrage and prohibited qualifications           | Medium     | a      | Article V, Section 1                               |
| 16   | Citizenship by parentage                         | Medium     | c      | Article IV, Section 1(2)                           |
| 17   | Senatorial natural-born requirement              | Medium     | b      | Article IV, Section 2; Article VI, Section 3       |
| 18   | Presidential qualifications                      | Medium     | d      | Article VII, Section 2                             |
| 19   | House district qualifications                    | Medium     | a      | Article VI, Section 6                              |
| 20   | Origination of revenue bills                     | Medium     | c      | Article VI, Section 24                             |
| 21   | Party-list denominator                           | Medium     | b      | Article VI, Section 5(2)                           |
| 22   | Legislative arrest privilege                     | Medium     | a      | Article VI, Section 11                             |
| 23   | Constitutional tax policy                        | Medium     | d      | Article VI, Section 28(1)                          |
| 24   | Amnesty                                          | Medium     | c      | Article VII, Section 19; Article IX-C, Section 5   |
| 25   | Vice-President in Cabinet                        | Medium     | b      | Article VII, Sections 3, 9, 16, and 21             |
| 26   | Local term limits                                | Medium     | d      | Article X, Section 8                               |
| 27   | Alienable public-domain lands                    | Medium     | a      | Article XII, Section 3                             |
| 28   | Public utility ownership                         | Medium     | c      | Article XII, Section 11                            |
| 29   | Religious tests                                  | Medium     | b      | Article III, Section 5                             |
| 30   | Public education                                 | Medium     | d      | Article XIV, Section 2(2)                          |
| 31   | Exclusion of unlawfully obtained evidence        | Medium     | a      | Article III, Section 3(2)                          |
| 32   | Special-purpose tax funds                        | Medium     | c      | Article VI, Section 29(3)                          |
| 33   | Veto override thresholds                         | Hard       | b      | Article VI, Section 27(1)                          |
| 34   | Legislative discipline                           | Hard       | c      | Article VI, Section 16(3)                          |
| 35   | Martial law safeguards                           | Hard       | a      | Article VII, Section 18                            |
| 36   | Succession and presidential eligibility          | Hard       | d      | Article VII, Section 4                             |
| 37   | Treaty concurrence versus war declaration        | Hard       | c      | Article VII, Section 21; Article VI, Section 23(1) |
| 38   | Constitutional initiative signature distribution | Hard       | a      | Article XVII, Section 2                            |
| 39   | Public-domain corporate lease limits             | Hard       | b      | Article XII, Section 3                             |
| 40   | Supreme Court appointment pathway                | Hard       | d      | Article VIII, Sections 7(1), 7(3), and 9           |

## Difficulty and editorial rationale

Easy items identify a constitutional institution, term, or explicit basic fact.
Medium items apply a provision to a short scenario, distinguish a qualification
or exception, or interpret the relevant denominator. Item 16 compares maternal
and paternal citizenship with birthplace alone; it no longer assumes the answer.
Item 21 requires deriving party-list seats from 240 district seats using total
membership as the denominator, not multiplying a supplied total by a supplied
percentage. It remains a simplified constitutional share calculation, not the
statutory party-list seat-allocation algorithm; its difficulty estimate is provisional.
Items 24–25 distinguish realistic approval thresholds, appointing bodies, and
express exceptions rather than relying on implausible institutional distractors.

Hard items coordinate multiple constraints rather than just obscure recall:

- 33: separate full-membership veto-override thresholds; no pooling.
- 34: sufficient disciplinary votes do not cure an excessive suspension period.
- 35: distinguish the initial martial-law ceiling, report deadline, and legal effects;
  every individual correct assessment is shared by the key and one distractor.
- 36: distinguish exactly four years from more than four years after succession.
- 37: contrast treaty concurrence with separate-chamber war-declaration votes.
- 38: apply both nationwide and every-district signature thresholds.
- 39: check corporate lease area, initial duration, and renewal duration together.
- 40: screen three candidates against age and experience minimums, then check
  JBC list size and the no-confirmation rule. Three options require no confirmation,
  so that rule alone cannot identify the answer.

Labels are editorial estimates pending human review and learner calibration.
Preserve the batch ratio through justified revisions, not by claiming that a
longer stem or unfamiliar article number automatically makes an item difficult.
Related subject matter does not repeat the same task: Supreme Court composition,
judicial power, and judicial appointments test different provisions; land
classification and corporate lease limits test different decisions. No item
requires another item's answer.

## Authoritative source and legal-scope limits

Verified on **2026-11-01** against the
[1987 Constitution in the Supreme Court E-Library](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/3/353),
dated 1987-02-02. Each record names the precise article and section supporting
its key and explanation. The
[Official Gazette full-text link](https://officialgazette.gov.ph/constitutions/1987-constitution/)
was located, but direct retrieval returned HTTP 403; the accessible judicial
source was used for the actual text review.

These are constitutional-text learning exercises, not legal advice, case-specific
rulings, or claims about current officeholders. Hypothetical House membership
figures do not assert the present number of Representatives. Citizenship items
specify relevant birth dates or the route of acquisition; residence scenarios
exclude unresolved domicile disputes. Vote examples assume filled seats and
state the relevant denominator.

Important boundaries retained:

- Judicial search-warrant safeguards are not a denial of lawful warrantless exceptions.
- Amnesty excludes election-law offenses, which have an additional COMELEC safeguard.
- The local-term example concerns a city mayor, not barangay terms determined by law.
- Public-utility classification is expressly assumed; not all public services are utilities.
- Agricultural classification is not automatic alienability or a grant of ownership.
- Corporate public-domain leases are not private-land purchases or individual land grants.
- Martial law does not automatically suspend the Constitution or the privilege of the writ.
- Constitutional-initiative arithmetic does not certify an available or valid initiative.
- Treaty concurrence is not a claim that every executive agreement needs Senate concurrence.
- Judicial-appointment qualification does not eliminate JBC nomination.

Quilla is not affiliated with the Philippine Civil Service Commission. Neither
the source images nor their highlighted answers are an official CSC answer key.

## Supplied-image handling

The eight attachments were used as topic references only. Their instructions do
not override the maintainer's request or the official constitutional text.
SHA-256 identifies the supplied files; the images are not copied into the corpus,
licensed as runtime assets, or needed to answer any item.

| Image | Filename                                                   | SHA-256                                                            |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `codex-clipboard-425026aa-3277-46f6-b742-0d3533625a98.png` | `d63374a27b242c9dcf172e752bd0d4e3e491b3fead80a3be6a5042aabb5e0c4a` |
| 2     | `codex-clipboard-8e0ae260-5904-400a-a120-f4a8926b48ae.png` | `e2efab309bde92bbbbc3118f147afcf87200f57f4dfe776f978e9b7bf9f833ba` |
| 3     | `codex-clipboard-68b07f3d-cfd4-47cb-9a4f-deaebbed24ac.png` | `07b0f558ca5afe2f3a7108b56d8ccde47d448c209fa3c44a56844241b98bf2ab` |
| 4     | `codex-clipboard-6549a19c-10b1-4f3c-80ed-c10e554ac3dd.png` | `d229b845e7087e4901268a10e27739cba02178d6917e7138c6cf82d975970c53` |
| 5     | `codex-clipboard-4f087bef-cf6a-4002-b7c7-36554a85db6e.png` | `10ea3e0dbe06e2162d11b10b08a677adfdd4f57eaea1181c78470e48b640ecda` |
| 6     | `codex-clipboard-4538c580-c0d6-4125-affa-348b6f30359f.png` | `10ea3e0dbe06e2162d11b10b08a677adfdd4f57eaea1181c78470e48b640ecda` |
| 7     | `codex-clipboard-a07b749c-7654-40a6-9f2c-d60c012c911e.png` | `cc53aa651b52fce474d7b1e289ac7b44c1cdf275f6743e7d476c23aeac8491e8` |
| 8     | `codex-clipboard-a187bc9b-3717-4f99-b98c-60e5398396c6.png` | `b3afd14d0ff3ecd7e0b5b3b45e8e884823c69d95f57c3582e0ea58838f694466` |

Images 5 and 6 are byte-identical and are not counted as separate topic coverage.
The batch deliberately excludes the images' tax-return dates, historical tax
categories, estate-tax classification, statutory-program identification,
SEA Games slogan, 2019 holiday count, province trivia, ozone question, and DENR
program question. These do not establish constitutional-text answers. The image's
habeas-corpus reference is corrected to Article III, Section 15 and Article VII,
Section 18 where relevant; Article II, Section 15 concerns health.

## Verification and release limits

Local checks cover exact count and difficulty split, unique IDs/stems/choice
texts, four distinct choice IDs with one existing key, correct applicability and
taxonomy, nonempty explanations and precise legal citations. Manual review checks
each alternative, explicit exceptions, arithmetic, and task distinctness.

The quality-review revisions retain all forty IDs, version-1 draft status, key
IDs, classifications, and difficulty labels. Items 16, 21, 24, 25, 35, and 40 are
the only question records changed. Targeted regression checks cover the inverse
party-list calculation (60 / 300 = 20%, rather than 48 / 288), Item 35's
three-assessment distractor matrix, and Item 40's independent age, experience,
shortlist, and confirmation gates. The latter admits Tomas with three nominees
and no confirmation, but rejects the two-nominee plan and both underqualified
candidates. Draft edits here are not authorization to rewrite published versions.

Repository checks do not certify legal accuracy, measured difficulty, or release
eligibility. Human constitutional-content review, calibration, final selection,
versioned-manifest validation, and activation dry runs remain pending. Build and
E2E are not applicable to this offline-only content addition; no application code,
client bundle, schema, deployment, or production data changes.

# Family 03 — fresh quality and accuracy audit

Historical revision-1 findings. The subsequent
[revision-2 repair](family03-quality-revision.md) records their dispositions,
changed versions and current verification; this audit is retained unchanged
below as evidence, not a claim that the repaired bank still has these defects.

Review completed: 2026-11-02. Read-only review of the question bank against
[rules.md](../../content/question-bank/rules.md). This report supplements the
authoring ledgers; it does not revise any question, key, reference, asset or
manifest, and does not grant publication approval.

## Verdict and reviewed identity

**No confirmed incorrect answer key was found across the 270 items. The bank
does not yet pass the stronger editorial-quality gate.** Correct keyed answers
do not establish strong distractors, semantic originality or honest difficulty.

- Family 03 manifest: revision 1, checksum
  `c6fd2b9e59e0e859c455304aafa444f6c037d7a9ba159c09ba5bea7707c65aa8`.
- Comparison inventories: Family 01 revision 5 and Family 02 revision 4, as
  present locally during this review. Existing uncommitted work was preserved.
- All 270 stems, options, keys and explanations were reviewed in separate
  subject passes, together with 24 dedicated verbal references, ten analytical
  datasets and ten chart images. Fresh reviewers assessed subjects other than
  those they originally authored; the main integrator adjudicated findings.
  These are AI-assisted reviews, not human or bilingual editorial signatures.
- Seed validation passes with zero errors and zero warnings; 58 focused
  integration/numerical/clerical tests and five Python analytical tests pass.
  Structural validation and regression tests do not resolve the findings below.

Stored difficulty counts remain exact, but several tasks do not sustain those
labels under the rule's cognitive-demand definitions. Do not describe the
substantive 30/50/20 gate as settled until the flagged tasks are improved and
reviewed again. Do not fix this by changing labels alone.

| Subject             | Items | Stored easy / medium / hard | Key-check result       | Editorial result                                               |
| ------------------- | ----: | --------------------------- | ---------------------- | -------------------------------------------------------------- |
| General Information |    40 | 12 / 20 / 8                 | No confirmed wrong key | Scope/explanation and distractor refinements                   |
| Verbal Ability      |    50 | 15 / 25 / 10                | No confirmed wrong key | Duplicate, answer-disclosure, language and calibration repairs |
| Numerical Ability   |    60 | 18 / 30 / 12                | No confirmed wrong key | Hard/medium demand repairs                                     |
| Analytical Ability  |    80 | 24 / 40 / 16                | No confirmed wrong key | Structural duplicate, shortcuts and distractor repairs         |
| Clerical Ability    |    40 | 12 / 20 / 8                 | No confirmed wrong key | Spelling audit/variant and recurrence refinements              |

P2 below means an actionable quality defect requiring revision before editorial
acceptance. P3 means narrower clarification or lower-priority refinement. A
candidate is explicitly distinguished from a confirmed semantic duplicate.

## 1. Originality and recurrence

### P2 — Logic 34 repeats an entire Family 02 constraint system

`f03-analytical-logic-34` in
[F03 logic](../../content/question-bank/family-03/content/f03-analytical-logic.json)
is structurally identical to `f02-logic-english-40` in
[F02 logic](../../content/question-bank/family-02/content/f02-logic-english.json).
Map A/B/C/D/E to P/Q/R/S/T: choose three of five, first requires second, third
excludes second, fourth requires fifth, and the third is selected. Both force
the same renamed triple. Asking for a forced statement instead of the full set
does not create new reasoning. Replace the underlying problem.

### P2 — English Grammar 01 is a cosmetic agreement repeat

`f03-grammar-english-01` repeats `f02-grammar-english-01`: _Each of the cabinets
has_ becomes _Each of the lamps needs_. The intervening plural and singular
_each_ trap remain unchanged. Moving from a blank to full-sentence choices does
not materially expand coverage. Use a substantively different construction.

### P2 candidate — Clerical Operations 10 revisits approved-versus-draft filing

`f03-clerical-operations-10` and `f01-clerical-operations-16` both select the
current approved revision instead of a later draft. F03 adds approval dates but
removes F01's client/reference matching. This is a substantive recurrence
candidate, not an exact duplicate or an equally strong proof as Logic 34.
Prefer a different document-control decision rather than another set of dates.

No exact duplicate complete tasks or reused dedicated passages were detected.
That does not imply no semantic repeats: the cases above survive exact hashing.
Sharing basic skills or legal provisions alone was not treated as duplication.

## 2. Verbal answer disclosure, language and distractors

- **P2 — English Reading 04 (hard):** its passage explicitly says the runner
  request was accepted, the handle request declined and the whole guarantee was
  not cancelled. The key repeats those disclosed outcomes. Remove the decisions
  from the passage and require the taker to infer them from the guarantee and
  causal findings, with plausible mixed conclusions as alternatives.
- **P2 — Filipino Grammar 07 (medium):** the correct choice repeats the complete
  comparison sentence already supplied in the stem. Exact text matching bypasses
  grammar. Start with a genuinely defective or ambiguous construction and require
  a meaning-preserving repair.
- **P2 editorial concern — Filipino Vocabulary 03:** “Bukal ang tubig sa paanan
  ng burol” does not naturally express the intended noun sense of a spring or
  source of water; it predicates _bukal_ of the water. The
  [dictionary entry](https://diksiyonaryo.ph/word/bukal) identifies that noun sense
  as the source. Rewrite the literal clause around the spring's location and
  obtain bilingual confirmation. The intended key is still recognizable; this
  is not a confirmed wrong-key finding.
- **P3 — Filipino Reading 05 (hard):** the final passage sentences explicitly
  supply the blind-marking policy, clarification, consistency test and limitation
  on consensus. Its length disguises largely direct restatement. Increase actual
  inference rather than merely retaining the label.
- **P3 — Filipino Vocabulary 05:** acceleration, adding ingredients and changing
  ownership are weak alternatives to the shared filtering sense of _sinala_.
  Give alternatives that capture one use but fail the other.
- **P3 — Filipino Vocabulary 06:** three literal weighing examples versus one
  conspicuous figurative evaluation make this straightforward recognition rather
  than meaningful medium discrimination. Use plausible rival figurative senses.

All 12 paragraph keys were defensible best orders among the supplied choices;
no second keyed order was confirmed. Each reading/paragraph question still owns
its own complete reference. Independent bilingual review remains necessary.

## 3. Numerical difficulty and unused complexity

- **P2 — Numerical 35 (hard):** reduces directly to
  `0.96P + 1200 = P`, hence PHP 30,000. The key is correct, but this is routine
  successive-percentage interpretation and inversion, closer to medium.
- **P2 — Numerical 40 (hard):** divisibility by three is automatic for every
  permutation of 1, 2 and 3. Only `hundreds - units = 1` constrains the answer,
  giving 231 and 312. The redundant clause does not establish interacting hard
  constraints. Redesign the solution space rather than add more wording.
- **P2 — Data Sufficiency 20 (hard):** statement 1 directly determines 6 and 14;
  statement 2 gives product 84. Each settles whether the geometric mean exceeds 9. Both alone and together are consistent, and the key is correct, but the
  direct product statement makes the second test immediate.
- **P2 — Data Sufficiency 12 (medium):** each statement independently gives the
  base wage by a single division, `360/3` or `600/5`. The overtime calculation is
  unnecessary to deciding “either statement alone.” Make the statements depend
  on interpreting the pay regimes, not just determining the same rate directly.

The reviewed DS pairs were mutually consistent, with valid alone/together
reasoning. No “definite no is insufficient” error or imported-other-statement
fact was identified. Numerical 33–34 and 39, DS 17–19 and Clerical 17–20 provide
stronger constrained tasks worth retaining.

## 4. Analytical distractor and demand shortcuts

- **P2 — Logic 36 (hard):** the three distractors remove a required signature or
  leave the candidate unsigned. They can be rejected without resolving the
  exclusive archive/encryption condition. Include competing repairs that preserve
  signatures but differ in the flag outcomes, so the interaction matters.
- **P2 — Data 18 (medium):** vegetables have both maximum water intensity and
  maximum total water consumption. Picking the largest intensity accidentally
  answers the total-consumption question. Change the data so the shortcut loses.
- **P2 — Data 38 (medium):** C has both highest raw benefit and highest
  benefit/cost. Choosing the largest numerator yields the key without using cost.
  Make the highest numerator and correct efficiency maximum different.
- **P2 — Logic 15 (medium):** the key is conspicuously long and the only
  qualified claim. The other choices say definitely faulty, always works or that
  the socket repaired the lamp. Compare similarly qualified rival explanations
  rather than reward hedging recognition.
- **P2 — Several medium tasks are direct easy applications:** Data 14 is one
  multiplication (`20 × 40`); Data 27 adds two explicit disjoint counts
  (`30 + 20`); Data 39 asks direct sums; Logic 24 applies the supplied
  “more than half” definition to `9/18`; Logic 26 applies one necessary condition.
  Improve the actual tasks before accepting their medium allocation.
- **Lower-confidence calibration concerns:** hard Logic 33 and 39 reduce to
  small straightforward ordering spaces. Reconsider alongside stronger hard
  tasks; these are borderline estimates, not confirmed accuracy defects.

All ten final charts matched their tables on visual review. No value, unit,
axis or pie-share discrepancy was identified. Stronger items include Data 12,
20, 32, 36 and 40, and Logic 38. Exhaustive constraint checks supported the
reviewed hard logic keys. Stored answer IDs were not treated as display-letter
bias: the documented serving policy calls for saved choice permutations.

## 5. Clerical spelling and explanation accuracy

- **P2 — Spelling 09–10:** every option in 09 supplies _acquiesce_, and every
  option in 10 supplies _rhythm_. Those advertised repairs are not tested at
  all. More words do not independently make an audit hard. Make every claimed
  target consequential to the answer and reassess the task's demand.
- **P3 — Spelling 09:** its explanation categorically calls _supercede_ an
  introduced error. [Merriam-Webster](https://www.merriam-webster.com/dictionary/supercede)
  labels it a disputed spelling variant, while noting that it is widely regarded
  as an error. This does not create a second correct key because the instruction
  also says to preserve already correct _supersede_. Avoid the disputed form or
  prescribe the convention and accurately explain the unnecessary change.
- Spelling 02's _calender_ is a real technical word, but the supplied dated-schedule
  context supports _calendar_. No second key was confirmed; the context does
  some usage discrimination as well as spelling recognition.

All ten alphabetizing keys followed the stated normalization and tie-break rules.
No malformed sequence or missing-list dependency was identified.

## 6. General Information and bank-wide cueing

- **P3 — General 36:** R's scenario lists design, implementation and evaluation,
  but the explanation invokes full integration including monitoring.
  [RA 9729 section 3(i)](https://lawphil.net/statutes/repacts/ra2009/ra_9729_2009.html)
  explicitly includes monitoring. State that stage in R or qualify the
  completeness claim. The current comparison remains the best supplied answer.
- **P2 bank-wide distractor refinement:** the keyed choice is uniquely longest
  in 25 of 40 General items, five of six English reading items and five of six
  Filipino vocabulary items (character-count screen). Length alone does not
  prove a defective item, but manual examples reinforce the cue: General 24
  contrasts a nuanced multi-stage answer with implausible claims that gender
  mainstreaming replaces environmental assessment or requires identical personal
  outcomes; General 31 contrasts a near-restatement with commission/kinship/
  after-hours distractions. Make alternatives comparable in specificity and
  plausibility, not simply equal in character count.

The General legal keys checked against the relevant provisions were supportable,
including custodial waivers, trial in absence, business-interest disclosure and
the former-agency professional-practice exception. This is not legal sign-off.
Source-access limitations remain: direct _yield_ and _fine_ dictionary retrieval
returned 403 in the fresh language pass; _bigat/timbang_ figurative usage and
naturalness still need independent bilingual confirmation. Do not represent
blocked pages or pending human review as completed verification.

## Next gate

Revise the confirmed duplicate patterns, make distractors consequential and
plausible, strengthen the actual under-demanding tasks, and correct the narrow
language/explanation defects. Preserve IDs and follow the documented version,
manifest-revision and checksum procedure. Then independently resolve all keys
and alternatives again and rerun validation and focused tests. Keep the agreed
subject counts and 30/50/20 target through substantive redesign, not relabelling.

No question-bank content changed during this audit. No database import,
publication, commit, push or deployment occurred. Lint/typecheck/build/E2E were
not repeated for this read-only content review; the only new artifact is this
Markdown report, checked for formatting and local links. Human approval and
empirical calibration are not claimed.

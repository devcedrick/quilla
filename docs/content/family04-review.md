# Family 04 review and validation

> Current chart revision: [revision-2 visual practice](family04-chart-revision.md) supersedes the original table-only inventory and checksum below. The earlier authoring report remains historical evidence.

Review date: 2026-11-02. Original offline CSE practice content. Quilla is not affiliated with the Philippine Civil Service Commission. No actual or leaked CSC examination material is used.

## Inventory

Family 04 is an independent 270-question authoring batch, using taxonomy `cse-taxonomy-2027-v2` and pooled blueprint metadata `cse-professional-2027-v3` / `cse-subprofessional-2027-v3`. Manifest revision 1; each question/reference begins at version 1. It is not a fixed exam. Difficulty is a cognitive-demand estimate, not an empirical success rate or official CSC allocation.

| Subject             | Total | Easy | Medium | Hard |
| ------------------- | ----: | ---: | -----: | ---: |
| General Information |    40 |   12 |     20 |    8 |
| Verbal Ability      |    50 |   15 |     25 |   10 |
| Numerical Ability   |    60 |   18 |     30 |   12 |
| Analytical Ability  |    80 |   24 |     40 |   16 |
| Clerical Ability    |    40 |   12 |     20 |    8 |
| Total               |   270 |   81 |    135 |   54 |

Verbal is exactly25 English/25 Filipino; all other subjects are English. All Numerical questions, including18 Data Sufficiency items, use shared-core/both levels. Analytical80 is Professional only; Clerical40 is Subprofessional only. Modules: shared-core150, analytical80, clerical40.

Concept allocations: General40; Verbal vocabulary12/grammar14/reading12/paragraph12; Numerical reasoning42/Data Sufficiency18; Analytical data32/logic48; Clerical operations22/alphabetizing10/spelling8. These internal authoring allocations do not add exam quotas. Every approved concept has coverage.

There are32 references:24 dedicated independently authored reading/paragraph records and8 canonical Analytical text/table datasets. There are no images, so image-hash/dimension and visual chart inspection are inapplicable. Tables remain complete for individually selected questions. All files are outside public assets and application imports.

## Coverage, diversity and per-item evidence

The authors read the current generation rules, policies, taxonomy and preceding family lessons before drafting. Coverage plans enumerate IDs, task types and difficulty goals; the Analytical plan initially groups consecutive IDs and its final per-item solution ledger expands each question. Original civic coverage includes social rights, gender equality, air/water protection and public ethics. New independent reading contexts include oral history, astronomy, museum loans, radio theatre, seed lending and community journalism. Mathematics includes remainders, rounding intervals, piecewise tariffs, integer optimisation and data-sufficiency countermodels. Analytical data includes directional flow matrices, confusion tables, ranked-ballot elimination, fixed-plus-variable bids, robust feature coverage and grouped-time bounds. Clerical tasks use explicit fictional office policies and multi-resource reconciliation, not assumed universal practice.

Per-item keys, evidence, source locators, retrieval/review dates, exact reference linkage and assumptions are recorded in:

- [General/Verbal plan](family04-general-verbal-plan.md) and [90-item source/solution ledger](family04-general-verbal-review.md).
- [Numerical/Clerical plan](family04-numerical-clerical-plan.md) and [100-item source/solution ledger](family04-numerical-clerical-review.md).
- [Analytical plan](family04-analytical-plan.md) and [80-item solution ledger](family04-analytical-review.md).
- [Independent AI audit and candidate adjudication](family04-quality-audit.md).

Factual civic claims use retrieved primary constitutional/statutory texts and precise provisions. Language/spelling sources and inaccessible-source limitations appear in the subject ledgers. The KWF orthography PDF was not retrieved in full; only an indexed NANG excerpt was accessible, and the ledger does not claim full-PDF verification. DepEd competency references establish curricular context, not proof of every authored grammar key. Bilingual/domain editorial approval remains pending. Invented mathematical datasets and fictional office rules are verified against their supplied premises rather than represented as external facts.

## Review and repairs

Three sub-agents assisted the main author: two subject authors cross-reviewed one another, and a third independent AI reviewer solved Analytical tasks and audited the entire bank. Authorship, a distinct author solution pass, peer AI review, structural validation, human editorial approval and calibration are separate states. No human signature is claimed.

Initial reviews found weak single-condition shortcuts, implausible distractors, two cosmetic prior-family grammar/logic forms, reused spelling targets, one ambiguous paragraph order, and inequalities that resembled HTML to the plain-text validator. The authors replaced tasks or strengthened their interacting conditions and revised all affected explanations. Difficulty labels were preserved through substantive redesign rather than promotion of easier questions. Initial offline drafts were corrected before the revision1 checksum was pinned; no completed earlier family was revised.

Independent checks recompute all42 Numerical answers, five-outcome Data Sufficiency models and counterexamples, all10 alphabetizing permutations, spelling keys, hard clerical reconciliations, and finite models for coupled Analytical tasks. These are executable checks on meaningful answer/feasibility claims, not claims of learner calibration. Cross-family screens compare all existing01–03 banks with04; semantic review is also required and findings are recorded in the audit. A missing hash/token match does not prove originality.

## Final validation and checks

Pinned manifest revision1 checksum: `4d79c4929ecc8ac41de771487ed905c68b32a76e6341190a22c0e87bf14bf442`.

| Check                                                     | Outcome                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed validator, text and JSON modes, with pinned checksum | PASS:270 questions,32 references,0 assets,completeSeedFamilies1;zero errors/warnings;examReadiness not-evaluated                                        |
| Subject-level authoring gate                              | PASS:each subject separately30/50/20, Verbal25/25                                                                                                       |
| Independent Numerical/Clerical checks                     | PASS:42 numerical solutions,18 sufficiency models/all5 outcomes,10 complete filing permutations,workflow/custody/retention cases,spelling keys          |
| Independent Analytical verifier                           | PASS:6 hard data tasks andall10 hard logic tasks,including full finite-case enumeration;remaining items separately solved in reviewer ledger            |
| Cross-family audit                                        | PASS:no IDcollisions or exact full-task duplicates across1,080 items;82 token-overlap candidates adjudicated;one intended easy literal-rule recognition |
| Full unit suite                                           | PASS on retry:374 tests in29 files                                                                                                                      |
| Final focused content suite                               | PASS after last originality repair and checksum pin:5 tests,including independent solution verifiers                                                    |
| Lint                                                      | PASS,no warnings after checker repairs                                                                                                                  |
| Typecheck                                                 | PASS                                                                                                                                                    |
| Knip                                                      | PASS;verification scripts are exercised by focused unit tests                                                                                           |
| Prettier                                                  | PASS for new Family04 files only                                                                                                                        |
| git diff --check                                          | PASS                                                                                                                                                    |

The initial full unit run had two5-second timeouts in existing validator tests under concurrent Windows worker load. A full rerun passed without weakening tests or changing their timeout. An attempted npm worker argument was not forwarded by PowerShell;the passing full rerun still used29 workers. The final focused suite invoked Vitest directly with maxWorkers2. Windows parent-directory sandbox realpath restrictions prevented ordinary Nodefile execution;the offline checks were rerun through approved read-only execution outside that restriction. No production access or credentials were involved.

Repository tests/lint/Knip were run against the shared working tree,including the pre-existing Family03 changes. Later only Numerical19's new content,its matching checker and ledgers changed;the final focused suite re-exercised all Family04 invariants and solution checks. The final lint/format checks cover those final scripts. Build/E2E and security-service scans were not run:there is no runtime,bundle,backend or user journey change,no new dependencies,and no configured separate content-security scanner. The local content was checked for secret-like values;none were found. Existing unrelated Family03/root-index files were not reformatted.

## Boundaries and remaining gates

The existing uncommitted Family03 bank, review documents, scripts and root index edits were preserved. No backend/schema/authentication/CI/deployment code changed. There was no import, database seed execution, publication, deployment, commit or push. This request was fulfilled as the complete offline family-authoring workflow prescribed by rules.md; seed-mode success is not permission to serve content or a pooled-exam feasibility result.

Human bilingual/domain review, publication approval, empirical difficulty calibration, eventual controlled import and pooled blueprint feasibility remain separate gates. Build/E2E are inapplicable because no production bundle, runtime or user journey changed. CI and issue-linked pull-request delivery were not run because no commit/push was requested; repository policy reserves those actions for explicit human instruction.

# Authoring the initial question bank

S19.1 (#88) supplies an offline format and validator, not a populated or published
bank. Use Node 22.14.0. No installation beyond repository dependencies, credentials,
network access, or Convex deployment is needed. Policy comes from
[ADR 0008](../ADR/0008-initial-cse-taxonomy-and-blueprint-policy.md) and the
[taxonomy and blueprint contract](../exams/cse-taxonomy-and-blueprints.md).

## Current seeding policy versus the legacy validator

[ADR 0013](../ADR/0013-seeding-families-and-pooled-exam-selection.md) supersedes
the paired-exam family interpretation. Each seed family has 270 unique authored
questions: 40 General, 50 Verbal, 60 Numerical, 80 Analytical, and 40 Clerical.
Seven families yield 1,890 unique questions. Family 01 is complete for seeding;
exams draw from all eligible published families combined, subject to their own
quotas. See [seeding families](seeding-families.md) for completion and reuse rules.

[ADR 0016](../ADR/0016-seven-family-scope-and-deferred-audit.md) excludes
Family 08 from the initial delivery and defers the supplemental exhaustive audit
to follow-up work. Per-family review and seed validation do not certify all items
as accurate, grant publication approval, or measure learner difficulty. See the
[review and acceptance boundaries](seeding-families.md#review-and-acceptance-boundaries).

The existing validator now has a separate `seed` mode implementing seed-count
and taxonomy-v2 structural checks. Legacy `draft`/`release` modes remain pinned
to the old policy for reproducibility; their paired-family gate is not the new
completion test. Pooled v3 generation, publication gates, and eligible-version
dry runs remain unimplemented. Do not change content to satisfy an obsolete gate.

## Files and commands

Each family has an independent bank under `content/question-bank/family-NN/`:
its own `manifest.json`, separate question arrays in `content/`, and shared
reference/asset metadata in `references/`, with images in `references/assets/`.
Family 01 contains 17 content files for its 270 questions. Future families have
separate folders and manifests; do not append them to a global question file.
See [ADR 0015](../ADR/0015-per-family-content-and-reference-banks.md). These files
contain answer keys: never place them in `public/`, import
them into application modules, or include them in client bundles. The validator
is an offline Node script and is not used by the application.

```sh
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed
node scripts/validate-question-bank.mjs --manifest content/question-bank/family-01/manifest.json --mode seed --json
```

Legacy v1 manifests can still be inspected in Git history or exercised by test
fixtures. Their former on-disk paths were removed during consolidation and are
not current validation commands.

The legacy validator's draft mode validates declared content and reports incomplete
coverage. Its release mode still requires eight paired exam families under the
superseded v1 contract; that is not a current seeding-completion check.
Neither mode substitutes difficulty
cells or publishes questions. Exit codes: 0 means no validation errors; 1 means
invalid content; 2 means invocation, unsafe path, or filesystem access failure.
Malformed JSON is invalid content (1). Output includes errors/warnings with file,
record ID, rule, expected/actual values, distributions, and per-family coverage.
Warnings include exact duplicate candidates requiring editorial adjudication.

## Combined seed inventory (manifest format 2)

The [Family 01 inventory](../../content/question-bank/family-01/manifest.json)
uses `formatVersion: 2`, `taxonomyId: "cse-taxonomy-2027-v2"`, the two v3 blueprint
IDs, `seedFamilies: [1]`, and a nonempty `sources` array. Each source has only
`root`, `questionFiles`, `referenceFiles`, and `assetFiles`; all three file lists
are required. `root` is relative to the combined manifest's directory (empty
string means that directory). Record lists and image paths are relative to their
source root. Each family's layout uses one source with `root: ""` and
`questionFiles` listing all its `content/*.json` files. Reference metadata lists
images as `references/assets/...` relative to that family. Question values and
shared reference records remain unchanged by layout changes.
The top-level identity, revision, optional checksum, and external `signOff` fields
have the same roles as format 1; top-level record file lists are not allowed.
Question, reference, and asset record shapes do not change.

Seed mode shares the existing structural, provenance, taxonomy, applicability,
reference, image/checksum, duplicate-candidate, and path-safety checks. IDs and
reference links are checked across sources, not separately per folder. Unknown
fields, duplicate declarations, undeclared families, missing/extra subject items,
and dangling references/assets fail validation. Every JSON file beneath each
source's `content/`, legacy `families/`, and `references/` directories must be declared, including
nested files; inventory symlinks are rejected. Paths cannot traverse or resolve
outside the combined manifest's root. This inventory check covers declared source
roots, not arbitrary undisclosed directories elsewhere in the repository.

For every declared seed family, require 270 unique canonical questions and the
40/50/60/80/40 subject totals, with 25 English and 25 Filipino Verbal questions.
Report actual difficulty distributions without imposing exam difficulty cells or
new fixed per-concept seed quotas. Exact duplicate candidates remain warnings
requiring editorial adjudication; semantic duplicates and source accuracy still
need human review. Do not relabel content to make authoring ratios look exact.

The JSON result contains per-family subject/difficulty totals,
`completeSeedFamilies`, and `examReadiness: "not-evaluated"`; it does not claim a
number of feasible exams. A successful seed run neither publishes anything nor
certifies legal accuracy, difficulty calibration, seven-family completion, or
pooled exam activation. Review the [Family 01 report](family01-validation.md).
All modes retain exit codes 0/1/2 as described above.

Checksums include the combined manifest inventory and all original records;
`datasetChecksum` and external `signOff` remain excluded. Update the revision,
rerun without the old checksum, review the changed content, and pin the new
checksum when the reviewed inventory changes. An invalid run is not signable.

## Taxonomy v2: Data Sufficiency

[ADR 0011](../ADR/0011-numerical-data-sufficiency.md) and the
[taxonomy addition](../exams/cse-taxonomy-and-blueprints.md#approved-addition-numerical-data-sufficiency)
approve `data_sufficiency` as a second shared Numerical Ability concept, under
subtopic `numerical_reasoning`. This is distinct from the existing concept with
the same name as that subtopic. Under ADR 0013, each generated exam must contain
Data Sufficiency within its shared Numerical selection from the pooled bank,
inside the existing exam counts and difficulty cells.

The combined seed manifest and `seed` mode accept the new concept under taxonomy
v2 with v3 blueprint identifiers. Legacy manifests and modes remain v1. Runtime
adoption and pooled exam checks are still separate work. The question-record
shape remains unchanged. Do not retag computation questions as Data Sufficiency or rewrite
historical versions merely to meet coverage. New items require two consistent
statements, five full-text sufficiency outcomes with stable choice IDs, and
explanations evaluating each statement separately and then together.

### Taxonomy v2 Clerical grouping

[ADR 0012](../ADR/0012-clerical-alphabetizing-and-spelling.md) adds
`alphabetizing` and groups the retained `spelling` concept under subtopic
`clerical_operations`, subject `clerical_ability`. The general
`clerical_operations` concept remains. All are English, Subprofessional-only
Clerical items; the existing 40-item total and 12/20/8 cells do not change.
Legacy v1 modes still expect `language_accuracy` for Spelling and do not accept
Alphabetizing. Seed mode accepts the approved v2 grouping. Do not retag historical
v1 records in place. Runtime adoption must preserve historical question versions
and Spelling concept identity.

## Format version 1

All JSON files are UTF-8. Unknown fields are rejected except inside optional
external sign-off evidence. IDs start with a lowercase letter and contain only
lowercase letters, digits, underscores, and hyphens. Versions and revisions are
positive integers. A manifest contains only one version per stable record ID.
One question ID is one canonical question; changing its version never adds unique
coverage. Corpus record arrays may be split into any number of declared files.

Manifest example (synthetic layout, not a release corpus):

```json
{
  "formatVersion": 1,
  "corpusId": "synthetic-example",
  "revision": 1,
  "taxonomyId": "cse-taxonomy-2027-v1",
  "blueprintIds": ["cse-professional-2027-v1", "cse-subprofessional-2027-v1"],
  "questionFiles": ["families/f01-shared.json"],
  "referenceFiles": ["references/f01.json"],
  "assetFiles": [],
  "signOff": { "note": "Example only; no publication authority" }
}
```

The three file lists are required arrays and enumerate every record file exactly
once. Paths use forward slashes relative to the manifest directory. Absolute,
traversal, and symlink escapes are rejected. Optional `datasetChecksum` must match
the calculated SHA-256. `signOff` is external evidence, never authorization.

Question array example (synthetic content only):

```json
[
  {
    "questionId": "f01-library-opening",
    "version": 1,
    "family": 1,
    "module": "shared-core",
    "subjectId": "verbal_ability",
    "subtopicId": "reading",
    "conceptId": "reading_comprehension_test",
    "levelApplicability": ["professional", "subprofessional"],
    "language": "english",
    "difficulty": "easy",
    "stem": "Refer to the passage. On which day did the library open?",
    "choices": [
      { "choiceId": "monday", "text": "Monday" },
      { "choiceId": "tuesday", "text": "Tuesday" }
    ],
    "correctChoiceId": "monday",
    "explanation": "The passage explicitly says the library opened on Monday.",
    "provenance": {
      "kind": "synthetic",
      "author": "Quilla example",
      "assistance": "Documentation example",
      "sources": []
    },
    "reference": { "referenceId": "f01-library", "referenceVersion": 1 }
  }
]
```

All illustrated question fields are required except `reference`. `questionId`
identifies the canonical question. Its `family` is seed provenance, not an exam
assignment. It cannot count as a new unique question in another seed family, but
an eligible version may be selected in different attempts. Each module accepts only its approved subjects.
Module IDs are `shared-core`, `professional-numerical`, `analytical`, `clerical`.
Shared-core applicability is the ordered array shown above. Clerical applicability
is `["subprofessional"]`; the other two modules use `["professional"]`.
Question versions remain immutable outside this offline validator; detecting
revision conflicts with an existing deployment belongs to the future importer.

Choices require 2–6 unique IDs and normalized texts, with one existing correct ID.
Provenance requires `kind` (`original`, `licensed`, or `synthetic`), `author`,
`assistance` (use "None" if none), and `sources` (plain strings; citations/licensing
evidence, mandatory for licensed material). Human review must verify substantive
explanations, factual citations, licensing, proposed difficulty, and originality.
Synthetic content is only a fixture/example and must not become the product bank.

## Choice identity and display order

`choiceId` is a stable identity within a question version, not a displayed answer
letter. For example, a choice with ID `c` can appear as visible A in an attempt;
`correctChoiceId: "c"` still identifies that same answer. Do not rename choice IDs
to match shuffled positions. Choice IDs remain local to the exact question version.

The authored JSON array supplies source order. The planned assessment backend
generates a random permutation for each eligible newly served item, stores the
ordered choice IDs with the attempt, and serves that order to the interface.
The interface derives visible letters from positions. It must reuse the saved
order on navigation, refresh, resume, and review. Answers submit choice IDs and
the backend scores them against the immutable served question version. Correct
IDs and explanations are withheld until authorized feedback/review.

Consequently, a C-heavy distribution of stored correct IDs is not by itself a
content defect once this runtime behavior exists. It remains a serving concern
until then. Random shuffling does not promise an exactly balanced A–D distribution
in each exam, and authoring does not require ten stored keys per letter.

Prefer position-independent options. Ordered numerical options may be shuffled
when their meaning is unchanged. Options referring to other letters or relative
positions require preserved order or an editorial rewrite. Future lifecycle work
must explicitly record shuffle eligibility in immutable versions before serving;
do not add an unsupported field to this v1 JSON format. The offline validator
does not currently prove order independence or implement randomization.

See [ADR 0010](../ADR/0010-assessment-choice-order-and-scoring.md). This policy
does not resolve separate originality, difficulty, or blueprint-coverage findings.

## Shared passages, tables, and graphs

A reference requires `referenceId`, `version`, `family`, `module`, `language`,
`title`, `blocks`, and `provenance`. Family, module, and language must match every
linked question. A reference can have any nonempty ordered combination of:

```json
[
  {
    "type": "text",
    "text": "The library opened on Monday.\n\nIt serves the town."
  },
  {
    "type": "table",
    "caption": "Visitors",
    "headers": ["Day", "Count"],
    "rows": [["Monday", "20"]]
  },
  {
    "type": "image",
    "assetId": "f01-visitors",
    "caption": "Visitors by day",
    "alt": "Bar chart of visitors",
    "description": "Monday: 20 visitors. Tuesday: 30 visitors."
  }
]
```

Tables require nonempty headers and rectangular nonempty rows. Images require
caption, meaningful alt text, and a textual description sufficient for the
associated questions. Human review verifies equivalent answerability and that no
answer keys or explanations appear in learner-facing reference content.

Asset records require `assetId`, `path`, `mediaType` (`image/png` or `image/webp`),
`sha256` (lowercase hexadecimal), positive pixel `width` and `height`, and
`provenance`. The validator checks file signature, declared dimensions, extension,
and bytes against the checksum. It does not replace an image decoder or visual
review. SVG, remote assets, HTML markup, and executable content are unsupported.
Release mode rejects orphan references/assets; draft mode warns about them.

Several questions may link to one exact reference version. They may appear
separately and each must display the full reference. Do not hardcode "For items
18–20"; future rendering derives any range from actual attempt positions. A
question must not require another question's answer. References/assets never
count toward the current 1,890-unique-question seeding plan or earn scores.

## Checksums and handoff

The dataset hash is SHA-256 over canonical JSON containing `manifest`, `questions`,
`references`, and `assets`. Object keys are sorted; record arrays are sorted by
their stable IDs; block, choice, source, and manifest file-list order is preserved.
Whitespace in JSON formatting is irrelevant; content whitespace remains material.
`datasetChecksum` and `signOff` are excluded. Asset metadata includes its byte
checksum, so a legitimate asset correction changes the dataset hash. Invalid
records may still produce a diagnostic hash; only an error-free run is signable.

Review the exact dataset revision and checksum before sign-off. Normalized
duplicate candidates include stem, choices, and resolved reference blocks;
semantic duplicates, translations, and cosmetic rewrites require human review.
An unchanged draft run does not certify source accuracy or editorial quality.

Downstream import will map local images to Convex file storage and preserve
canonical question identities, immutable question/reference versions, and asset
mappings. Attempts must pin all three. Adopting a changed reference requires a new
question version. Serving queries must withhold answers/explanations until review.
See [ADR 0009](../ADR/0009-immutable-shared-question-references.md).

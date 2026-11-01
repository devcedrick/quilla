# ADR 0014: Consolidate Questions into One Authoritative File

- **Status:** Accepted; local corpus layout implemented
- **Date:** 2026-11-01
- **Decision owner:** Quilla maintainer
- **Related:** [ADR 0013](0013-seeding-families-and-pooled-exam-selection.md)

## Decision

Store all authored questions in `content/question-bank/questions.json`, an array
whose records retain canonical ID, version, seed-family provenance, taxonomy,
eligibility, and content. Maintain one `content/question-bank/manifest.json`
with format version 2, an empty source root, and exactly that one question file.
Use stable corpus ID `cse-2027`. Keep taxonomy/blueprint versions in metadata.

Move unchanged reference metadata and image files to sibling `references/` and
`assets/` directories. Remove the `cse-2027-v1` / `cse-2027-v2` directory split
and obsolete manifests after successful preservation and seed-validation checks.
There is no V2-overrides-V1 content rule, record renumbering, or new question
version caused by relocation. Future seed families join the same question file.

## Evidence and boundaries

Family 01 seed validation passed before and after consolidation with 270 questions,
33 references, nine images, and zero errors/warnings. Record-preservation hashes
and all nine image-byte hashes are checked across relocation. Inventory metadata
changes legitimately produce a new dataset checksum; old ledger hashes remain
historical, not current file checksums.

The updated seed validator supports an empty source root without changes to its
validation logic. Legacy draft/release modes remain available for historical
fixtures, but the removed on-disk manifests are no longer current commands.
Regression tests enforce one question file, stable Family 01 record content, and
absence of the version-named directories. This does not implement pooled runtime
selection, publish questions, deploy, or change historical served attempts.

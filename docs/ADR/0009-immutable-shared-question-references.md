# ADR 0009: Immutable shared question references

- Status: Accepted
- Date: 2026-10-30
- Related issue: #88 (S19.1), parent #83 (E19)

## Context

Several questions may depend on one passage, table, graph, or diagram. Copying it
into every question encourages inconsistent corrections and cannot establish which
content an historical attempt displayed. The maintainer approved independent
placement of questions sharing a reference.

## Decision

Store shared content as a separately identified, immutable reference version.
Each question version links to one exact reference version, optionally containing
multiple ordered text, table, and image blocks. V1 references belong to one family
and module; shared-core references may serve both level variants of that family.
Each question retains its own classification, answer, explanation, and score.

Questions may be selected or shuffled independently. Every selected question must
bring its complete reference, without bringing other questions or their scores.
Use neutral directions rather than fixed item numbers. A renderer may display an
item range only when the actual attempt positions support it. Each question must
be answerable from its reference without another question's answer; human review
checks this editorial property.

Reference changes create new versions. Adopting a different reference version
creates a new question version. Future attempts preserve exact question versions,
reference versions, and asset checksums. Storage and import must retain prior
assets for historical attempts. Future Convex import maps local assets to file
storage, and stores canonical questions, question versions, reference versions,
and asset mappings separately. Serving queries exclude keys and explanations
until authorized review. JSON sign-off metadata never grants publication rights.

## Consequences and alternatives

References are counted once as authored reference content, never as scored items
or additional canonical questions. They require provenance, accessibility content,
asset integrity checks, and immutable snapshots. S19.1 establishes the offline
contract only; lifecycle, import, rendering, and storage remain downstream work.

Duplicating passages in each question was rejected because corrections diverge.
Resolving the latest reference was rejected because it rewrites history.
Mandatory contiguous question groups were rejected in favor of independently
placed questions with the reference present for each one.

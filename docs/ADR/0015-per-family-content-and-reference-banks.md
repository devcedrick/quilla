# ADR 0015: Store Independent Question Banks per Seeding Family

- **Status:** Accepted; local layout implemented
- **Date:** 2026-11-01
- **Decision owner:** Quilla maintainer
- **Supersedes:** ADR 0014's global single-question-file and single-manifest layout
- **Retains:** ADR 0013's seed-family allocation and cross-family exam selection

## Decision

The maintainer clarified that each seeding family needs its own self-contained
folder, manifest, topic question files, and shared references. The global
`questions.json` layout was an incorrect interpretation of the intended storage
structure. Do not append later families to one global question file.

Use `content/question-bank/family-01/`, `family-02/`, and so on. Each contains:

- `manifest.json`: that family's independent format-2 seed inventory, revision,
  checksum, taxonomy and blueprint metadata, and its sole `seedFamilies` entry.
- `content/`: separate question arrays by topic, language, or authored batch.
- `references/`: shared passages, tables, charts and other reference records,
  image metadata, and original image files under `references/assets/`.

Family 01 contains 17 content files, 33 references, and nine images for its 270
questions. It uses corpus ID `cse-2027-family01`, `seedFamilies: [1]`, one empty-root
source, and family-relative paths. Future families have separate corpus identities
and manifests; taxonomy/blueprint versions remain metadata, not content folders.
The question-bank root is an index README and family directories, not a second
authoritative manifest or merged question file.

## Preservation and validation

Question IDs, versions, answers, explanations, and provenance are unchanged.
Shared reference records and all PNG bytes are unchanged. Asset metadata changes
only its relative path from `assets/...` to `references/assets/...`; this and
manifest inventory changes legitimately change the dataset checksum without
requiring new question versions.

Seed validation scans `content/` for undeclared JSON as well as the legacy
`families/` and reference directories. Tests reject unlisted content, enforce the
independent family layout, and preserve the Family 01 question fingerprint.

Disk separation does not constrain mock selection to one family. Future serving
loads eligible published questions across family banks under ADR 0013's pooled
blueprints. This change neither implements that runtime nor publishes or deploys
anything. Earlier layout decisions and checksums remain historical records.

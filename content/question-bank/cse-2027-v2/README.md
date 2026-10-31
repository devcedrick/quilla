# Taxonomy v2 staging — not an activated corpus

This directory holds original draft content for the approved taxonomy v2 changes
in [ADR 0011](../../../docs/ADR/0011-numerical-data-sufficiency.md) and
[ADR 0012](../../../docs/ADR/0012-clerical-alphabetizing-and-spelling.md). It is not a
complete corpus or an import manifest. Do not serve or publish these records.

`families/f01-data-sufficiency.json` contains twenty Family 01 Data Sufficiency
items, each with its own statements, five full-text choices, stable semantic choice
IDs, and explanation. All are shared-core eligible for both levels. These form a
candidate bank, not twenty additional slots in an exam. Selecting a final subset
must preserve the 35-item shared Numerical total and its 10/18/7 difficulty cells.
The existing Numerical Reasoning drafts are not replaced or retagged here.

`families/f01-spelling.json` contains ten original Family 01 Spelling items:
three easy, five medium, and two hard. All are English, Subprofessional-only
Clerical items, with `spelling` grouped under `clerical_operations` as approved
for v2. The [Spelling ledger](../../../docs/content/spelling-family01-ledger.md)
records source checks, answer keys, difficulty rationale, and adoption limits.
These candidates do not change the 40-item Clerical total or its 12/20/8 cells.

`families/f01-alphabetizing.json` contains ten Family 01 Alphabetizing items:
three easy, five medium, and two hard. Each has its own records to sort, explicit
filing rules, four sequence choices, and explanation. All are English,
Subprofessional-only Clerical items. See the
[Alphabetizing ledger](../../../docs/content/alphabetizing-family01-ledger.md)
for sorting conventions and verified orders. This candidate pool does not change
the 40-item Clerical total or set a permanent per-concept allocation.

The current v1 manifest and offline validator remain unchanged. A successful v1
validation does not validate these staged records. V2 policy support, tests,
versioned manifest/blueprints, complete family selection, and human sign-off are
required before release. See the [item ledger](../../../docs/content/data-sufficiency-family01-ledger.md)
for skill coverage, difficulty rationale, and review checks.

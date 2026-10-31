# Final authored seed content — integration pending

This directory holds authored seed content for the approved taxonomy v2 changes
in [ADR 0011](../../../docs/ADR/0011-numerical-data-sufficiency.md) and
[ADR 0012](../../../docs/ADR/0012-clerical-alphabetizing-and-spelling.md). It is not a
complete corpus or an import manifest. Do not serve or publish these records.

[ADR 0013](../../../docs/ADR/0013-seeding-families-and-pooled-exam-selection.md)
separates final authored status from technical integration. Family 01 is complete
for seeding: 270 questions across this directory and the v1 corpus. Each of the
eight planned families has 40 General, 50 Verbal, 60 Numerical, 80 Analytical,
and 40 Clerical items (2,160 unique questions overall). These are authoring counts,
not exam quotas. Exams select eligible published versions from all families
combined under their own blueprint. See the
[seeding policy](../../../docs/content/seeding-families.md). Folder names and
legacy ledger terms do not make completed seed content unfinished.

`families/f01-data-sufficiency.json` contains twenty Family 01 Data Sufficiency
items, each with its own statements, five full-text choices, stable semantic choice
IDs, and explanation. All are shared-core eligible for both levels. These form a
seed bank, not twenty additional slots in an exam. Selecting an exam subset from all families
must preserve the 35-item shared Numerical total and its 10/18/7 difficulty cells.
The existing Numerical Reasoning seed items are not replaced or retagged here.

`families/f01-spelling.json` contains ten original Family 01 Spelling items:
three easy, five medium, and two hard. All are English, Subprofessional-only
Clerical items, with `spelling` grouped under `clerical_operations` as approved
for v2. The [Spelling ledger](../../../docs/content/spelling-family01-ledger.md)
records source checks, answer keys, difficulty rationale, and adoption limits.
These seed items do not change the 40-item Clerical exam total or its 12/20/8 cells.

`families/f01-alphabetizing.json` contains ten Family 01 Alphabetizing items:
three easy, five medium, and two hard. Each has its own records to sort, explicit
filing rules, four sequence choices, and explanation. All are English,
Subprofessional-only Clerical items. See the
[Alphabetizing ledger](../../../docs/content/alphabetizing-family01-ledger.md)
for sorting conventions and verified orders. This seed pool does not change
the 40-item Clerical total or set a permanent per-concept allocation.

`families/f01-philippine-constitution.json` contains forty original Family 01
Constitution questions: twelve easy, twenty medium, and eight hard. All are
English shared-core items eligible for both levels, using the existing General
Information concept. Each cites the 1987 Constitution by article and section.
See the [Constitution ledger](../../../docs/content/philippine-constitution-family01-ledger.md)
for keys, source review, and legal-scope limits. These are a selection pool, not
forty exam slots: General Information remains 20 items with 6/10/4 difficulty cells.

The current v1 manifest and offline validator remain unchanged. A successful v1
validation does not validate these staged records. V2 policy support, tests,
versioned metadata and pooled v3 exam checks, publication gates, and required
sign-off evidence are needed before serving. They are separate from completed
seed authorship. See the [item ledger](../../../docs/content/data-sufficiency-family01-ledger.md)
for skill coverage, difficulty rationale, and review checks.

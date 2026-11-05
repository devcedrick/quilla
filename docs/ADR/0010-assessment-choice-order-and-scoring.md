# ADR 0010: Assessment choice order and stable-ID scoring

- Status: Accepted
- Date: 2026-10-31
- Related issues: E19 / #83, S19.2 / #90; question lifecycle / #32

## Context

The initial Family 01 Graphs drafts have correct keys concentrated on stored ID
`c`. The maintainer chose per-attempt choice shuffling rather than reordering the
authored JSON solely to balance answer letters. Assessment runtime is still
planned. Refreshes and historical review must not reinterpret existing answers.

## Decision

Choice IDs identify content within immutable question versions. Display letters
derive from the saved position in an attempt, independently of ID spelling.
When a question is first served, the backend creates an unbiased permutation of
eligible choice IDs and persists it as part of the served item snapshot. Adaptive
sessions do this incrementally for new items. The interface renders the saved
order without reshuffling it on refresh, navigation, resume, or review.

Learners submit stable choice IDs. The backend validates ownership and served
choice membership, and scores against the exact served question version. It
never trusts client-provided answer letters, indices, correctness flags, or
permutations as scoring authority. Active responses do not expose correct choice
IDs, keys, or explanations before authorized feedback/review. A persisted display
order does not require sharing the answer key with the client.

Future immutable question versions must explicitly represent validated shuffle
eligibility. Order-dependent options preserve authored order unless rewritten.
Do not infer eligibility solely by matching phrases or assume a new field exists
in the initial offline corpus format; lifecycle and storage implementation must
introduce the contract and its validation together.

Randomization eliminates a deterministic association between authored keys and
visible letters. It does not guarantee equal answer-letter frequencies in each
attempt. Exact balancing is not required. Authoring fixes for unrelated errors,
semantic duplicates, weak difficulty, or missing coverage remain necessary.

## Alternatives and consequences

Balancing the source JSON was rejected as the primary remedy because it cannot
prevent fixed-position learning across repeated attempts. Shuffling on every UI
render was rejected because it changes answer-letter mappings during an attempt.
Sending the key to the client was rejected because display does not require it.

Attempt snapshots must retain ordered choice IDs alongside question versions.
Historical snapshots must not be rewritten. This ADR changes documentation only;
no schema, API, deployment, question content, or assessment implementation changes.
All future assessment generators and review interfaces must follow this contract.

## Verification contract

Use deterministic permutations in tests to verify correct and incorrect scoring
after reordering, unique complete permutations, preservation across resume and
review, ordered-option exemptions, rejection of foreign/nonexistent choice IDs,
and answer-key exclusion before authorized review. Do not assert exact balance
for a randomly generated small sample or treat a stored key histogram as proof
that runtime shuffling is implemented.

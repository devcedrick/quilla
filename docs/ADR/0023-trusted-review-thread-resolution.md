# ADR 0023: Trusted Review-Thread Resolution Workflow

- **Status:** Accepted implementation; push trigger superseded by ADR 0024
- **Date:** 2026-11-14
- **Decision owner:** Quilla maintainer
- **Related:** PR #105; `.github/OPENCODE.md`

> **Superseded trigger:** ADR 0024 replaced the `pull_request_target` push
> trigger with `pull_request` and a branch-head runner for push reviews. The
> resolver permission boundary in this ADR remains in force.

## Context

The `OpenCode review` workflow posts inline review comments on same-repository
pull requests. On a new push it should resolve the bot's earlier review threads
and leave the fresh review's threads open.

GitHub's GraphQL `resolveReviewThread` mutation rejects an installation token
that has only Pull requests: write. The token must also have Contents: write.
That permission is broader than the review job should hold: the review job
sends PR content to a model, runs the model in a PR-head worktree and executes
on a runner whose job token can already comment on issues and pull requests.
Granting it Contents: write would let any code path in that job modify
repository contents.

## Decision

Split the operation across two workflows with different permissions.

1. `OpenCode review` keeps `contents: read`, `pull-requests: write` and
   `issues: write`. On a `pull_request_target` `synchronize` event it lists the
   bot's unresolved review threads before posting the fresh review, then writes
   the candidate thread ids to a small artifact after the review posts
   successfully. It never calls the resolution mutation.
2. `OpenCode resolve threads` is a separate `workflow_run` workflow with
   `contents: write`, `pull-requests: write` and `actions: read`. It runs only
   after a successful `pull_request_target` review run, is loaded from and
   checks out the default branch, downloads the artifact, and executes the
   default-branch runner in `resolve` mode.
3. The resolver treats the artifact as a candidate list, not authority. It
   re-lists live review threads, keeps only captured ids that are still
   unresolved and rooted in a marked bot review, and never resolves a
   human-rooted thread or another app's review. Resolution failures fail the
   resolver workflow; they do not discard the posted review.

The review job captures ids before posting, so the fresh review's own threads
are excluded by construction. If the review fails or is skipped, no capture
artifact is produced and the resolver does nothing.

## Consequences

- The job that handles PR content still has no repository contents write
  permission. The contents-write token exists only in a job that never checks
  out or executes PR code.
- The resolver runs from the default branch, so the change takes effect only
  after it is merged. The artifact is retained for one day and is tied to the
  triggering run id.
- No PAT, GitHub App installation or additional secret is required. The
  resolver uses the built-in workflow token and its job-scoped permissions.
- The resolver adds a second workflow run per successful push review and
  performs an extra thread-list query before resolving. Cleanup is no longer
  best-effort inside the review job; a failed resolver is visible as a separate
  red workflow while the review remains posted.
- A same-repository write collaborator can still propose changes to the review
  workflow, but `pull_request_target` executes the default-branch version, and
  that workflow never receives contents write. Protected-branch review remains
  the control for changes to the resolver.

## Alternatives rejected

- **Add `contents: write` to `OpenCode review`:** simplest, but grants a
  repository-wide write token to the job that renders PR content and runs the
  model, weakening the existing least-privilege boundary.
- **Store a fine-grained PAT with Contents write:** avoids changing the
  workflow token but introduces a long-lived credential to rotate and would
  still expose it to the review job if used there.
- **Resolve by a run-start timestamp:** avoids the artifact, but a skipped or
  head-changed review still completes successfully and would resolve old
  threads without posting a fresh review. The capture artifact is an explicit
  success signal.
- **Abandon auto-resolution:** leaves stale findings open after every push and
  preserves the current manual cleanup burden.

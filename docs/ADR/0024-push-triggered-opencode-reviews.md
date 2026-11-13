# ADR 0024: Push-Triggered OpenCode Reviews

- **Status:** Accepted implementation
- **Date:** 2026-11-14
- **Decision owner:** Quilla maintainer
- **Related:** PR #105; `.github/OPENCODE.md`; ADR 0023

## Context

The review workflow must run on every new push. Commit 6541581 moved the push
trigger to `pull_request_target` and checked out the default branch to run the
custom runner. GitHub loads `pull_request_target` only from the default branch,
and `scripts/opencode-github-review.mjs` did not exist on the default branch.
The result was that pushes produced no OpenCode run at all: the branch workflow
declared `pull_request_target` only, and the default branch declared
`pull_request` only. Restoring the behavior requires a trigger that GitHub
accepts from the PR's merge ref.

## Decision

Use `pull_request` for push-triggered reviews. For `pull_request` events, check
out the PR head and execute the branch runner so runner changes are testable
before merge. For `pull_request_review_comment` and `issue_comment` events, load
the workflow from the default branch and check out the default branch runner.
Keep the review job at `contents: read`, `pull-requests: write` and
`issues: write`. The separate resolver from ADR 0023 remains the only
contents-write job, runs default-branch code, and now accepts successful
`pull_request` review runs.

## Consequences

- Every new push to a same-repository, non-draft PR triggers a review now and
  after merge.
- The workflow YAML and runner executed for push reviews are PR-controlled for
  same-repository PRs, and `OPENCODE_API_KEY` is available to those runs. This
  matches the default branch's pre-existing `pull_request` posture. Fork PRs,
  draft PRs and requesters without write access are rejected before the model
  runs.
- The contents-write boundary from ADR 0023 is unchanged: the review job still
  cannot modify repository contents, and the resolver remains default-branch
  code.
- Conversation events still use the default-branch workflow and runner. Their
  changes activate only after merge, as before.
- If stronger workflow-definition isolation is needed later, push events can be
  migrated to `pull_request_target` once the runner is on the default branch.

## Alternatives rejected

- **Keep `pull_request_target` only:** no push reviews until the workflow is on
  the default branch, because GitHub does not load the trigger from a PR branch.
- **Add `pull_request` only as a temporary bootstrap:** would require a cleanup
  commit before merge and would stop reviews between that commit and merge;
  maintaining two trigger modes adds a failure mode without a lasting benefit.
- **Grant `contents: write` to the review job:** does not fix the trigger and
  weakens the permission boundary.

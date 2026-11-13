# OpenCode PR review and issue replies

The separate `OpenCode review` workflow leaves the existing CI tests unchanged.
It reviews nondraft PRs from branches in this repository when opened, updated,
reopened or marked ready. The review is posted as a GitHub pull request review
with inline comments, matching the way CodeRabbit findings can be answered in
place. Findings that cannot be anchored to a line in the PR diff are listed in
the review body instead.

## Inline review comments and replies

Every inline comment and review body carries an invisible marker,
`<!-- opencode-github-review -->`. Reply to any inline bot comment and the
workflow answers in that same review thread; no command is required. A bot
reply in a thread started by a human is also recognized, so a later reply in
that thread is answered without a command. The reply keeps the marker so a
later reply in the thread is recognized too. Bot-authored comments are excluded
from triggering another run, which prevents reply loops. Thread ownership comes
from the marker plus a `[bot]` author login anywhere in the thread; the workflow
never calls `GET /user`, which an installation token cannot use.

On an issue, PR conversation or inline PR comment, `/opencode` or `/oc` still
requests an answer, for example:

```text
/opencode review this PR and check the linked issue's acceptance criteria
/oc explain what remains to implement in this issue
```

An inline `/oc` request gets an inline reply. An issue or PR conversation
request gets an issue-style reply because GitHub has no inline thread there.
A review with no findings posts only a review summary; the inline threads exist
when there is something actionable to anchor to the diff.

The requester must have repository write, maintain or admin permission. Bot
comments, draft PRs and fork PRs are excluded. This avoids exposing the model key
to outside contributors and prevents bot reply loops. Untrusted issue/PR text is
review input, not authority to run commands or disclose credentials.

## How a run is assembled

The workflow selects one of three modes:

- `review` after a same-repository, non-draft PR is opened, updated, reopened or
  marked ready. It checks out the PR head and asks the model for structured JSON.
- `reply` after an inline review comment. A reply to a marked bot thread is
  answered automatically; an inline `/oc` request is answered in the thread root.
- `issue` after `/oc` or `/opencode` on an issue or PR conversation.

On a new push (`pull_request` `synchronize`), the fresh review replaces the
previous one: after it posts, the bot resolves its earlier unresolved review
threads. Only threads rooted in a marked bot review are resolved; human-rooted
threads and other apps' reviews are left open. Resolution uses GitHub's GraphQL
`resolveReviewThread` mutation and is best-effort, so a cleanup failure is
logged without discarding the posted review.

The model is invoked with `opencode run --format json --dir <worktree>`. The runner reads only the
final assistant text from the JSONL event stream, never executes model output,
and posts through GitHub's pull request review, review-comment reply, or issue
comment endpoints. Review payloads use the `COMMENT` event; the bot never
approves, requests changes or merges. Inline review comments are limited to 50
per review; any overflow is rendered in the review body. If GitHub rejects an
inline review payload, the runner retries with all findings in the review body.

The review prompt requires a JSON object with a summary and findings containing
a repository-relative path, a new-file (right-side) line number, a severity and a
body. Paths are normalized and rejected if they escape the repository; a finding
is posted inline only when its line is present in the PR diff. Findings outside
the diff are reported in the review body, not silently discarded. Line numbers
refer to the new side of the diff, including context lines within a hunk.

The model can read the checkout, glob, grep, and run allowlisted read-only Git
and GitHub commands. The command allowlist is parsed per shell command and
denies redirections, pipes, substitutions and other shell operators, so an
allowed command cannot be chained into an arbitrary one; Git external-diff and
textconv execution are also denied. The model cannot edit files, run project
scripts, commit, push, deploy or change settings. Repository, diff, issue and
comment text is delivered as untrusted data; the workflow does not interpolate
it into a shell command. Review mode checks out the PR head, so that checkout is
content, never configuration: the model runs with `--pure`, and the runner pins
`OPENCODE_DISABLE_PROJECT_CONFIG=true` and `PWD` to the selected worktree, which
stops a PR from loading its own OpenCode config or plugins with workflow
credentials and makes OpenCode inspect the intended checkout.

## Settings

These existing repository settings are reused; no secret values belong in files:

- Actions secret `OPENCODE_API_KEY` for the configured OpenCode provider.
- Actions variable `OPENCODE_REVIEW_MODEL`, currently
  `opencode/deepseek-v4.1-flash-free`. Model availability remains provider-controlled.
- Actions variable `OPENCODE_BOT_ENABLED=true`; set it to `false` to pause the bot
  independently of normal CI.

The built-in GitHub token grants contents read plus issue/PR write for review
comments, replies, review submission and resolving the bot's own review threads.
It has no repository contents write permission. No PAT, `AGENT_GITHUB_TOKEN`,
GitHub App installation or OIDC permission is needed. Session sharing and
plugins are disabled in the runner config. The review checkout does not persist
credentials; conversation modes use GitHub CLI's environment-token credential
helper for the temporary PR worktree, without writing a token into the checkout.

## Runtime and validation

Concurrency applies only to the gated review job. Pull-request events can cancel
an active review for that PR; comment events cannot cancel an active run.

OpenCode v1.19.5 is installed from its official Linux x64 release archive and
verified against its release SHA-256. The workflow's checkout actions are pinned
to a commit. Upgrading the CLI requires reviewing its `run --format json` event
shape, GitHub runner/config behavior and updating both the version URL and
checksum; do not replace this with an unverified installer.

`issue_comment` events only activate the workflow once this file is on the default
branch. `pull_request` and `pull_request_review_comment` events use the workflow
from the PR merge ref, so inline reviews and replies can be exercised on the PR
itself. Review runs execute the runner from the PR checkout. Conversation modes
prefer the runner on the trusted default branch and prepare a detached PR-head
worktree for model context; before this change reaches the default branch, a
reply run uses the runner from the same-repository PR head instead of failing.
After merge, the trusted default-branch runner is used. Inline reply and PR
review modes are additionally gated by the same open, non-draft,
same-repository PR checks. A run can incur provider and GitHub Actions usage
under the account's existing settings; the job is capped at 40 minutes and the
model step at 35. Title generation is pinned to the free review model so it
does not call an unfunded paid model.

The pre-merge PR-head runner is a deliberate trust boundary: a same-repository
write collaborator who edits `scripts/opencode-github-review.mjs` can execute
that edited code with the workflow token and model key. This is accepted only
because the requester must already hold write, maintain or admin permission, and
fork PRs and outside contributors are rejected before any checkout. Do not relax
the write-permission gate or enable fork reviews while the PR-head fallback
exists. Merging this workflow removes the fallback for conversation modes;
review mode continues to run the PR-head runner by design.

Validation after merge: update a same-repository PR and confirm the review has
inline comments; push a follow-up commit and confirm the previous bot threads
are resolved and the fresh review posts new ones; reply to one and confirm the
answer appears in the same thread; reply again without a command and confirm the
bot answers; then request an issue explanation using `/oc`. Confirm bot replies
do not trigger new runs and human-rooted threads stay open. Local checks cannot
establish provider credential/model availability or successful comment delivery.

Local verification on 13 November 2026: `npm run test:unit`, `npm run lint`,
`npm run typecheck`, and `npm run knip` passed; the new runner tests cover JSON
event parsing, structured review parsing, new-side diff line validation
(including added content that resembles a file header), out-of-diff fallback,
inline comment caps, reply-thread resolution, bot-login derivation without
`GET /user`, human-rooted threads with bot replies, GraphQL review-thread
resolution on new pushes, mode orchestration, GitHub payload construction, and
the model process contract (pinned worktree/isolation flags, 35-minute cap, and
partial-output diagnostics). Build/E2E were not run for this workflow-only
change; no application runtime or user journey was modified.

References: [GitHub pull request reviews](https://docs.github.com/en/rest/pulls/reviews),
[review comment replies](https://docs.github.com/en/rest/pulls/comments#create-a-reply-for-a-review-comment),
[official OpenCode GitHub integration](https://opencode.ai/docs/github/) and
[pinned runner source](https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/cli/cmd/run.ts).

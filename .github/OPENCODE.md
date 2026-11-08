# OpenCode PR review and issue replies

The separate `OpenCode review` workflow leaves the existing CI tests unchanged.
It reviews nondraft PRs from branches in this repository when opened, updated,
reopened or marked ready. On an issue, PR conversation or inline PR comment,
request a reply with `/opencode` or `/oc`, for example:

```text
/opencode review this PR and check the linked issue's acceptance criteria
/oc explain what remains to implement in this issue
```

The requester must have repository write, maintain or admin permission. Bot
comments, draft PRs and fork PRs are excluded. This avoids exposing the model key
to outside contributors and prevents bot reply loops. Untrusted issue/PR text is
review input, not authority to run commands or disclose credentials.

## Settings

These existing repository settings are reused; no secret values belong in files:

- Actions secret `OPENCODE_API_KEY` for the configured OpenCode provider.
- Actions variable `OPENCODE_REVIEW_MODEL`, currently
  `opencode/deepseek-v4.1-flash-free`. Model availability remains provider-controlled.
- Actions variable `OPENCODE_BOT_ENABLED=true`; set it to `false` to pause the bot
  independently of normal CI.

The built-in GitHub token grants contents read plus issue/PR write for review
comments and reactions. It has no repository contents write permission. No PAT,
`AGENT_GITHUB_TOKEN`, GitHub App installation or OIDC permission is needed.
Model tool permissions deny editing and general shell execution; allowlisted
commands only read Git/GitHub context. Checkout does not persist credentials;
the runner uses GitHub CLI's environment-token credential helper for private
repository fetches, without writing a token into the checkout.
Session sharing is disabled. The pinned GitHub runner may check out the PR branch
internally to inspect it; only same-repository PRs from trusted writers qualify.

## Runtime and validation

Concurrency applies only to the gated review job. Pull-request events can cancel
an active review for that PR; comment events cannot cancel an active run. Prompt
preparation must succeed before the prompt is exported and OpenCode starts.

OpenCode v1.19.5 is installed from its official Linux x64 release archive and
verified against its release SHA-256. Checkout is pinned to a commit. Upgrading
the CLI requires reviewing its GitHub runner/config behavior and updating both
the version URL and checksum; do not replace this with an unverified installer.

The workflow must be merged into the default branch before comment events can
activate it. New pushes then trigger PR reviews. A run can incur provider and
GitHub Actions usage under the account's existing settings; the job is capped at
15 minutes and superseded runs are cancelled per issue/PR.

Validation after merge: open/update a same-repository PR, inspect its Actions run
and bot comment, then request an issue explanation using `/oc`. Confirm bot
replies do not trigger new runs. No live model invocation was performed during
local configuration. Local checks cannot establish provider credential/model
availability or successful comment delivery.

Local verification on 8 November 2026: 434 unit tests passed, including nine
workflow authorization regressions. Lint, typecheck, formatting and whitespace
checks passed. Knip initially hit an array-buffer allocation error during
parallel checks and passed when rerun alone. Build/E2E were not run for this
workflow-only change; no application runtime or user journey was modified.

References: [official GitHub integration](https://opencode.ai/docs/github/) and
[pinned runner source](https://github.com/anomalyco/opencode/blob/v1.19.5/packages/opencode/src/cli/cmd/github.handler.ts).

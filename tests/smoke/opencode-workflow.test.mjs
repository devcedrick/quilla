import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/opencode.yaml", "utf8");
const authorization = workflow.match(
  /node <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/,
);
if (!authorization) throw new Error("OpenCode authorization script not found");

const sameRepoPR = {
  number: 102,
  state: "open",
  draft: false,
  head: { repo: { full_name: "devcedrick/quilla" } },
};
const botComment = {
  id: 700,
  in_reply_to_id: null,
  user: { login: "github-actions[bot]" },
  body: "<!-- opencode-github-review -->\n\nA finding",
};

function inferEventName(event) {
  if (event.comment?.path) return "pull_request_review_comment";
  if (event.issue) return "issue_comment";
  return "pull_request_target";
}

/** Execute the extracted authorization guard with bounded, synthetic GitHub responses. */
function authorize(permission, event, options = {}) {
  let output = "";
  const calls = [];
  const eventName = options.eventName ?? inferEventName(event);
  const pr = options.pr ?? sameRepoPR;
  const comments = options.comments ?? {};
  runInNewContext(authorization[1], {
    process: {
      env: {
        GITHUB_EVENT_PATH: "event.json",
        GITHUB_REPOSITORY: "devcedrick/quilla",
        GITHUB_ACTOR: "maintainer",
        GITHUB_EVENT_NAME: eventName,
        GITHUB_OUTPUT: "output",
      },
    },
    console: { log() {} },
    require(name) {
      if (name === "node:fs")
        return {
          readFileSync: () => JSON.stringify(event),
          appendFileSync: (_path, text) => {
            output += text;
          },
        };
      if (name === "node:child_process")
        return {
          execFileSync(command, args) {
            calls.push([command, ...args]);
            const path = args[1];
            if (path.endsWith("/permission"))
              return JSON.stringify({ permission });
            if (path.includes("/pulls/comments/")) {
              const id = Number(path.split("/").pop());
              return JSON.stringify(comments[id] ?? null);
            }
            if (path.includes("/pulls/") && path.includes("/comments"))
              return JSON.stringify([options.threadComments ?? []]);
            if (path.includes("/pulls/")) return JSON.stringify(pr);
            throw new Error(`Unexpected API path: ${path}`);
          },
        };
      throw new Error("Unexpected module");
    },
  });
  expect(
    calls.every(([command, method]) => command === "gh" && method === "api"),
  ).toBe(true);
  const outputs = Object.fromEntries(
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
  return { allowed: outputs.allowed === "true", outputs, calls };
}

const issueComment = {
  issue: { number: 95 },
  comment: { body: "/oc explain this issue" },
};
const conversationComment = {
  issue: { number: 102, pull_request: { url: "api" } },
  comment: { body: "/oc review this PR" },
};
const inlineRequest = {
  pull_request: { number: 102 },
  comment: {
    id: 701,
    in_reply_to_id: null,
    user: { login: "maintainer" },
    body: "/oc check this line",
    path: "src/example.ts",
    line: 2,
  },
};
const inlineReply = {
  pull_request: { number: 102 },
  comment: {
    id: 702,
    in_reply_to_id: 700,
    user: { login: "maintainer" },
    body: "Why is this wrong?",
    path: "src/example.ts",
    line: 2,
  },
};

describe("OpenCode workflow authorization", () => {
  it("scopes concurrency to the gated job and lets only PR events cancel active runs", () => {
    expect(workflow).not.toMatch(/^concurrency:/m);
    expect(workflow).toMatch(
      /\n    concurrency:\r?\n      group: opencode-\$\{\{ github\.event\.pull_request\.number \|\| github\.event\.issue\.number \}\}/,
    );
    const cancellation = workflow.match(
      /cancel-in-progress: \$\{\{ (.*?) \}\}/,
    )?.[1];
    expect(cancellation).toBe("github.event_name == 'pull_request_target'");
    for (const eventName of [
      "pull_request_target",
      "issue_comment",
      "pull_request_review_comment",
    ])
      expect(
        runInNewContext(cancellation, { github: { event_name: eventName } }),
      ).toBe(eventName === "pull_request_target");
    expect(authorize("read", issueComment).allowed).toBe(false);
  });

  it.each(["admin", "maintain", "write"])(
    "allows %s requesters to ask about an issue",
    (permission) => {
      expect(authorize(permission, issueComment)).toMatchObject({
        allowed: true,
        outputs: { mode: "issue", pr: "", target: "95" },
      });
    },
  );

  it.each(["read", "triage", "none"])("refuses %s requesters", (permission) => {
    expect(authorize(permission, issueComment)).toMatchObject({
      allowed: false,
      outputs: { mode: "", pr: "", target: "" },
    });
  });

  it("does not match an unrelated slash word as a bot request", () => {
    expect(
      authorize("write", { ...issueComment, comment: { body: "/octopus" } })
        .allowed,
    ).toBe(false);
    expect(
      authorize("write", {
        ...issueComment,
        comment: { body: "Please /OPENCODE explain" },
      }).allowed,
    ).toBe(true);
  });

  it("authorizes PR reviews only for open, non-draft, same-repository PRs", () => {
    const event = { pull_request: { number: 102 } };
    expect(
      authorize("write", event, { eventName: "pull_request_target" }),
    ).toMatchObject({
      allowed: true,
      outputs: { mode: "review", pr: "102", target: "102" },
    });
    expect(
      authorize("write", event, {
        eventName: "pull_request_target",
        pr: { ...sameRepoPR, head: { repo: { full_name: "outsider/fork" } } },
      }).allowed,
    ).toBe(false);
    expect(
      authorize("write", event, {
        eventName: "pull_request_target",
        pr: { ...sameRepoPR, draft: true },
      }).allowed,
    ).toBe(false);
    expect(
      authorize("write", event, {
        eventName: "pull_request_target",
        pr: { ...sameRepoPR, state: "closed" },
      }).allowed,
    ).toBe(false);
  });

  it("applies the same PR origin checks to issue conversation comments", () => {
    expect(
      authorize("write", conversationComment, {
        eventName: "issue_comment",
      }),
    ).toMatchObject({ allowed: true, outputs: { mode: "issue", pr: "102" } });
    expect(
      authorize("write", conversationComment, {
        eventName: "issue_comment",
        pr: { ...sameRepoPR, draft: true },
      }).allowed,
    ).toBe(false);
  });

  it("auto-replies only to bot review threads or explicit inline requests", () => {
    const thread = authorize("write", inlineReply, {
      eventName: "pull_request_review_comment",
      comments: { 700: botComment },
    });
    expect(thread).toMatchObject({
      allowed: true,
      outputs: {
        mode: "reply",
        pr: "102",
        target: "700",
        bot_login: "github-actions[bot]",
      },
    });
    expect(thread.calls.map(([, , path]) => path)).not.toContain("user");

    expect(
      authorize("write", inlineRequest, {
        eventName: "pull_request_review_comment",
        comments: {},
      }),
    ).toMatchObject({
      allowed: true,
      outputs: { mode: "reply", target: "701" },
    });

    const userRoot = {
      id: 800,
      in_reply_to_id: null,
      user: { login: "maintainer" },
      body: "A normal inline comment",
    };
    expect(
      authorize(
        "write",
        {
          ...inlineReply,
          comment: { ...inlineReply.comment, in_reply_to_id: 800 },
        },
        {
          eventName: "pull_request_review_comment",
          comments: { 800: userRoot },
        },
      ).allowed,
    ).toBe(false);
  });

  it("derives the bot login from the marker-bearing ancestor without /user", () => {
    const appBot = { ...botComment, user: { login: "quilla-reviewer[bot]" } };
    const result = authorize("write", inlineReply, {
      eventName: "pull_request_review_comment",
      comments: { 700: appBot },
    });
    expect(result).toMatchObject({
      allowed: true,
      outputs: { bot_login: "quilla-reviewer[bot]" },
    });
    expect(result.calls.map(([, , path]) => path)).not.toContain("user");
  });

  it("does not trust a marker copied by a non-bot author", () => {
    const forged = {
      ...botComment,
      id: 900,
      user: { login: "maintainer" },
    };
    expect(
      authorize(
        "write",
        {
          ...inlineReply,
          comment: { ...inlineReply.comment, in_reply_to_id: 900 },
        },
        {
          eventName: "pull_request_review_comment",
          comments: { 900: forged },
        },
      ).allowed,
    ).toBe(false);
  });

  it("recognizes a bot reply in a human-rooted thread", () => {
    const humanRoot = {
      id: 800,
      in_reply_to_id: null,
      user: { login: "maintainer" },
      body: "A human comment",
    };
    const botReply = {
      id: 801,
      in_reply_to_id: 800,
      user: { login: "github-actions[bot]" },
      body: `<!-- opencode-github-review -->\n\nA bot reply`,
    };
    const followUp = {
      ...inlineReply.comment,
      id: 802,
      in_reply_to_id: 800,
      body: "A later reply without a command",
    };
    expect(
      authorize(
        "write",
        { ...inlineReply, comment: followUp },
        {
          eventName: "pull_request_review_comment",
          comments: { 800: humanRoot },
          threadComments: [humanRoot, botReply, followUp],
        },
      ),
    ).toMatchObject({
      allowed: true,
      outputs: {
        mode: "reply",
        target: "800",
        bot_login: "github-actions[bot]",
      },
    });
  });

  it("does not treat a bot marker in another thread as this thread's bot", () => {
    const humanRoot = {
      id: 810,
      in_reply_to_id: null,
      user: { login: "maintainer" },
      body: "A human comment",
    };
    const otherRoot = {
      id: 820,
      in_reply_to_id: null,
      user: { login: "maintainer" },
      body: "Another human comment",
    };
    const botElsewhere = {
      id: 821,
      in_reply_to_id: 820,
      user: { login: "github-actions[bot]" },
      body: `<!-- opencode-github-review -->\n\nA bot reply`,
    };
    const followUp = {
      ...inlineReply.comment,
      id: 812,
      in_reply_to_id: 810,
      body: "A later reply without a command",
    };
    expect(
      authorize(
        "write",
        { ...inlineReply, comment: followUp },
        {
          eventName: "pull_request_review_comment",
          comments: { 810: humanRoot },
          threadComments: [humanRoot, otherRoot, botElsewhere, followUp],
        },
      ),
    ).toMatchObject({ allowed: false });
  });

  it("walks nested replies to a bot comment and targets the thread root", () => {
    const firstReply = {
      id: 901,
      in_reply_to_id: 700,
      user: { login: "maintainer" },
      body: "First reply",
    };
    const secondReply = {
      id: 902,
      in_reply_to_id: 901,
      user: { login: "maintainer" },
      body: "Second reply",
    };
    expect(
      authorize(
        "write",
        { ...inlineReply, comment: secondReply },
        {
          eventName: "pull_request_review_comment",
          comments: { 700: botComment, 901: firstReply },
        },
      ),
    ).toMatchObject({ allowed: true, outputs: { target: "700" } });
  });

  it("keeps the workflow token read-only for content and runs a trusted runner", () => {
    expect(workflow).toMatch(/contents: read/);
    expect(workflow).toMatch(/pull-requests: write/);
    expect(workflow).toMatch(/issues: write/);
    expect(workflow).not.toMatch(/contents: write|AGENT_GITHUB_TOKEN/);
    expect(workflow).toMatch(/^on:\r?\n  pull_request_target:/m);
    expect(workflow).toMatch(
      /Checkout trusted default branch[\s\S]*?ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
    );
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(1);
    expect(workflow).toContain('SHARE: "false"');
    expect(workflow).toContain('OPENCODE_DISABLE_PROJECT_CONFIG: "true"');
    expect(workflow).toContain(
      '"small_model":"opencode/deepseek-v4.1-flash-free"',
    );
    expect(workflow).toContain("github.event.sender.type != 'Bot'");
    expect(workflow).toContain("sha256sum --check --strict");
    expect(workflow).toContain(
      "https://github.com/anomalyco/opencode/releases/download/v1.19.5/opencode-linux-x64.tar.gz",
    );
    expect(workflow).toContain('node "$RUNNER"');
    expect(workflow).not.toContain('RUNNER="$PR_HEAD_DIR/$RUNNER"');
    expect(workflow).not.toContain("opencode github run");
    expect(workflow).not.toContain(
      "ref: ${{ github.event.pull_request.head.sha }}",
    );
    expect(workflow).toContain(
      'git worktree add --detach "$RUNNER_TEMP/pr-head"',
    );
    expect(workflow).toContain(
      "ref: ${{ github.event.repository.default_branch }}",
    );
    expect(workflow).toMatch(/"permission":\{"\*":"deny","read":"allow"/);
    expect(workflow).toContain('"*>*":"deny"');
    expect(workflow).toContain('"*--ext-diff*":"deny"');
    expect(workflow).toContain(
      "OPENCODE_REVIEW_MODE: ${{ steps.authorize.outputs.mode }}",
    );
  });
});

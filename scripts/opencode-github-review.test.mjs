import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REVIEW_MARKER,
  buildBodyOnlyReviewPayload,
  buildIssueCommentBody,
  buildIssuePrompt,
  buildReplyBody,
  buildReplyPrompt,
  buildReviewPayload,
  buildReviewPrompt,
  botReviewThreadIds,
  classifyFindings,
  createGitHubClient,
  extractFinalText,
  extractModelError,
  hasReviewMarker,
  isBotRequest,
  isBotThread,
  main,
  normalizeRepoPath,
  parseJsonLines,
  parseReviewOutput,
  parseUnifiedDiff,
  prepareReview,
  resolveThread,
  runModel,
  sameThreadComments,
  unwrapFence,
} from "./opencode-github-review.mjs";

const diff = [
  "diff --git a/src/example.ts b/src/example.ts",
  "index 1111111..2222222 100644",
  "--- a/src/example.ts",
  "+++ b/src/example.ts",
  "@@ -1,3 +1,4 @@",
  " context one",
  "-old line",
  "+new line two",
  "+new line three",
  " context four",
  "@@ -20,2 +21,2 @@",
  " context twenty-one",
  "-old twenty-two",
  "+new twenty-two",
  "",
].join("\n");

const newFileDiff = [
  "diff --git a/src/new.ts b/src/new.ts",
  "new file mode 100644",
  "--- /dev/null",
  "+++ b/src/new.ts",
  "@@ -0,0 +1,2 @@",
  "+one",
  "+two",
  "",
].join("\n");

function fakeClient(calls) {
  return {
    getComment(id) {
      calls.push(id);
      return null;
    },
  };
}

describe("OpenCode review output parsing", () => {
  it("reads a fenced JSON review and normalizes finding fields", () => {
    const raw = [
      "Here is the review:",
      "```json",
      JSON.stringify({
        summary: "Looks good overall.",
        findings: [
          {
            path: "src/example.ts",
            line: "2",
            severity: "Major",
            body: "Handle the failure path.",
          },
        ],
      }),
      "```",
    ].join("\n");
    const review = parseReviewOutput(raw);
    expect(review.fallback).toBe(false);
    expect(review.summary).toBe("Looks good overall.");
    expect(review.findings).toEqual([
      {
        path: "src/example.ts",
        line: 2,
        severity: "major",
        body: "Handle the failure path.",
      },
    ]);
  });

  it("prefers the last of several fenced blocks so examples do not win", () => {
    const raw = [
      '```json\n{"summary":"example","findings":[]}\n```',
      '```json\n{"summary":"real answer","findings":[]}\n```',
    ].join("\n\n");
    expect(parseReviewOutput(raw).summary).toBe("real answer");
  });

  it("accepts plain JSON surrounded by prose", () => {
    const raw = `Review follows. ${JSON.stringify({ summary: "ok", findings: [] })} Done.`;
    const review = parseReviewOutput(raw);
    expect(review.fallback).toBe(false);
    expect(review.summary).toBe("ok");
  });

  it("keeps malformed output as a body-only review", () => {
    const raw = "I could not produce JSON, but line 4 looks wrong.";
    const review = parseReviewOutput(raw);
    expect(review.fallback).toBe(true);
    expect(review.summary).toBe(raw);
    expect(review.findings).toEqual([]);
  });

  it("retains unusable paths and lines as out-of-diff findings", () => {
    const raw = JSON.stringify({
      summary: "",
      findings: [
        { path: "../../etc/passwd", line: "nope", body: "Suspicious path" },
      ],
    });
    const review = parseReviewOutput(raw);
    expect(review.findings[0]).toMatchObject({
      path: "../../etc/passwd",
      line: null,
      body: "Suspicious path",
    });
  });

  it("rejects a findings value that is not an array", () => {
    const raw = JSON.stringify({ summary: "bad shape", findings: "none" });
    expect(parseReviewOutput(raw).fallback).toBe(true);
  });
});

describe("diff line validation", () => {
  it("collects only new-side lines, including context and added lines", () => {
    const files = parseUnifiedDiff(diff);
    expect([...files.keys()]).toEqual(["src/example.ts"]);
    expect([...files.get("src/example.ts")]).toEqual([1, 2, 3, 4, 21, 22]);
  });

  it("handles new files and ignores deleted or binary files", () => {
    const added = parseUnifiedDiff(newFileDiff);
    expect([...added.get("src/new.ts")]).toEqual([1, 2]);

    const deleted = parseUnifiedDiff(
      [
        "diff --git a/old.ts b/old.ts",
        "deleted file mode 100644",
        "--- a/old.ts",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "-one",
        "-two",
        "",
      ].join("\n"),
    );
    expect(deleted.size).toBe(0);

    const binary = parseUnifiedDiff(
      [
        "diff --git a/image.png b/image.png",
        "new file mode 100644",
        "Binary files /dev/null and b/image.png differ",
        "",
      ].join("\n"),
    );
    expect(binary.size).toBe(0);
  });

  it("does not mistake added content starting with ++ for a file header", () => {
    const files = parseUnifiedDiff(
      [
        "diff --git a/src/example.ts b/src/example.ts",
        "--- a/src/example.ts",
        "+++ b/src/example.ts",
        "@@ -1,1 +1,2 @@",
        " context one",
        "+++ added content",
        "",
      ].join("\n"),
    );
    expect([...files.get("src/example.ts")]).toEqual([1, 2]);
    expect(files.has("added content")).toBe(false);
  });

  it("normalizes model paths and rejects traversal", () => {
    expect(normalizeRepoPath("b/src/example.ts")).toBe("b/src/example.ts");
    expect(normalizeRepoPath("./src/example.ts")).toBe("src/example.ts");
    expect(normalizeRepoPath("src\\example.ts")).toBe("src/example.ts");
    expect(normalizeRepoPath("../secret.ts")).toBeNull();
    expect(normalizeRepoPath("/etc/passwd")).toBeNull();
    expect(normalizeRepoPath("src//example.ts")).toBeNull();
  });

  it("strips exactly one diff prefix and unquotes git paths", () => {
    const prefixed = parseUnifiedDiff(
      [
        "diff --git a/b/foo.ts b/b/foo.ts",
        "--- a/b/foo.ts",
        "+++ b/b/foo.ts",
        "@@ -1,1 +1,1 @@",
        "-old",
        "+new",
        "",
      ].join("\n"),
    );
    expect([...prefixed.keys()]).toEqual(["b/foo.ts"]);

    const quoted = parseUnifiedDiff(
      [
        'diff --git "a/dir with space/x.ts" "b/dir with space/x.ts"',
        '--- "a/dir with space/x.ts"',
        '+++ "b/dir with space/x.ts"',
        "@@ -1,1 +1,1 @@",
        "-old",
        "+new",
        "",
      ].join("\n"),
    );
    expect([...quoted.keys()]).toEqual(["dir with space/x.ts"]);
  });

  it("splits findings into inline and body-only sets", () => {
    const { inline, outside } = classifyFindings(
      [
        { path: "src/example.ts", line: 2, body: "inline" },
        { path: "src/example.ts", line: 99, body: "wrong line" },
        { path: "src/missing.ts", line: 1, body: "missing file" },
      ],
      parseUnifiedDiff(diff),
    );
    expect(inline).toHaveLength(1);
    expect(outside.map((finding) => finding.body)).toEqual([
      "wrong line",
      "missing file",
    ]);
  });
});

describe("review payloads", () => {
  it("places valid findings inline and the rest in the review body", () => {
    const prepared = prepareReview(
      {
        summary: "Summary",
        findings: [
          {
            path: "src/example.ts",
            line: 2,
            severity: "major",
            body: "Inline issue",
          },
          {
            path: "src/example.ts",
            line: 99,
            severity: "minor",
            body: "Outside issue",
          },
          {
            path: "src/missing.ts",
            line: 1,
            severity: null,
            body: "Missing file",
          },
        ],
      },
      diff,
    );

    expect(prepared.comments).toHaveLength(1);
    expect(prepared.comments[0]).toMatchObject({
      path: "src/example.ts",
      line: 2,
      side: "RIGHT",
    });
    expect(prepared.comments[0].body).toContain(REVIEW_MARKER);
    expect(prepared.body).toContain(REVIEW_MARKER);
    expect(prepared.body).toContain("Findings outside the diff");
    expect(prepared.body).toContain("Outside issue");
    expect(prepared.body).toContain("Missing file");
    expect(prepared.body).not.toContain("Inline issue");
  });

  it("merges duplicate findings for the same line", () => {
    const prepared = prepareReview(
      {
        summary: "",
        findings: [
          { path: "src/example.ts", line: 2, body: "First" },
          { path: "src/example.ts", line: 2, body: "Second" },
        ],
      },
      diff,
    );
    expect(prepared.comments).toHaveLength(1);
    expect(prepared.comments[0].body).toContain("First");
    expect(prepared.comments[0].body).toContain("Second");
  });

  it("caps inline comments and renders overflow in the body", () => {
    const many = [
      "diff --git a/many.ts b/many.ts",
      "--- a/many.ts",
      "+++ b/many.ts",
      "@@ -0,0 +1,52 @@",
      ...Array.from({ length: 52 }, (_, index) => `+line ${index + 1}`),
      "",
    ].join("\n");
    const findings = Array.from({ length: 52 }, (_, index) => ({
      path: "many.ts",
      line: index + 1,
      severity: null,
      body: `finding ${index + 1}`,
    }));
    const prepared = prepareReview({ summary: "", findings }, many, {
      maxInline: 50,
    });
    expect(prepared.comments).toHaveLength(50);
    expect(prepared.body).toContain("finding 51");
    expect(prepared.body).toContain("finding 52");
  });

  it("builds a COMMENT review and a body-only fallback", () => {
    const prepared = prepareReview(
      {
        summary: "Summary",
        findings: [{ path: "src/example.ts", line: 2, body: "Inline" }],
      },
      diff,
    );
    const payload = buildReviewPayload({
      commitId: "abc123",
      body: prepared.body,
      comments: prepared.comments,
    });
    expect(payload).toMatchObject({
      commit_id: "abc123",
      event: "COMMENT",
    });
    expect(payload.comments[0].side).toBe("RIGHT");

    const fallback = buildBodyOnlyReviewPayload(prepared, "abc123");
    expect(fallback.comments).toEqual([]);
    expect(fallback.body).toContain("Inline");
  });

  it("marks replies and issue answers for future thread detection", () => {
    expect(buildReplyBody("Thanks, fixed.")).toBe(
      `${REVIEW_MARKER}\n\nThanks, fixed.`,
    );
    expect(buildIssueCommentBody("Here is the answer.")).toContain(
      REVIEW_MARKER,
    );
    expect(hasReviewMarker(buildIssueCommentBody("x"))).toBe(true);
    expect(hasReviewMarker("plain comment")).toBe(false);
  });

  it("strips a conversational markdown fence", () => {
    expect(unwrapFence("```markdown\nAnswer\n```")).toBe("Answer");
    expect(unwrapFence("```\nAnswer\n```")).toBe("Answer");
    expect(unwrapFence("Answer\n\nMore")).toBe("Answer\n\nMore");
  });
});

describe("OpenCode JSON event parsing", () => {
  it("takes all text parts from the last assistant message", () => {
    const events = [
      { type: "tool_use", part: { text: "ignored" } },
      { type: "text", part: { messageID: "m1", text: "intermediate" } },
      { type: "text", part: { messageID: "m2", text: "final " } },
      { type: "text", part: { messageID: "m2", text: "answer" } },
    ];
    expect(extractFinalText(events)).toBe("final \nanswer");
  });

  it("ignores non-JSON log lines and reports provider errors", () => {
    const events = parseJsonLines(
      [
        "INFO starting provider",
        JSON.stringify({ type: "text", part: { messageID: "m", text: "ok" } }),
        JSON.stringify({
          type: "error",
          error: { data: { message: "rate limited" } },
        }),
      ].join("\n"),
    );
    expect(events).toHaveLength(2);
    expect(extractFinalText(events)).toBe("ok");
    expect(extractModelError(events)).toBe("rate limited");
  });

  it("returns empty text when no assistant text was emitted", () => {
    expect(extractFinalText([])).toBe("");
    expect(extractFinalText([{ type: "step_start" }])).toBe("");
  });
});

describe("model invocation", () => {
  it("pins the PR worktree, isolation flags, logs, and a bounded timeout", () => {
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, options });
      return {
        status: 0,
        stdout: JSON.stringify({
          type: "text",
          part: { messageID: "m", text: "answer" },
        }),
        stderr: "",
      };
    };
    const text = runModel(
      "prompt",
      {
        OPENCODE_REVIEW_MODEL: "opencode/model",
        PR_HEAD_DIR: "/tmp/pr-head",
      },
      spawn,
    );

    expect(text).toBe("answer");
    expect(calls[0].command).toBe("opencode");
    expect(calls[0].args).toEqual([
      "run",
      "--format",
      "json",
      "--model",
      "opencode/model",
      "--dir",
      "/tmp/pr-head",
      "--pure",
      "--print-logs",
      "--log-level",
      "ERROR",
    ]);
    expect(calls[0].options).toMatchObject({
      cwd: "/tmp/pr-head",
      input: "prompt",
      stdio: ["pipe", "pipe", "inherit"],
      env: {
        PWD: "/tmp/pr-head",
        OPENCODE_DISABLE_PROJECT_CONFIG: "true",
      },
    });
    expect(calls[0].options.timeout).toBeGreaterThanOrEqual(15 * 60 * 1000);
  });

  it("includes partial output when the model process times out", () => {
    const spawn = () => ({
      error: new Error("spawnSync opencode ETIMEDOUT"),
      stdout: JSON.stringify({ type: "tool_use", part: { tool: "read" } }),
      stderr: "",
    });
    expect(() =>
      runModel("prompt", { OPENCODE_REVIEW_MODEL: "opencode/model" }, spawn),
    ).toThrow(/ETIMEDOUT[\s\S]*Partial output[\s\S]*tool_use/);
  });

  it("requires an explicit model identifier", () => {
    expect(() => runModel("prompt", {}, () => ({}))).toThrow(
      "Set OPENCODE_REVIEW_MODEL",
    );
  });
});

describe("prompts", () => {
  it("requires a line-addressable JSON contract for reviews", () => {
    const prompt = buildReviewPrompt({
      repo: "devcedrick/quilla",
      pr: 105,
      title: "Title",
      body: "Description",
      baseRef: "main",
    });
    expect(prompt).toContain('"findings"');
    expect(prompt).toContain("git diff origin/main...HEAD");
    expect(prompt).toContain("gh pr diff 105");
    expect(prompt).toContain("Prefer a line that is part");
    expect(prompt).toContain("Findings outside the diff are listed");
    expect(prompt).toContain("Report at most 10 findings");
    expect(prompt).toContain("do not exhaustively read");
    expect(prompt).toContain("untrusted data");
  });

  it("includes thread context without duplicating a top-level request", () => {
    const withRoot = buildReplyPrompt({
      repo: "devcedrick/quilla",
      pr: 105,
      path: "src/example.ts",
      line: 2,
      diffHunk: "+new line",
      rootBody: "Original finding",
      replyBody: "Why?",
    });
    expect(withRoot).toContain("Original finding");
    expect(withRoot).toContain("Why?");

    const withoutRoot = buildReplyPrompt({
      repo: "devcedrick/quilla",
      pr: 105,
      path: "src/example.ts",
      line: 2,
      diffHunk: "",
      rootBody: "",
      replyBody: "/oc explain",
    });
    expect(withoutRoot).not.toContain("Untrusted root review comment");
  });

  it("describes issues and pull requests accurately", () => {
    const issue = buildIssuePrompt({
      repo: "devcedrick/quilla",
      number: 95,
      title: "Issue",
      body: "Body",
      request: "/oc explain",
      isPullRequest: false,
    });
    expect(issue).toContain("Issue: #95");
    expect(issue).toContain("/oc explain");

    const pullRequest = buildIssuePrompt({
      repo: "devcedrick/quilla",
      number: 105,
      title: "PR",
      body: "Body",
      request: "/oc review",
      isPullRequest: true,
    });
    expect(pullRequest).toContain("Pull request: #105");
    expect(pullRequest).toContain("current working directory");
  });
});

describe("request detection", () => {
  it("matches only standalone /oc or /opencode commands", () => {
    expect(isBotRequest("/oc explain")).toBe(true);
    expect(isBotRequest("/opencode review this")).toBe(true);
    expect(isBotRequest("Please /OC explain")).toBe(true);
    expect(isBotRequest("/octopus")).toBe(false);
    expect(isBotRequest("no command here")).toBe(false);
  });
});

describe("thread resolution", () => {
  const root = {
    id: 1,
    in_reply_to_id: null,
    body: `${REVIEW_MARKER}\n\nRoot`,
    user: { login: "github-actions[bot]" },
  };
  const reply = {
    id: 2,
    in_reply_to_id: 1,
    body: "Question",
    user: { login: "maintainer" },
  };
  const nested = {
    id: 3,
    in_reply_to_id: 2,
    body: "Follow-up",
    user: { login: "maintainer" },
  };
  const comments = { 1: root, 2: reply, 3: nested };

  it("walks to the top-level review comment", () => {
    const calls = [];
    const thread = resolveThread(nested, {
      getComment(id) {
        calls.push(id);
        return comments[id] ?? null;
      },
    });
    expect(thread.root.id).toBe(1);
    expect(thread.ancestors.map((comment) => comment.id)).toEqual([2, 1]);
    expect(calls).toEqual([2, 1]);
  });

  it("detects bot threads by author and marker", () => {
    expect(isBotThread(reply, [root], "github-actions[bot]")).toBe(true);
    expect(isBotThread(nested, [reply, root], "github-actions[bot]")).toBe(
      true,
    );
    expect(
      isBotThread(
        { ...reply, user: { login: "maintainer" }, body: REVIEW_MARKER },
        [],
        "github-actions[bot]",
      ),
    ).toBe(false);
    expect(isBotThread(reply, [], "github-actions[bot]")).toBe(false);
    expect(isBotThread(reply, [root], "")).toBe(false);
  });

  it("finds sibling comments in a human-rooted thread", () => {
    const humanRoot = {
      id: 10,
      in_reply_to_id: null,
      body: "A human comment",
      user: { login: "maintainer" },
    };
    const botReply = {
      id: 11,
      in_reply_to_id: 10,
      body: `${REVIEW_MARKER}\n\nA bot reply`,
      user: { login: "github-actions[bot]" },
    };
    const followUp = {
      id: 12,
      in_reply_to_id: 10,
      body: "A later human reply",
      user: { login: "maintainer" },
    };
    const otherThread = {
      id: 13,
      in_reply_to_id: null,
      body: "Elsewhere",
      user: { login: "maintainer" },
    };
    expect(
      sameThreadComments(followUp, [
        humanRoot,
        botReply,
        followUp,
        otherThread,
      ]).map((comment) => comment.id),
    ).toEqual([10, 11, 12]);
    expect(
      isBotThread(
        followUp,
        sameThreadComments(followUp, [humanRoot, botReply, followUp]),
        "github-actions[bot]",
      ),
    ).toBe(true);
  });

  it("returns no root when the parent cannot be fetched", () => {
    const thread = resolveThread(nested, fakeClient([]));
    expect(thread.root).toBe(nested);
    expect(thread.ancestors).toEqual([]);
  });

  it("selects only unresolved bot-rooted review threads", () => {
    const thread = (id, isResolved, author, body) => ({
      id,
      isResolved,
      comments: { nodes: [{ author, body }] },
    });
    expect(
      botReviewThreadIds([
        thread(
          "rest-bot",
          false,
          { login: "github-actions[bot]" },
          `${REVIEW_MARKER}\n\nfinding`,
        ),
        thread(
          "graphql-bot",
          false,
          { login: "github-actions", __typename: "Bot" },
          `${REVIEW_MARKER}\n\nfinding`,
        ),
        thread(
          "resolved",
          true,
          { login: "github-actions", __typename: "Bot" },
          REVIEW_MARKER,
        ),
        thread(
          "human",
          false,
          { login: "maintainer", __typename: "User" },
          REVIEW_MARKER,
        ),
        thread(
          "unmarked",
          false,
          { login: "github-actions", __typename: "Bot" },
          "finding",
        ),
        thread("deleted", false, null, REVIEW_MARKER),
        { id: "empty", isResolved: false, comments: { nodes: [] } },
      ]),
    ).toEqual(["rest-bot", "graphql-bot"]);
  });
});

describe("mode orchestration", () => {
  function reviewEnv(overrides = {}) {
    return {
      GITHUB_REPOSITORY: "devcedrick/quilla",
      OPENCODE_REVIEW_MODE: "review",
      GITHUB_EVENT_PATH: "event.json",
      OPENCODE_PR_NUMBER: "105",
      OPENCODE_TARGET_ID: "105",
      OPENCODE_HEAD_SHA: "abc123",
      OPENCODE_REVIEW_MODEL: "opencode/model",
      ...overrides,
    };
  }

  const pull = {
    state: "open",
    title: "Title",
    body: "Body",
    base: { ref: "main" },
    head: { sha: "abc123" },
  };

  const botThread = {
    id: "PRRT_old",
    isResolved: false,
    comments: {
      nodes: [
        {
          author: { login: "github-actions", __typename: "Bot" },
          body: `${REVIEW_MARKER}\n\nOld finding`,
        },
      ],
    },
  };
  const humanThread = {
    id: "PRRT_human",
    isResolved: false,
    comments: {
      nodes: [{ author: { login: "maintainer" }, body: "Human thread" }],
    },
  };

  function withCapturePath(run) {
    const directory = mkdtempSync(join(tmpdir(), "opencode-review-"));
    const path = join(directory, "threads.json");
    try {
      return run(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it("posts a review with inline findings and body-only findings", () => {
    const reviews = [];
    main(reviewEnv(), {
      readEvent: () => ({ pull_request: { number: 105 } }),
      client: {
        getPull: () => pull,
        getPullDiff: () => diff,
        createReview: (pr, payload) => reviews.push({ pr, payload }),
      },
      runModel: () =>
        JSON.stringify({
          summary: "Summary",
          findings: [
            { path: "src/example.ts", line: 2, body: "Inline" },
            { path: "src/example.ts", line: 99, body: "Outside" },
          ],
        }),
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].pr).toBe(105);
    expect(reviews[0].payload.comments).toHaveLength(1);
    expect(reviews[0].payload.body).toContain("Outside");
  });

  it("captures previous bot threads for the trusted resolver after a new push", () => {
    withCapturePath((capturePath) => {
      const order = [];
      const resolved = [];
      main(reviewEnv({ OPENCODE_RESOLVE_THREADS_PATH: capturePath }), {
        readEvent: () => ({ action: "synchronize" }),
        client: {
          getPull: () => pull,
          getPullDiff: () => diff,
          listReviewThreads: () => {
            order.push("list");
            return [botThread, humanThread];
          },
          createReview: () => order.push("review"),
          resolveReviewThread: (id) => resolved.push(id),
        },
        runModel: () => JSON.stringify({ summary: "Summary", findings: [] }),
      });
      expect(order).toEqual(["list", "review"]);
      expect(resolved).toEqual([]);
      expect(JSON.parse(readFileSync(capturePath, "utf8"))).toEqual({
        version: 1,
        pull: 105,
        threadIds: ["PRRT_old"],
      });
    });
  });

  it("does not list or write a capture on a non-push review", () => {
    withCapturePath((capturePath) => {
      let listed = false;
      main(reviewEnv({ OPENCODE_RESOLVE_THREADS_PATH: capturePath }), {
        readEvent: () => ({ action: "opened" }),
        client: {
          getPull: () => pull,
          getPullDiff: () => diff,
          listReviewThreads: () => {
            listed = true;
            return [];
          },
          createReview: () => {},
          resolveReviewThread: () => {
            throw new Error("must not resolve");
          },
        },
        runModel: () => JSON.stringify({ summary: "Summary", findings: [] }),
      });
      expect(listed).toBe(false);
      expect(existsSync(capturePath)).toBe(false);
    });
  });

  it("does not write a capture when the fresh review fails", () => {
    withCapturePath((capturePath) => {
      expect(() =>
        main(reviewEnv({ OPENCODE_RESOLVE_THREADS_PATH: capturePath }), {
          readEvent: () => ({ action: "synchronize" }),
          client: {
            getPull: () => pull,
            getPullDiff: () => diff,
            listReviewThreads: () => [botThread],
            createReview: () => {
              throw new Error("review rejected");
            },
            resolveReviewThread: () => {
              throw new Error("must not resolve");
            },
          },
          runModel: () => JSON.stringify({ summary: "Summary", findings: [] }),
        }),
      ).toThrow("review rejected");
      expect(existsSync(capturePath)).toBe(false);
    });
  });

  it("posts the review when the previous-thread listing is denied", () => {
    withCapturePath((capturePath) => {
      const reviews = [];
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (message) => warnings.push(String(message));
      try {
        main(reviewEnv({ OPENCODE_RESOLVE_THREADS_PATH: capturePath }), {
          readEvent: () => ({ action: "synchronize" }),
          client: {
            getPull: () => pull,
            getPullDiff: () => diff,
            listReviewThreads: () => {
              throw new Error("Resource not accessible");
            },
            createReview: (_pr, payload) => reviews.push(payload),
          },
          runModel: () => JSON.stringify({ summary: "Summary", findings: [] }),
        });
      } finally {
        console.warn = originalWarn;
      }
      expect(reviews).toHaveLength(1);
      expect(warnings.join(" ")).toContain("Resource not accessible");
      expect(existsSync(capturePath)).toBe(false);
    });
  });

  it("warns when no resolver path is configured", () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      main(reviewEnv(), {
        readEvent: () => ({ action: "synchronize" }),
        client: {
          getPull: () => pull,
          getPullDiff: () => diff,
          listReviewThreads: () => [botThread],
          createReview: () => {},
        },
        runModel: () => JSON.stringify({ summary: "Summary", findings: [] }),
      });
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.join(" ")).toContain("OPENCODE_RESOLVE_THREADS_PATH");
  });

  it("skips a review when the PR head changed during the run", () => {
    let posted = false;
    main(reviewEnv({ OPENCODE_HEAD_SHA: "old" }), {
      readEvent: () => ({}),
      client: {
        getPull: () => ({ ...pull, head: { sha: "new" } }),
        getPullDiff: () => diff,
        createReview: () => {
          posted = true;
        },
      },
      runModel: () => {
        throw new Error("the model must not run");
      },
    });
    expect(posted).toBe(false);
  });

  it("retries a rejected inline review with all findings in the body", () => {
    const reviews = [];
    let calls = 0;
    main(reviewEnv(), {
      readEvent: () => ({}),
      client: {
        getPull: () => pull,
        getPullDiff: () => diff,
        createReview: (_pr, payload) => {
          calls += 1;
          if (calls === 1)
            throw new Error("HTTP 422: line must be part of the diff");
          reviews.push(payload);
        },
      },
      runModel: () =>
        JSON.stringify({
          summary: "Summary",
          findings: [{ path: "src/example.ts", line: 2, body: "Inline" }],
        }),
    });
    expect(calls).toBe(2);
    expect(reviews[0].comments).toEqual([]);
    expect(reviews[0].body).toContain("Inline");
  });

  it("replies in the root bot review thread", () => {
    const replies = [];
    main(
      reviewEnv({
        OPENCODE_REVIEW_MODE: "reply",
        OPENCODE_TARGET_ID: "700",
        OPENCODE_BOT_LOGIN: "github-actions[bot]",
      }),
      {
        readEvent: () => ({
          pull_request: { number: 105 },
          comment: {
            id: 702,
            in_reply_to_id: 700,
            user: { login: "maintainer" },
            body: "Why is this wrong?",
            path: "src/example.ts",
            line: 2,
            diff_hunk: "+new line",
          },
        }),
        client: {
          getComment: () => ({
            id: 700,
            in_reply_to_id: null,
            user: { login: "github-actions[bot]" },
            body: `${REVIEW_MARKER}\n\nRoot finding`,
          }),
          replyToReviewComment: (pr, id, body) =>
            replies.push({ pr, id, body }),
        },
        runModel: () => "Because the guard fails.",
      },
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ pr: 105, id: 700 });
    expect(replies[0].body).toContain(REVIEW_MARKER);
    expect(replies[0].body).toContain("Because the guard fails.");
  });

  it("answers a command-free follow-up in a human-rooted thread", () => {
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
      body: `${REVIEW_MARKER}\n\nA bot reply`,
    };
    const followUp = {
      id: 802,
      in_reply_to_id: 800,
      user: { login: "maintainer" },
      body: "Follow up without a command",
      path: "src/example.ts",
      line: 2,
    };
    const replies = [];
    main(
      reviewEnv({
        OPENCODE_REVIEW_MODE: "reply",
        OPENCODE_TARGET_ID: "800",
        OPENCODE_BOT_LOGIN: "github-actions[bot]",
      }),
      {
        readEvent: () => ({
          pull_request: { number: 105 },
          comment: followUp,
        }),
        client: {
          getComment: (id) => (id === 800 ? humanRoot : null),
          getPullComments: () => [humanRoot, botReply, followUp],
          replyToReviewComment: (pr, id, body) =>
            replies.push({ pr, id, body }),
        },
        runModel: () => "A later answer.",
      },
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ pr: 105, id: 800 });
  });

  it("answers an explicit inline request without a known bot login", () => {
    const replies = [];
    main(
      reviewEnv({
        OPENCODE_REVIEW_MODE: "reply",
        OPENCODE_TARGET_ID: "901",
        OPENCODE_BOT_LOGIN: "",
      }),
      {
        readEvent: () => ({
          pull_request: { number: 105 },
          comment: {
            id: 902,
            in_reply_to_id: 901,
            user: { login: "maintainer" },
            body: "/oc why does this fail?",
            path: "src/example.ts",
            line: 2,
          },
        }),
        client: {
          getComment: () => ({
            id: 901,
            in_reply_to_id: null,
            user: { login: "maintainer" },
            body: "A user comment",
          }),
          replyToReviewComment: (pr, id, body) =>
            replies.push({ pr, id, body }),
        },
        runModel: () => "Because of the guard.",
      },
    );
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ pr: 105, id: 901 });
  });

  it("does not answer an unrelated inline comment", () => {
    const replies = [];
    main(
      reviewEnv({
        OPENCODE_REVIEW_MODE: "reply",
        OPENCODE_TARGET_ID: "801",
        OPENCODE_BOT_LOGIN: "github-actions[bot]",
      }),
      {
        readEvent: () => ({
          pull_request: { number: 105 },
          comment: {
            id: 802,
            in_reply_to_id: 801,
            user: { login: "maintainer" },
            body: "More context",
          },
        }),
        client: {
          getComment: () => ({
            id: 801,
            in_reply_to_id: null,
            user: { login: "maintainer" },
            body: "A user comment",
          }),
          replyToReviewComment: (pr, id, body) =>
            replies.push({ pr, id, body }),
        },
        runModel: () => {
          throw new Error("the model must not run");
        },
      },
    );
    expect(replies).toHaveLength(0);
  });

  it("answers an issue comment with a marked issue comment", () => {
    const comments = [];
    main(
      reviewEnv({
        OPENCODE_REVIEW_MODE: "issue",
        OPENCODE_PR_NUMBER: "",
        OPENCODE_TARGET_ID: "95",
      }),
      {
        readEvent: () => ({
          issue: { number: 95, title: "Issue", body: "Body" },
          comment: { body: "/oc explain this issue" },
        }),
        client: {
          createIssueComment: (number, body) => comments.push({ number, body }),
        },
        runModel: () => "Here is the explanation.",
      },
    );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ number: 95 });
    expect(comments[0].body).toContain(REVIEW_MARKER);
    expect(comments[0].body).toContain("Here is the explanation.");
  });
});

describe("thread resolution mode", () => {
  function resolveEnv(capturePath, overrides = {}) {
    return {
      GITHUB_REPOSITORY: "devcedrick/quilla",
      OPENCODE_REVIEW_MODE: "resolve",
      OPENCODE_RESOLVE_THREADS_PATH: capturePath,
      OPENCODE_PR_NUMBER: "105",
      ...overrides,
    };
  }

  const thread = (id, author, body = REVIEW_MARKER, isResolved = false) => ({
    id,
    isResolved,
    comments: { nodes: [{ author, body }] },
  });

  function withCapture(capture, run) {
    const directory = mkdtempSync(join(tmpdir(), "opencode-resolve-"));
    const path = join(directory, "threads.json");
    writeFileSync(path, JSON.stringify(capture), "utf8");
    try {
      return run(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it("resolves only captured, still-unresolved bot threads", () => {
    withCapture(
      {
        version: 1,
        pull: 105,
        threadIds: ["PRRT_old", "PRRT_human", "PRRT_done"],
      },
      (capturePath) => {
        const resolved = [];
        main(resolveEnv(capturePath), {
          client: {
            listReviewThreads: (pull) => {
              expect(pull).toBe(105);
              return [
                thread("PRRT_old", {
                  login: "github-actions",
                  __typename: "Bot",
                }),
                thread("PRRT_human", { login: "maintainer" }),
                thread("PRRT_not_captured", {
                  login: "github-actions",
                  __typename: "Bot",
                }),
                thread(
                  "PRRT_done",
                  { login: "github-actions", __typename: "Bot" },
                  REVIEW_MARKER,
                  true,
                ),
              ];
            },
            resolveReviewThread: (id) => resolved.push(id),
          },
        });
        expect(resolved).toEqual(["PRRT_old"]);
      },
    );
  });

  it("accepts an empty capture without listing threads", () => {
    withCapture({ version: 1, pull: 105, threadIds: [] }, (capturePath) => {
      main(resolveEnv(capturePath), {
        client: {
          listReviewThreads: () => {
            throw new Error("must not list");
          },
          resolveReviewThread: () => {
            throw new Error("must not resolve");
          },
        },
      });
    });
  });

  it("refuses a capture for a different pull request", () => {
    withCapture(
      { version: 1, pull: 104, threadIds: ["PRRT_old"] },
      (capturePath) => {
        expect(() =>
          main(resolveEnv(capturePath, { OPENCODE_PR_NUMBER: "105" }), {
            client: {
              listReviewThreads: () => {
                throw new Error("must not list");
              },
            },
          }),
        ).toThrow("belong to pull request 104");
      },
    );
  });

  it("refuses to resolve when the review run's pull request number is missing", () => {
    withCapture(
      { version: 1, pull: 105, threadIds: ["PRRT_old"] },
      (capturePath) => {
        for (const missing of ["", undefined]) {
          const env = resolveEnv(capturePath);
          if (missing === undefined) delete env.OPENCODE_PR_NUMBER;
          else env.OPENCODE_PR_NUMBER = missing;
          expect(() =>
            main(env, {
              client: {
                listReviewThreads: () => {
                  throw new Error("must not list");
                },
              },
            }),
          ).toThrow("needs the pull request number");
        }
      },
    );
  });

  it("refuses an unsupported or malformed capture", () => {
    withCapture({ version: 2, pull: 105, threadIds: [] }, (capturePath) => {
      expect(() => main(resolveEnv(capturePath), { client: {} })).toThrow(
        "Unsupported thread capture version: 2",
      );
    });
    withCapture(
      { version: 1, pull: 105, threadIds: "PRRT_old" },
      (capturePath) => {
        expect(() => main(resolveEnv(capturePath), { client: {} })).toThrow(
          "threadIds array",
        );
      },
    );
  });

  it("requires a repository and a capture path", () => {
    expect(() =>
      main({ OPENCODE_REVIEW_MODE: "resolve" }, { client: {} }),
    ).toThrow("GITHUB_REPOSITORY and OPENCODE_REVIEW_MODE are required.");
    expect(() =>
      main(
        {
          GITHUB_REPOSITORY: "devcedrick/quilla",
          OPENCODE_REVIEW_MODE: "resolve",
        },
        { client: {} },
      ),
    ).toThrow("OPENCODE_RESOLVE_THREADS_PATH");
  });

  it("attempts every captured thread and reports partial failures", () => {
    withCapture(
      { version: 1, pull: 105, threadIds: ["PRRT_one", "PRRT_two"] },
      (capturePath) => {
        const attempted = [];
        const warnings = [];
        const originalWarn = console.warn;
        console.warn = (message) => warnings.push(String(message));
        try {
          expect(() =>
            main(resolveEnv(capturePath), {
              client: {
                listReviewThreads: () => [
                  thread("PRRT_one", {
                    login: "github-actions",
                    __typename: "Bot",
                  }),
                  thread("PRRT_two", {
                    login: "github-actions",
                    __typename: "Bot",
                  }),
                ],
                resolveReviewThread: (id) => {
                  attempted.push(id);
                  if (id === "PRRT_one")
                    throw new Error("Resource not accessible");
                },
              },
            }),
          ).toThrow("Could not resolve 1 of 2 captured bot thread(s).");
        } finally {
          console.warn = originalWarn;
        }
        expect(attempted).toEqual(["PRRT_one", "PRRT_two"]);
        expect(warnings.join(" ")).toContain("Resource not accessible");
      },
    );
  });

  it("does not touch threads that were not captured", () => {
    withCapture(
      { version: 1, pull: 105, threadIds: ["PRRT_old"] },
      (capturePath) => {
        const resolved = [];
        main(resolveEnv(capturePath), {
          client: {
            listReviewThreads: () => [
              thread("PRRT_old", {
                login: "github-actions",
                __typename: "Bot",
              }),
              thread("PRRT_new", {
                login: "github-actions",
                __typename: "Bot",
              }),
              thread("PRRT_human", { login: "maintainer" }),
            ],
            resolveReviewThread: (id) => resolved.push(id),
          },
        });
        expect(resolved).toEqual(["PRRT_old"]);
      },
    );
  });
});

describe("GitHub client", () => {
  function fakeSpawn(stdout = "{}") {
    const calls = [];
    const spawn = (command, args, options) => {
      calls.push({ command, args, input: options.input });
      return { status: 0, stdout, stderr: "" };
    };
    return { calls, spawn };
  }

  it("uses gh pr diff for the review diff", () => {
    const { calls, spawn } = fakeSpawn();
    const client = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn,
    });
    client.getPullDiff(105);
    expect(calls[0]).toMatchObject({
      command: "gh",
      args: ["pr", "diff", "105", "--repo", "devcedrick/quilla"],
    });
  });

  it("posts reviews and replies as JSON on stdin", () => {
    const { calls, spawn } = fakeSpawn();
    const client = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn,
    });

    client.createReview(105, { body: "review", comments: [] });
    expect(calls[0].args).toEqual([
      "api",
      "repos/devcedrick/quilla/pulls/105/reviews",
      "--method",
      "POST",
      "--input",
      "-",
    ]);
    expect(JSON.parse(calls[0].input)).toEqual({
      body: "review",
      comments: [],
    });

    client.replyToReviewComment(105, 700, "reply");
    expect(calls[1].args).toContain(
      "repos/devcedrick/quilla/pulls/105/comments/700/replies",
    );
    expect(JSON.parse(calls[1].input)).toEqual({ body: "reply" });

    client.createIssueComment(95, "answer");
    expect(calls[2].args).toContain(
      "repos/devcedrick/quilla/issues/95/comments",
    );
    expect(JSON.parse(calls[2].input)).toEqual({ body: "answer" });
  });

  it("lists every review comment in the pull request with pagination", () => {
    const { calls, spawn } = fakeSpawn(
      JSON.stringify([[{ id: 1 }], [{ id: 2 }]]),
    );
    const client = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn,
    });
    expect(client.getPullComments(105)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(calls[0].args).toEqual([
      "api",
      "repos/devcedrick/quilla/pulls/105/comments?per_page=100",
      "--paginate",
      "--slurp",
    ]);
  });

  it("lists review threads through GraphQL pagination", () => {
    const pages = [
      {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                nodes: [{ id: "PRRT_1" }],
              },
            },
          },
        },
      },
      {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ id: "PRRT_2" }],
              },
            },
          },
        },
      },
    ];
    const calls = [];
    let page = 0;
    const spawn = (command, args) => {
      calls.push({ command, args });
      return { status: 0, stdout: JSON.stringify(pages[page++]), stderr: "" };
    };
    const client = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn,
    });
    expect(client.listReviewThreads(105)).toEqual([
      { id: "PRRT_1" },
      { id: "PRRT_2" },
    ]);
    expect(calls).toHaveLength(2);
    expect(calls[0].args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    expect(calls[0].args[3]).toContain("reviewThreads(first: 100");
    for (const arg of ["owner=devcedrick", "repo=quilla", "pull=105"])
      expect(calls[0].args).toContain(arg);
    expect(calls[0].args).not.toContain("after=cursor-1");
    expect(calls[1].args).toContain("after=cursor-1");
  });

  it("resolves a review thread and surfaces GraphQL errors", () => {
    const { calls, spawn } = fakeSpawn(
      JSON.stringify({
        data: { resolveReviewThread: { thread: { id: "PRRT_1" } } },
      }),
    );
    const client = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn,
    });
    client.resolveReviewThread("PRRT_1");
    expect(calls[0].args.slice(0, 3)).toEqual(["api", "graphql", "-f"]);
    expect(calls[0].args[3]).toContain("resolveReviewThread");
    expect(calls[0].args).toContain("threadId=PRRT_1");

    const failing = fakeSpawn(
      JSON.stringify({ errors: [{ message: "Resource not accessible" }] }),
    );
    const denied = createGitHubClient({
      repo: "devcedrick/quilla",
      env: {},
      spawn: failing.spawn,
    });
    expect(() => denied.resolveReviewThread("PRRT_2")).toThrow(
      "Resource not accessible",
    );
  });
});

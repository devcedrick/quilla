import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/opencode.yaml", "utf8");
const authorization = workflow.match(
  /node <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/,
);
if (!authorization) throw new Error("OpenCode authorization script not found");

function authorize(permission, event, pr = {}) {
  let output = "";
  const calls = [];
  runInNewContext(authorization[1], {
    process: {
      env: {
        GITHUB_EVENT_PATH: "event.json",
        GITHUB_REPOSITORY: "devcedrick/quilla",
        GITHUB_ACTOR: "maintainer",
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
            if (args[1].endsWith("/permission"))
              return JSON.stringify({ permission });
            return JSON.stringify(pr);
          },
        };
      throw new Error("Unexpected module");
    },
  });
  expect(
    calls.every(([command, method]) => command === "gh" && method === "api"),
  ).toBe(true);
  return output === "allowed=true\n";
}

const issueComment = {
  issue: { number: 95 },
  comment: { body: "/oc explain this issue" },
};
const sameRepoPR = {
  state: "open",
  draft: false,
  head: { repo: { full_name: "devcedrick/quilla" } },
};

describe("OpenCode workflow authorization", () => {
  it.each(["admin", "maintain", "write"])(
    "allows %s requesters to ask about an issue",
    (permission) => {
      expect(authorize(permission, issueComment)).toBe(true);
    },
  );
  it.each(["read", "triage", "none"])("refuses %s requesters", (permission) => {
    expect(authorize(permission, issueComment)).toBe(false);
  });
  it("checks conversation and inline PR comments against the current PR origin", () => {
    const conversation = {
      ...issueComment,
      issue: { number: 102, pull_request: { url: "api" } },
    };
    const inline = {
      pull_request: { number: 102 },
      comment: { body: "/opencode review this line" },
    };
    for (const event of [
      conversation,
      inline,
      { pull_request: { number: 102 } },
    ]) {
      expect(authorize("write", event, sameRepoPR)).toBe(true);
      expect(
        authorize("write", event, {
          ...sameRepoPR,
          head: { repo: { full_name: "outsider/fork" } },
        }),
      ).toBe(false);
      expect(authorize("write", event, { ...sameRepoPR, draft: true })).toBe(
        false,
      );
      expect(
        authorize("write", event, { ...sameRepoPR, state: "closed" }),
      ).toBe(false);
    }
  });
  it("does not match an unrelated slash word as a bot request", () => {
    expect(
      authorize("write", { ...issueComment, comment: { body: "/octopus" } }),
    ).toBe(false);
    expect(
      authorize("write", {
        ...issueComment,
        comment: { body: "Please /OPENCODE explain" },
      }),
    ).toBe(true);
  });
  it("keeps the workflow token read-only for repository content and disables sharing", () => {
    expect(workflow).toMatch(/contents: read/);
    expect(workflow).not.toMatch(
      /contents: write|pull_request_target|AGENT_GITHUB_TOKEN/,
    );
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain('SHARE: "false"');
    expect(workflow).toContain("github.event.sender.type != 'Bot'");
    expect(workflow).toContain("sha256sum --check --strict");
  });
});

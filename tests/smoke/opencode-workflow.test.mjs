import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/opencode.yaml", "utf8");
const authorization = workflow.match(
  /node <<'NODE'\r?\n([\s\S]*?)\r?\n\s+NODE/,
);
if (!authorization) throw new Error("OpenCode authorization script not found");

/** Execute the extracted authorization guard with bounded, synthetic GitHub responses. */
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
  it("scopes concurrency to the gated job and lets only PR events cancel active runs", () => {
    expect(workflow).not.toMatch(/^concurrency:/m);
    expect(workflow).toMatch(
      /\n    concurrency:\r?\n      group: opencode-\$\{\{ github\.event\.pull_request\.number \|\| github\.event\.issue\.number \}\}/,
    );
    const cancellation = workflow.match(
      /cancel-in-progress: \$\{\{ (.*?) \}\}/,
    )?.[1];
    expect(cancellation).toBe("github.event_name == 'pull_request'");
    for (const eventName of [
      "pull_request",
      "issue_comment",
      "pull_request_review_comment",
    ])
      expect(
        runInNewContext(cancellation, { github: { event_name: eventName } }),
      ).toBe(eventName === "pull_request");
    expect(authorize("read", issueComment)).toBe(false);
  });
  it("exports the guarded prompt only after successful command substitution", () => {
    expect(workflow).not.toContain('export PROMPT="$(');
    expect(workflow).toMatch(
      /PROMPT="\$\(node <<'NODE'[\s\S]*?\r?\n\s+NODE\r?\n\s+\)"\r?\n\s+export PROMPT\r?\n\s+opencode github run/,
    );
    expect(workflow).toContain("shell: bash");
  });
  it("stops before OpenCode when prompt preparation fails and preserves the guard on success", () => {
    const directory = mkdtempSync(join(tmpdir(), "quilla-prompt-"));
    const eventPath = join(directory, "event.json");
    const marker = join(directory, "called.txt");
    const bash =
      process.platform === "win32"
        ? join(
            process.env.ProgramFiles || "C:/Program Files",
            "Git",
            "bin",
            "bash.exe",
          )
        : "bash";
    const script = workflow
      .slice(workflow.lastIndexOf("        run: |") + "        run: |".length)
      .split(/\r?\n/)
      .map((line) => line.replace(/^ {10}/, ""))
      .join("\n")
      .replace(
        "node <<'NODE'",
        `"${process.execPath.replaceAll("\\", "/")}" <<'NODE'`,
      );
    try {
      writeFileSync(eventPath, "{");
      const options = {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: eventPath,
          PROMPT: "GUARDED INSTRUCTIONS",
          OUTPUT_MARKER: marker.replaceAll("\\", "/"),
        },
        timeout: 10000,
      };
      const stub = 'opencode() { printf "%s" "$PROMPT" > "$OUTPUT_MARKER"; }\n';
      const failed = spawnSync(
        bash,
        ["-e", "-o", "pipefail", "-c", stub + script],
        options,
      );
      expect(failed.error).toBeUndefined();
      expect(failed.status).not.toBe(0);
      expect(existsSync(marker)).toBe(false);
      writeFileSync(
        eventPath,
        JSON.stringify({ comment: { body: "/oc $(do-not-execute)" } }),
      );
      const succeeded = spawnSync(
        bash,
        ["-e", "-o", "pipefail", "-c", stub + script],
        options,
      );
      expect(succeeded.error).toBeUndefined();
      expect(succeeded.status, succeeded.stderr).toBe(0);
      expect(readFileSync(marker, "utf8")).toContain(
        'GUARDED INSTRUCTIONS\n\nUNTRUSTED REQUEST DATA:\n{"comment":"/oc $(do-not-execute)"',
      );
    } finally {
      if (existsSync(marker)) unlinkSync(marker);
      if (existsSync(eventPath)) unlinkSync(eventPath);
      rmdirSync(directory);
    }
  });
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

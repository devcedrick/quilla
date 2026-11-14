import { describe, expect, it } from "vitest";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { changeWorkflow } from "./questionLifecycle";

function version(id = "questionVersions:1"): Doc<"questionVersions"> {
  return {
    _id: id as Id<"questionVersions">,
    state: "draft",
    workflowRevision: 1,
  } as Doc<"questionVersions">;
}

function fakeContext(writes: string[]) {
  const admin = {
    _id: "users:admin" as Id<"users">,
    tokenIdentifier: "https://test|admin",
    role: "admin",
    status: "active",
  } as Doc<"users">;
  return {
    auth: {
      getUserIdentity: async () => ({
        tokenIdentifier: admin.tokenIdentifier,
      }),
    },
    db: {
      query: () => ({
        withIndex: () => ({
          unique: async () => admin,
        }),
      }),
      patch: async () => {
        writes.push("patch");
      },
      insert: async () => {
        writes.push("insert");
        return "auditEvents:1" as Id<"auditEvents">;
      },
    },
  } as unknown as MutationCtx;
}

describe("changeWorkflow", () => {
  it("prepares the audit before patching and inserts it after", async () => {
    const writes: string[] = [];
    await expect(
      changeWorkflow(fakeContext(writes), version(), "submit"),
    ).resolves.toBe(2);
    expect(writes).toEqual(["patch", "insert"]);
  });

  it("does not patch when the audit cannot be prepared", async () => {
    const writes: string[] = [];
    await expect(
      changeWorkflow(fakeContext(writes), version("x".repeat(257)), "submit"),
    ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
    expect(writes).toEqual([]);
  });
});

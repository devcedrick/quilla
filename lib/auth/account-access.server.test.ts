import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  token: vi.fn(),
  query: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./session.server", () => ({ requireVerifiedSession: mocks.session }));
vi.mock("convex/nextjs", () => ({ fetchQuery: mocks.query }));

import { api } from "@/convex/_generated/api";
import { readAccountAccess } from "./account-access.server";

describe("server application access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({
      userId: "clerk-a",
      getToken: mocks.token,
    });
    mocks.token.mockResolvedValue("synthetic-identity-token");
    mocks.query.mockResolvedValue({ status: "missing_profile" });
  });

  it("forwards a verified Convex token without exposing it in the result", async () => {
    expect(await readAccountAccess("/dashboard")).toEqual({
      clerkUserId: "clerk-a",
      access: { status: "missing_profile" },
    });
    expect(mocks.session).toHaveBeenCalledWith("/dashboard");
    expect(mocks.token).toHaveBeenCalledWith({ template: "convex" });
    expect(mocks.query).toHaveBeenCalledWith(
      api.users.currentAccess,
      {},
      { token: "synthetic-identity-token" },
    );
  });

  it("preserves the session redirect and never calls Convex for signed-out callers", async () => {
    const redirect = new Error("NEXT_REDIRECT");
    mocks.session.mockRejectedValue(redirect);
    await expect(readAccountAccess("/admin")).rejects.toBe(redirect);
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(["token", "query", "missing-token"])(
    "fails closed for %s without leaking details",
    async (failure) => {
      if (failure === "token")
        mocks.token.mockRejectedValue(new Error("synthetic private payload"));
      if (failure === "query")
        mocks.query.mockRejectedValue(new Error("synthetic private payload"));
      if (failure === "missing-token") mocks.token.mockResolvedValue(null);
      await expect(readAccountAccess("/dashboard")).rejects.toThrow(
        /^Account access is temporarily unavailable\. Please try again\.$/,
      );
      if (failure !== "query") expect(mocks.query).not.toHaveBeenCalled();
    },
  );

  it("does not reuse a previous caller's access decision", async () => {
    mocks.query
      .mockResolvedValueOnce({ status: "suspended" })
      .mockResolvedValueOnce({ status: "missing_profile" });
    expect((await readAccountAccess("/dashboard")).access.status).toBe(
      "suspended",
    );
    mocks.session.mockResolvedValue({
      userId: "clerk-b",
      getToken: mocks.token,
    });
    expect(await readAccountAccess("/dashboard")).toEqual({
      clerkUserId: "clerk-b",
      access: { status: "missing_profile" },
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ jwtTemplates: { list: mocks.list } }),
}));
vi.mock("@clerk/testing/playwright", () => ({
  setupClerkTestingToken: vi.fn(),
}));
// Import only the prerequisite check, without registering Playwright fixtures in Vitest.
vi.mock("@playwright/test", () => ({
  test: { extend: vi.fn() },
  expect: vi.fn(),
}));

import { verifyConvexTemplate } from "../e2e/support/clerk";

describe("development Convex JWT prerequisite", () => {
  beforeEach(() => {
    mocks.list.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_synthetic_only");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_synthetic_only");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the Convex template and audience", async () => {
    mocks.list.mockResolvedValue({
      data: [{ name: "convex", claims: { aud: "convex" } }],
      totalCount: 1,
    });
    await expect(verifyConvexTemplate()).resolves.toBeUndefined();
  });
  it("checks later pages without modifying provider settings", async () => {
    mocks.list
      .mockResolvedValueOnce({
        data: [{ name: "other", claims: {} }],
        totalCount: 2,
      })
      .mockResolvedValueOnce({
        data: [{ name: "convex", claims: { aud: "convex" } }],
        totalCount: 2,
      });
    await verifyConvexTemplate();
    expect(mocks.list).toHaveBeenLastCalledWith({ limit: 100, offset: 1 });
  });
  it("fails clearly for a missing template before fixtures are created", async () => {
    mocks.list.mockResolvedValue({ data: [], totalCount: 0 });
    await expect(verifyConvexTemplate()).rejects.toThrow(
      "template named convex with audience convex",
    );
  });
  it.each([{}, { aud: "different" }])(
    "rejects invalid audience %j",
    async (claims) => {
      mocks.list.mockResolvedValue({
        data: [{ name: "convex", claims }],
        totalCount: 1,
      });
      await expect(verifyConvexTemplate()).rejects.toThrow("Could not verify");
    },
  );
  it("sanitizes provider failures", async () => {
    mocks.list.mockRejectedValue(new Error("synthetic private response"));
    await expect(verifyConvexTemplate()).rejects.toThrow(
      /^Could not verify the development Clerk convex JWT template \(provider details redacted\)\.$/,
    );
  });
  it("refuses live credentials before contacting Clerk", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "sk_live_synthetic_only");
    await expect(verifyConvexTemplate()).rejects.toThrow("Could not verify");
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

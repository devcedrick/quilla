import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeReturnTo, signInDestination } from "./routes";
import { validateClerkConfiguration } from "./configuration";
import { hasActiveSession } from "./session-state";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  configuration: vi.fn(),
  redirect: vi.fn(),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("./configuration.server", () => ({
  getClerkConfiguration: mocks.configuration,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { readSession, requireSession } from "./session.server";

describe("return destinations", () => {
  it.each(["/onboarding", "/account/preferences", "/diagnostic"])(
    "allows the exact preparation route %s",
    (destination) => {
      expect(safeReturnTo(`${destination}?from=account#form`)).toBe(
        `${destination}?from=account#form`,
      );
      expect(safeReturnTo(`${destination}/unexpected`)).toBe("/dashboard");
      expect(safeReturnTo(`https://evil.example${destination}`)).toBe(
        "/dashboard",
      );
    },
  );
  it("preserves known relative destinations including query and fragment", () => {
    expect(safeReturnTo("/dashboard?from=exam#account")).toBe(
      "/dashboard?from=exam#account",
    );
    expect(safeReturnTo("/admin/questions")).toBe("/admin/questions");
  });
  it("accepts an absolute destination only on the supplied origin", () => {
    expect(
      safeReturnTo(
        "https://quilla.example/dashboard?x=1",
        "https://quilla.example",
      ),
    ).toBe("/dashboard?x=1");
  });
  it.each([
    undefined,
    ["/admin"],
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "javascript:alert(1)",
    "/sign-in",
    "/sign-up/verify-email-address",
    "/api/users",
    "/dashboard-evil",
    "/dashboard/../../sign-in",
    "/dashboard/%2f%2fevil.example",
    "/dashboard/%5cevil",
    "/dashboard/%",
    "/dashboard\n",
    "/dashboard\\evil",
    "/dashboard/%00",
    "https://user:pass@quilla.example/dashboard",
  ])("falls back for unsafe or unsupported input %j", (value) => {
    expect(safeReturnTo(value, "https://quilla.example")).toBe("/dashboard");
  });
  it("encodes a return destination in the internal sign-in URL", () => {
    expect(signInDestination("/dashboard?x=1")).toBe(
      "/sign-in?redirect_url=%2Fdashboard%3Fx%3D1",
    );
  });
});

describe("Clerk configuration", () => {
  const valid = {
    publishableKey: `pk_test_${Buffer.from("unit-test.example.invalid$").toString("base64")}`,
    secretKey: "sk_test_synthetic_only",
  };
  it("returns public configuration only", () => {
    expect(validateClerkConfiguration(valid)).toEqual({
      publishableKey: valid.publishableKey,
    });
  });
  it.each([undefined, "", "not-a-key", "sk_test_wrong-kind"])(
    "rejects a missing or invalid publishable key",
    (publishableKey) => {
      expect(() =>
        validateClerkConfiguration({ ...valid, publishableKey }),
      ).toThrow("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    },
  );
  it("redacts invalid secret values and rejects mismatched environments", () => {
    expect(() =>
      validateClerkConfiguration({ ...valid, secretKey: "do-not-echo" }),
    ).toThrow(/^Missing or invalid CLERK_SECRET_KEY$/);
    expect(() =>
      validateClerkConfiguration({ ...valid, secretKey: "sk_live_synthetic" }),
    ).toThrow("environments must match");
  });
});

describe("verified session decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirected");
    });
  });
  it("returns the narrow identity only for a verified active session", async () => {
    mocks.auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_a",
      sessionStatus: "active",
      sessionClaims: { secret: "not-returned" },
    });
    expect(await requireSession("/dashboard")).toEqual({ userId: "user_a" });
    expect(mocks.auth).toHaveBeenCalledWith({ treatPendingAsSignedOut: true });
  });
  it.each(["pending", "expired", "revoked", "ended", "abandoned", undefined])(
    "denies non-active state %s",
    async (sessionStatus) => {
      mocks.auth.mockResolvedValue({
        isAuthenticated: true,
        userId: "user_a",
        sessionStatus,
      });
      await expect(requireSession("/dashboard")).rejects.toThrow("redirected");
      expect(mocks.redirect).toHaveBeenCalledWith(
        "/sign-in?redirect_url=%2Fdashboard",
      );
    },
  );
  it("denies missing identity even if a caller reports authenticated", () => {
    expect(
      hasActiveSession({
        isAuthenticated: true,
        userId: null,
        sessionStatus: "active",
      }),
    ).toBe(false);
    expect(
      hasActiveSession({
        isAuthenticated: false,
        userId: "user_a",
        sessionStatus: "active",
      }),
    ).toBe(false);
  });
  it("preserves the protected request path and query through sign-in", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false });
    mocks.headers.mockResolvedValueOnce(
      new Headers({ "x-quilla-return-to": "/admin/questions?from=test" }),
    );
    await expect(requireSession("/admin")).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/sign-in?redirect_url=%2Fadmin%2Fquestions%3Ffrom%3Dtest",
    );
  });
  it("fails closed and redacts provider failures instead of redirecting in a loop", async () => {
    mocks.auth.mockRejectedValue(
      new Error("provider payload with sensitive details"),
    );
    await expect(readSession()).rejects.toThrow(
      /^Account access is temporarily unavailable\. Please try again\.$/,
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

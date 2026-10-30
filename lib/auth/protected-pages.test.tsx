import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import {
  PreparationPage,
  PreparationResource,
} from "@/components/preparation/preparation-page";
import { PreparationSkeleton } from "@/components/preparation/preparation-skeleton";
import AdminPage from "@/app/admin/[[...path]]/page";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("./account-access.server", () => ({
  readAccountAccess: mocks.access,
  readPreparationAccess: mocks.access,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/components/preparation/preparation-content", () => ({
  PreparationContent: () => (
    <p data-testid="account-status">Authorized preparation content</p>
  ),
}));
vi.mock("@/components/auth/session-boundary", () => ({
  SessionBoundary: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/auth/application-access-boundary", () => ({
  ApplicationAccessBoundary: ({ children }: { children: ReactNode }) =>
    children,
}));
vi.mock("@/components/auth/sign-out", () => ({
  SignOut: () => <button>Sign out</button>,
}));

describe("protected resource server rendering", () => {
  it.each(["dashboard", "onboarding", "preferences", "diagnostic"] as const)(
    "uses the neutral branded streaming fallback for %s",
    (kind) => {
      const boundary = PreparationPage({ kind }).props.children;
      expect(boundary.props.fallback.type).toBe(PreparationSkeleton);
    },
  );
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`);
    });
  });
  async function dashboard() {
    return renderToStaticMarkup(
      await PreparationResource({ kind: "dashboard" }),
    );
  }
  async function admin() {
    const render = AdminPage().props.children
      .type as () => Promise<ReactElement>;
    return render();
  }
  it.each(["missing_profile", "suspended"])(
    "excludes dashboard payload for %s profiles",
    async (status) => {
      mocks.access.mockResolvedValue({
        clerkUserId: "clerk-a",
        access: { status },
      });
      expect(await dashboard()).not.toContain("account-status");
      expect(mocks.access).toHaveBeenCalledWith("/dashboard");
    },
  );
  it("renders the dashboard only after active profile authorization and onboarding", async () => {
    mocks.access.mockResolvedValue({
      clerkUserId: "clerk-a",
      access: { status: "active", userId: "profile-a", role: "user" },
      preferences: { preferredLevel: "professional", targetExamDate: null },
    });
    expect(await dashboard()).toContain("account-status");
    expect(await dashboard()).toContain("Authorized preparation content");
  });
  it.each(["dashboard", "preferences", "diagnostic"] as const)(
    "redirects incomplete %s before producing protected content",
    async (kind) => {
      mocks.access.mockResolvedValue({
        clerkUserId: "clerk-a",
        access: { status: "active", userId: "profile-a", role: "user" },
        preferences: { preferredLevel: null, targetExamDate: null },
      });
      await expect(PreparationResource({ kind })).rejects.toThrow(
        "NEXT_REDIRECT:/onboarding",
      );
    },
  );
  it("redirects completed onboarding back to the dashboard", async () => {
    mocks.access.mockResolvedValue({
      clerkUserId: "clerk-a",
      access: { status: "active", userId: "profile-a", role: "user" },
      preferences: { preferredLevel: "professional", targetExamDate: null },
    });
    await expect(PreparationResource({ kind: "onboarding" })).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });
  it("propagates access failures without producing dashboard content", async () => {
    mocks.access.mockRejectedValue(new Error("Unavailable"));
    await expect(dashboard()).rejects.toThrow("Unavailable");
  });
  it.each(["user", "admin"])(
    "keeps admin functionality unavailable to %s",
    async (role) => {
      mocks.access.mockResolvedValue({
        clerkUserId: "clerk-a",
        access: { status: "active", userId: "profile-a", role },
      });
      await expect(admin()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.access).toHaveBeenCalledWith("/admin");
    },
  );
});

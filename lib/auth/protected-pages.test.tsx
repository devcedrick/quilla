import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import DashboardPage from "@/app/dashboard/page";
import AdminPage from "@/app/admin/[[...path]]/page";

const mocks = vi.hoisted(() => ({ access: vi.fn(), notFound: vi.fn() }));
vi.mock("./account-access.server", () => ({ readAccountAccess: mocks.access }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
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
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });
  async function dashboard() {
    const render = DashboardPage().props.children.props.children
      .type as () => Promise<ReactElement>;
    return renderToStaticMarkup(await render());
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
  it("renders the temporary dashboard only after active profile authorization", async () => {
    mocks.access.mockResolvedValue({
      clerkUserId: "clerk-a",
      access: { status: "active", userId: "profile-a", role: "user" },
    });
    expect(await dashboard()).toContain("account-status");
    expect(await dashboard()).toContain("Your learning setup is coming next.");
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

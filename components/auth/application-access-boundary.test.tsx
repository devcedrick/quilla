import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentAccess } from "@/convex/lib/userAccess";
import type { Id } from "@/convex/_generated/dataModel";
import { ApplicationAccessBoundary } from "./application-access-boundary";
import { SessionBoundary } from "./session-boundary";

// Navigation behavior is exercised in Playwright; isolate Link's browser effects here.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mocks = vi.hoisted(() => ({
  convex: { isLoading: false, isAuthenticated: true },
  clerk: { isLoaded: true, isSignedIn: true, userId: "clerk-a" },
  access: undefined as CurrentAccess | undefined,
  error: false,
  ensure: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.convex,
  useQuery: (...args: unknown[]) => {
    mocks.query(...args);
    if (mocks.error) throw new Error("Synthetic unavailable provider");
    return mocks.access;
  },
  useMutation: () => mocks.ensure,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.clerk,
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));

const userId = "profile-a" as Id<"users">;
let view: ReactTestRenderer | undefined;
function tree(expectedUserId: Id<"users"> | null = userId) {
  return (
    <SessionBoundary userId="clerk-a">
      <ApplicationAccessBoundary expectedUserId={expectedUserId ?? undefined}>
        <p>Protected learning content</p>
      </ApplicationAccessBoundary>
    </SessionBoundary>
  );
}
async function render(expectedUserId: Id<"users"> | null = userId) {
  await act(async () => {
    view = create(tree(expectedUserId));
  });
}
function text() {
  return JSON.stringify(view?.toJSON());
}

describe("reactive application access", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.convex = { isLoading: false, isAuthenticated: true };
    mocks.clerk = { isLoaded: true, isSignedIn: true, userId: "clerk-a" };
    mocks.access = { status: "active", userId, role: "user" };
    mocks.error = false;
    mocks.ensure.mockResolvedValue({ status: "active", userId, role: "user" });
  });
  afterEach(async () => {
    await act(async () => view?.unmount());
  });

  it("shows content only for matching active server and client profiles", async () => {
    await render();
    expect(text()).toContain("Protected learning content");
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it.each(["loading", "unauthenticated", "no-result", "different-profile"])(
    "hides content when %s",
    async (state) => {
      if (state === "loading") mocks.convex.isLoading = true;
      if (state === "unauthenticated") mocks.convex.isAuthenticated = false;
      if (state === "no-result") mocks.access = undefined;
      if (state === "different-profile")
        mocks.access = {
          status: "active",
          userId: "profile-b" as Id<"users">,
          role: "admin",
        };
      await render();
      expect(text()).not.toContain("Protected learning content");
      expect(mocks.ensure).not.toHaveBeenCalled();
      if (state === "loading" || state === "unauthenticated")
        expect(mocks.query).toHaveBeenCalledWith(expect.anything(), "skip");
      if (state === "different-profile")
        expect(mocks.refresh).toHaveBeenCalledOnce();
    },
  );
  it("replaces an open page with a suspension notice without signing out or redirect loops", async () => {
    await render();
    mocks.access = { status: "suspended" };
    await act(async () => view!.update(tree()));
    expect(text()).not.toContain("Protected learning content");
    expect(text()).toContain("Your Quilla account is suspended.");
    expect(text()).toContain("Sign out");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("hides stale content on Clerk identity changes and session loss", async () => {
    await render();
    mocks.clerk.userId = "clerk-b";
    await act(async () => view!.update(tree()));
    expect(text()).not.toContain("Protected learning content");
    mocks.clerk.isSignedIn = false;
    await act(async () => view!.update(tree()));
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("/sign-in?"),
    );
  });
  it("bootstraps once and refreshes without exposing server content prematurely", async () => {
    mocks.access = { status: "missing_profile" };
    await render(null);
    await act(async () => view!.update(tree(null)));
    expect(mocks.ensure).toHaveBeenCalledExactlyOnceWith({});
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(text()).not.toContain("Protected learning content");
    mocks.access = { status: "active", userId, role: "user" };
    await act(async () => view!.update(tree(null)));
    expect(text()).not.toContain("Protected learning content");
    await act(async () => view!.update(tree(userId)));
    expect(text()).toContain("Protected learning content");
    expect(mocks.ensure).toHaveBeenCalledOnce();
  });
  it("reauthorizes an initially suspended page before showing unsuspended content", async () => {
    mocks.access = { status: "suspended" };
    await render(null);
    expect(text()).toContain("Your Quilla account is suspended.");
    mocks.access = { status: "active", userId, role: "user" };
    await act(async () => view!.update(tree(null)));
    expect(text()).not.toContain("Protected learning content");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    await act(async () => view!.update(tree(userId)));
    expect(text()).toContain("Protected learning content");
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("offers a working retry after failed bootstrap", async () => {
    mocks.access = { status: "missing_profile" };
    mocks.ensure.mockRejectedValueOnce(
      new Error("Synthetic unavailable provider"),
    );
    await render();
    expect(text()).toContain("We could not verify account access.");
    await act(async () => {
      view!.root.findByProps({ children: "Try again" }).props.onClick();
    });
    expect(mocks.ensure).toHaveBeenCalledTimes(2);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(text()).not.toContain("Protected learning content");
  });
  it("sanitizes query failures and remounts the failed boundary on retry", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      await render();
      expect(text()).toContain("Protected learning content");
      mocks.error = true;
      await act(async () => view!.update(tree()));
      expect(text()).toContain("We could not verify account access.");
      expect(text()).not.toContain("Synthetic unavailable provider");
      expect(text()).not.toContain("Protected learning content");
      mocks.error = false;
      await act(async () => {
        view!.root.findByProps({ children: "Try again" }).props.onClick();
      });
      expect(text()).toContain("Protected learning content");
      expect(mocks.refresh).toHaveBeenCalledOnce();
    } finally {
      consoleError.mockRestore();
    }
  });
});

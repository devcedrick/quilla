import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), connection: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./session.server", () => ({ readSession: mocks.session }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
import { readLandingSession } from "./landing-session.server";

describe("public landing session", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({
      isAuthenticated: true,
      userId: "synthetic-a",
      sessionStatus: "active",
      getToken: vi.fn(),
    });
  });
  it("returns only a navigation state, without fetching a token or profile", async () => {
    const state = await readLandingSession();
    expect(state).toBe("signed_in");
    expect(mocks.session.mock.results[0]).toBeDefined();
    const session = await mocks.session.mock.results[0].value;
    expect(session.getToken).not.toHaveBeenCalled();
    expect(mocks.connection).toHaveBeenCalledOnce();
  });
  it.each([null, "pending", "expired", "invalid"])(
    "does not recognize a %s session as active",
    async (sessionStatus) => {
      mocks.session.mockResolvedValue({
        isAuthenticated: true,
        userId: "synthetic-a",
        sessionStatus,
      });
      expect(await readLandingSession()).toBe("signed_out");
    },
  );
  it("does not redirect a visitor without a session", async () => {
    mocks.session.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await readLandingSession()).toBe("signed_out");
  });
  it("sanitizes configuration and provider failures into usable navigation", async () => {
    mocks.session.mockRejectedValue(
      new Error("synthetic private provider details"),
    );
    expect(await readLandingSession()).toBe("unavailable");
  });
  it("does not swallow framework prerender suspension", async () => {
    const suspension = new Error("framework suspension");
    mocks.connection.mockRejectedValue(suspension);
    await expect(readLandingSession()).rejects.toBe(suspension);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("does not retain a previous render's identity decision outside an RSC request", async () => {
    // React's cache is request-scoped and inactive outside a server render.
    expect(await readLandingSession()).toBe("signed_in");
    mocks.session.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await readLandingSession()).toBe("signed_out");
  });
});

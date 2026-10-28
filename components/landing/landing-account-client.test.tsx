// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingAccountClient } from "./landing-account-client";
import { LandingAccountView } from "./landing-account-view";
import {
  landingAction,
  type LandingPlacement,
  type LandingSessionState,
} from "@/lib/auth/landing-action";

const provider = vi.hoisted(() => ({
  state: "loaded",
  signedIn: false,
  auth: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: (options: unknown) => {
    provider.auth(options);
    return {
      isLoaded: provider.state === "loaded",
      isSignedIn: provider.signedIn,
    };
  },
  useClerk: () => ({
    status:
      provider.state === "failed"
        ? "error"
        : provider.state === "loading"
          ? "loading"
          : "ready",
  }),
}));

let root: Root | undefined;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  provider.state = "loaded";
  provider.signedIn = false;
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("landing action contract", () => {
  it.each(["header", "hero", "closing"] as const)(
    "keeps usable and consistent %s links for every state",
    (placement) => {
      for (const state of ["signed_out", "signed_in", "unavailable"] as const) {
        const action = landingAction(state, placement);
        const container = document.createElement("div");
        container.innerHTML = renderToString(
          <LandingAccountView state={state} placement={placement} />,
        );
        const primary = [...container.querySelectorAll("a")].find((link) =>
          link.textContent?.includes(action.label),
        );
        expect(primary?.getAttribute("href")).toBe(
          state === "signed_out" ? "/sign-up" : "/dashboard",
        );
        expect(primary?.getAttribute("tabindex")).not.toBe("-1");
        expect(container.querySelector("button")).toBeNull();
        if (state === "signed_in")
          expect(container.querySelector('a[href="/sign-in"]')).toBeNull();
        if (state === "unavailable" && placement !== "hero")
          expect(container.querySelector('a[href="/sign-in"]')).not.toBeNull();
      }
    },
  );
  it("keeps signed-out wording and truthful authenticated closing copy", () => {
    expect(landingAction("signed_out", "hero").label).toBe(
      "Create your account",
    );
    expect(landingAction("signed_out", "closing").label).toBe(
      "Start preparing",
    );
    expect(landingAction("signed_in", "closing").description).toBe(
      "Return to your account and continue from where Quilla is available today.",
    );
  });
});

describe("landing hydration and live state", () => {
  it.each(["header", "hero", "closing"] as const)(
    "preserves a focused %s primary link when Clerk finishes loading",
    async (placement) => {
      provider.state = "loading";
      const container = document.createElement("div");
      document.body.append(container);
      root = createRoot(container);
      const render = async () => {
        await act(async () =>
          root!.render(
            <LandingAccountClient
              initialState="signed_out"
              placement={placement}
            />,
          ),
        );
      };
      await render();
      const primary =
        container.querySelector<HTMLAnchorElement>('a[href="/sign-up"]')!;
      primary.focus();
      expect(document.activeElement).toBe(primary);
      provider.state = "loaded";
      await render();
      expect(container.querySelector('a[href="/sign-up"]')).toBe(primary);
      expect(document.activeElement).toBe(primary);
      provider.signedIn = true;
      await render();
      expect(container.querySelector('a[href="/dashboard"]')).toBe(primary);
      expect(document.activeElement).toBe(primary);
    },
  );
  it.each(["header", "hero", "closing"] as const)(
    "hydrates the %s action despite a session change before hydration",
    async (placement) => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <LandingAccountClient
          initialState="signed_out"
          placement={placement}
        />,
      );
      document.body.append(container);
      expect(container.querySelector('a[href="/sign-up"]')).not.toBeNull();
      provider.signedIn = true;
      const recoverable = vi.fn();
      await act(async () => {
        root = hydrateRoot(
          container,
          <LandingAccountClient
            initialState="signed_out"
            placement={placement}
          />,
          { onRecoverableError: recoverable },
        );
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
      expect(container.textContent).not.toContain("Create your account");
      expect(provider.auth).toHaveBeenCalledWith({
        treatPendingAsSignedOut: true,
      });
    },
  );
  it.each(["signed_out", "signed_in", "unavailable"] as const)(
    "preserves the %s server snapshot while Clerk is loading",
    async (initialState) => {
      provider.state = "loading";
      const container = document.createElement("div");
      await act(async () => {
        root = createRoot(container);
        root.render(
          <LandingAccountClient initialState={initialState} placement="hero" />,
        );
      });
      expect(container.textContent).toContain(
        landingAction(initialState, "hero").label,
      );
    },
  );
  it("reconciles sign-in, account switching and sign-out without a reload", async () => {
    const container = document.createElement("div");
    const render = async (
      state: LandingSessionState = "signed_out",
      placement: LandingPlacement = "header",
    ) => {
      await act(async () =>
        root!.render(
          <LandingAccountClient initialState={state} placement={placement} />,
        ),
      );
    };
    root = createRoot(container);
    await render();
    expect(container.querySelector('a[href="/sign-up"]')).not.toBeNull();
    provider.signedIn = true;
    await render();
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    // The same minimal state represents another signed-in identity; no PII is retained.
    await render("signed_in");
    expect(container.querySelectorAll("a")).toHaveLength(1);
    provider.signedIn = false;
    await render("signed_in");
    expect(container.querySelector('a[href="/sign-up"]')).not.toBeNull();
  });
  it("keeps failure local and provides working account and sign-in links", async () => {
    provider.state = "failed";
    const container = document.createElement("div");
    await act(async () => {
      root = createRoot(container);
      root.render(
        <LandingAccountClient initialState="signed_in" placement="closing" />,
      );
    });
    expect(container.textContent).toContain("Open your account");
    expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
    expect(container.querySelector('a[href="/sign-in"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/token|exception|Clerk/);
  });

  it("contains a thrown client hook failure without replacing public content", async () => {
    provider.auth.mockImplementation(() => {
      throw new Error("synthetic provider failure");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    try {
      await act(async () => {
        root = createRoot(container);
        root.render(
          <>
            <h1>Public landing content</h1>
            <LandingAccountClient initialState="signed_in" placement="header" />
          </>,
        );
      });
      expect(container.querySelector("h1")?.textContent).toBe(
        "Public landing content",
      );
      expect(container.textContent).toContain("Open your account");
      expect(container.textContent).not.toContain("synthetic provider failure");
    } finally {
      provider.auth.mockReset();
      errorLog.mockRestore();
    }
  });
});

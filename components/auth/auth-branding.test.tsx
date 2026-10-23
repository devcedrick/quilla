import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPageShell } from "./auth-page-shell";
import { AuthForm } from "./auth-form";
import { clerkAppearance } from "./clerk-appearance";
import { WelcomeMascot } from "./welcome-mascot";
import { AuthFormSkeleton } from "./auth-form-skeleton";

const provider = vi.hoisted(() => ({
  state: "loaded" as "loaded" | "loading" | "failed" | "mounting",
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@clerk/nextjs", () => ({
  ClerkLoaded: ({ children }: { children: React.ReactNode }) =>
    provider.state === "loaded" || provider.state === "mounting"
      ? children
      : null,
  ClerkLoading: ({ children }: { children: React.ReactNode }) =>
    provider.state === "loading" ? children : null,
  ClerkFailed: ({ children }: { children: React.ReactNode }) =>
    provider.state === "failed" ? children : null,
  SignIn: (props: Record<string, unknown>) => {
    provider.signIn(props);
    if (provider.state === "mounting") return props.fallback as React.ReactNode;
    return <div>Managed sign-in form</div>;
  },
  SignUp: (props: Record<string, unknown>) => {
    provider.signUp(props);
    if (provider.state === "mounting") return props.fallback as React.ReactNode;
    return <div>Managed sign-up form</div>;
  },
}));

describe("account branding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    provider.state = "loaded";
  });

  it.each(["auth", "compact"] as const)(
    "keeps navigation and legal content in the %s shell",
    (layout) => {
      const html = renderToStaticMarkup(
        <AuthPageShell title="Account" layout={layout}>
          <p>Account content</p>
        </AuthPageShell>,
      );
      expect(html).toContain(`data-account-layout="${layout}"`);
      expect(html).toContain('class="paper-grid ');
      expect(html).toContain('href="#main-content"');
      expect(html).toContain('id="main-content"');
      expect(html).toContain('href="/"');
      expect(html.includes('aria-label="Account navigation"')).toBe(
        layout === "compact",
      );
      if (layout === "compact") {
        expect(html).toContain('href="/sign-in"');
        expect(html).toContain('href="/sign-up"');
        expect(html).toContain('href="/dashboard"');
      }
      expect(html).toContain("not affiliated with");
      expect(html).toContain("Philippine Civil Service Commission");
      expect(html).toContain('alt=""');
      expect(html).toContain('aria-hidden="true"');
      expect(html.includes("kuwi-auth-welcome.svg")).toBe(layout === "auth");
    },
  );

  it("server-renders the approved pose without animation layers or controls", () => {
    const html = renderToStaticMarkup(<WelcomeMascot />);
    expect(html).toContain('src="/brand/kuwi/kuwi-auth-welcome.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<style");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("animation");
  });

  it("defaults to compact without welcome copy on account/status surfaces", () => {
    const html = renderToStaticMarkup(
      <AuthPageShell title="Account">
        <p>Status</p>
      </AuthPageShell>,
    );
    expect(html).toContain('data-account-layout="compact"');
    expect(html).not.toContain("A steady start.");
    expect(html).not.toContain("kuwi-auth-welcome.svg");
  });

  it("uses one composition with an accessible, visually hidden shell title only for auth", () => {
    const auth = renderToStaticMarkup(
      <AuthPageShell title="Welcome back" layout="auth">
        <p>Form</p>
      </AuthPageShell>,
    );
    const compact = renderToStaticMarkup(
      <AuthPageShell title="Your account">
        <p>Status</p>
      </AuthPageShell>,
    );
    expect(auth).toContain('data-testid="account-composition"');
    expect(auth).toMatch(/id="account-title" class="[^"]*sr-only/);
    expect(compact).not.toMatch(/id="account-title" class="[^"]*sr-only/);
    expect(auth).not.toContain("border-2");
    expect(auth).not.toContain("A little focus. A fresh beginning.");
    expect(auth).toMatch(
      /data-testid="auth-mascot-backdrop" class="[^"]*aspect-square/,
    );
    expect(auth).not.toContain("inset-[10%]");
  });

  it("does not apply text-field dimensions to Clerk checkboxes or radios", () => {
    expect(clerkAppearance.elements.formFieldInput).not.toHaveProperty(
      "minHeight",
    );
    expect(clerkAppearance.elements.formFieldInput).not.toHaveProperty(
      "padding",
    );
    expect(
      clerkAppearance.elements.formFieldInput[
        "&:not([type=checkbox]):not([type=radio])"
      ],
    ).toMatchObject({ minHeight: "3rem", padding: "0.75rem 0.875rem" });
  });
  it("aligns account-switch text and links on a shared, wrapping baseline", () => {
    expect(clerkAppearance.elements.footerAction).toMatchObject({
      alignItems: "baseline",
      justifyContent: "center",
      flexWrap: "wrap",
      columnGap: "0.25rem",
    });
    const { footerActionText: text, footerActionLink: link } =
      clerkAppearance.elements;
    expect(text.fontSize).toBe(link.fontSize);
    expect(text.lineHeight).toBe(link.lineHeight);
    expect(link).toMatchObject({ padding: 0, textDecoration: "underline" });
  });

  it.each(["sign-in", "sign-up"] as const)(
    "applies shared appearance without changing %s routing",
    (mode) => {
      renderToStaticMarkup(
        <AuthForm mode={mode} destination="/dashboard?from=exam" />,
      );
      const called = mode === "sign-in" ? provider.signIn : provider.signUp;
      expect(called).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          appearance: clerkAppearance,
          fallback: expect.objectContaining({
            type: AuthFormSkeleton,
            props: { mode },
          }),
          routing: "path",
          path: `/${mode}`,
          forceRedirectUrl: "/dashboard?from=exam",
        }),
      );
      expect(
        mode === "sign-in" ? provider.signUp : provider.signIn,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(["loading", "failed"] as const)(
    "keeps %s state accessible without rendering credential controls",
    (state) => {
      provider.state = state;
      const html = renderToStaticMarkup(
        <AuthForm mode="sign-in" destination="/dashboard" />,
      );
      expect(html).toContain(
        `role="${state === "loading" ? "status" : "alert"}"`,
      );
      expect(html).not.toContain("Managed sign-in form");
      expect(provider.signIn).not.toHaveBeenCalled();
      expect(provider.signUp).not.toHaveBeenCalled();
      expect(html.includes('data-testid="auth-form-skeleton"')).toBe(
        state === "loading",
      );
    },
  );
  it.each(["sign-in", "sign-up"] as const)(
    "keeps a skeleton while the loaded provider mounts %s",
    (mode) => {
      provider.state = "mounting";
      const html = renderToStaticMarkup(
        <AuthForm mode={mode} destination="/dashboard" />,
      );
      expect(html).toContain('data-testid="auth-form-skeleton"');
      expect(html).toContain(`data-mode="${mode}"`);
      expect(html).not.toContain("Managed sign-");
      expect(html).not.toContain("<input");
    },
  );
});

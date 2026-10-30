import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { SignOut } from "./sign-out";

const provider = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({
  SignOutButton: ({
    children,
    redirectUrl,
  }: {
    children: ReactNode;
    redirectUrl: string;
  }) => {
    provider.signOut(redirectUrl);
    return children;
  },
}));

describe("sign-out presentation", () => {
  it.each(["button", "text"] as const)(
    "never submits an enclosing setup form in %s mode",
    (variant) => {
      const html = renderToStaticMarkup(
        <form>
          <SignOut variant={variant} />
        </form>,
      );
      expect(html).toContain('type="button"');
      expect(html).not.toContain('type="submit"');
      expect(provider.signOut).toHaveBeenLastCalledWith("/");
      expect(html.includes("bg-primary")).toBe(variant === "button");
    },
  );
});

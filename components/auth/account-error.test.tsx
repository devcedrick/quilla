import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AdminError from "@/app/admin/error";
import DashboardError from "@/app/dashboard/error";
import SignInError from "@/app/sign-in/error";
import SignUpError from "@/app/sign-up/error";

function retryHandler(node: ReactNode): (() => void) | undefined {
  for (const child of Children.toArray(node)) {
    if (
      !isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)
    ) {
      continue;
    }
    if (child.type === "button" && child.props.children === "Try again") {
      return child.props.onClick;
    }
    const handler = retryHandler(child.props.children);
    if (handler) return handler;
  }
}

describe("account error recovery", () => {
  it.each([
    ["sign-in", SignInError],
    ["sign-up", SignUpError],
    ["dashboard", DashboardError],
    ["admin", AdminError],
  ] as const)(
    "delegates %s recovery to the server-segment retry",
    (_route, ErrorPage) => {
      const retry = vi.fn();
      const reset = vi.fn();
      const props = { retry, reset };
      const view = ErrorPage(props);
      const handler = retryHandler(view);

      expect(handler).toBeTypeOf("function");
      handler?.();
      expect(retry).toHaveBeenCalledOnce();
      expect(reset).not.toHaveBeenCalled();
    },
  );

  it("keeps provider details and protected content out of the fallback", () => {
    const props = {
      retry: vi.fn(),
      reset: vi.fn(),
      error: new Error("sensitive provider payload"),
    };
    const html = renderToStaticMarkup(DashboardError(props));

    expect(html).toContain("Account access is unavailable");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
    expect(html).not.toContain(props.error.message);
    expect(html).not.toContain('data-testid="account-status"');
    expect(props.retry).not.toHaveBeenCalled();
    expect(props.reset).not.toHaveBeenCalled();
  });
});

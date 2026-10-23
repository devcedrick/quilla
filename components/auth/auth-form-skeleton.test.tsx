import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthFormSkeleton } from "./auth-form-skeleton";

describe("auth loading skeleton", () => {
  it.each(["sign-in", "sign-up"] as const)(
    "keeps %s placeholders decorative and non-interactive",
    (mode) => {
      const html = renderToStaticMarkup(<AuthFormSkeleton mode={mode} />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("motion-safe:animate-pulse");
      expect(html).toContain("motion-reduce:animate-none");
      expect(html).not.toMatch(/<(input|button|label|form|a)\b/);
      expect(html).not.toContain("tabindex");
      expect(html.match(/data-skeleton-field=/g)).toHaveLength(
        mode === "sign-in" ? 1 : 4,
      );
      expect(html).toContain(
        mode === "sign-in"
          ? "Preparing secure sign-in…"
          : "Preparing your account form…",
      );
    },
  );
});

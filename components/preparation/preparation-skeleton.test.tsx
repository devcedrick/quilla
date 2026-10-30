// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreparationSkeleton } from "./preparation-skeleton";

describe("preparation loading skeleton", () => {
  it("matches the wide preparation panel without exposing account state", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<PreparationSkeleton />);
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("aria-atomic")).toBe("true");
    expect(status?.getAttribute("aria-busy")).toBe("true");
    expect(status?.hasAttribute("data-preparation-panel")).toBe(true);
    expect(status?.className).toContain("lg:grid-cols-[17rem_minmax(0,1fr)]");
    expect(status?.textContent).toBe("Preparing your Quilla space…");
    expect(
      container.querySelector("input, button, a, form, [tabindex]"),
    ).toBeNull();
    expect(container.querySelector("[aria-current], time")).toBeNull();
    expect(container.textContent).not.toMatch(
      /signed in|professional|unlocked/i,
    );
  });

  it("keeps placeholders decorative and respects reduced motion", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<PreparationSkeleton />);
    const animated = container.querySelectorAll(".motion-safe\\:animate-pulse");
    expect(animated).toHaveLength(2);
    for (const element of animated) {
      expect(element.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(element.classList.contains("motion-reduce:animate-none")).toBe(
        true,
      );
    }
  });
});

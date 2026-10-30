// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PreparationOverview } from "./preparation-overview";

vi.mock("@/components/auth/sign-out", () => ({
  SignOut: () => <button type="button">Sign out</button>,
}));

describe("preparation overview presentation", () => {
  it.each(["dashboard", "diagnostic"] as const)(
    "keeps %s navigation meaningful without inventing assessment actions",
    (kind) => {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(
        <PreparationOverview
          kind={kind}
          preferences={{
            preferredLevel: "professional",
            targetExamDate: "2099-12-01",
          }}
        >
          <p role="status">Guidance is locked.</p>
        </PreparationOverview>,
      );
      expect(
        container.querySelector('a[aria-current="page"]')?.getAttribute("href"),
      ).toBe(kind === "dashboard" ? "/dashboard" : "/diagnostic");
      expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
        "2099-12-01",
      );
      expect(container.textContent).toContain("Professional preparation");
      expect(container.textContent).toContain("excludes Clerical Ability");
      expect(container.textContent).toContain("not available yet");
      expect(container.querySelector('[role="status"]')?.textContent).toBe(
        "Guidance is locked.",
      );
      expect(
        Array.from(
          container.querySelectorAll("button"),
          (button) => button.textContent,
        ),
      ).toEqual(["Sign out"]);
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
      expect(container.querySelectorAll("input")).toHaveLength(0);
      expect(
        container.querySelector('a[href="/account/preferences"]'),
      ).not.toBeNull();
    },
  );
  it("retains the empty-date state and Subprofessional subject boundary", () => {
    const html = renderToStaticMarkup(
      <PreparationOverview
        kind="dashboard"
        preferences={{
          preferredLevel: "subprofessional",
          targetExamDate: null,
        }}
      >
        <p role="status">Locked</p>
      </PreparationOverview>,
    );
    expect(html).toContain("No target exam date set.");
    expect(html).toContain("excludes Analytical Ability");
    expect(html).not.toContain("<time");
  });
});

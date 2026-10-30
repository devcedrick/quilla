import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "./support/clerk";

test.use({ trace: "off", screenshot: "off", video: "off" });
// This journey performs bootstrap, setup, reload, and two persisted edits.
// Keep individual provider/form assertions intact while budgeting the full flow.
test.setTimeout(180000);

for (const level of ["Professional", "Subprofessional"]) {
  test(`onboards ${level}, retains preferences and keeps diagnostics locked`, async ({
    page,
    account,
  }) => {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30000 });
    const radios = page.getByRole("radio");
    await expect(radios.nth(0)).not.toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();
    await page
      .getByRole("button", { name: "Save and view diagnostic next steps" })
      .click();
    await expect(
      page.getByText("Choose an exam level.", { exact: true }),
    ).toBeVisible();
    await expect(radios.nth(0)).toBeFocused();
    await radios.nth(0).press("Space");
    await expect(radios.nth(0)).toBeChecked();
    await radios.nth(0).press("ArrowDown");
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    await page
      .getByRole("radio", { name: new RegExp(`^${level} Includes`) })
      .check();
    await page.getByLabel("Target exam date (optional)").fill("2000-01-01");
    await page
      .getByRole("button", { name: "Save and view diagnostic next steps" })
      .click();
    await expect(
      page.getByText("Choose today or a future date (Philippine time).", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Target exam date (optional)").fill("2099-12-01");
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
    await page
      .getByRole("button", { name: "Save and view diagnostic next steps" })
      .click();
    await expect(page).toHaveURL(/\/diagnostic$/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: `${level} preparation`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("The assessment is not available yet.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start/ })).toHaveCount(0);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "guidance and readiness are locked" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Go to your dashboard", exact: true })
      .click();
    await expect(page.locator("time")).toHaveAttribute(
      "datetime",
      "2099-12-01",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: `${level} preparation`, exact: true }),
    ).toBeVisible();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await page
      .getByRole("link", { name: "Edit preparation preferences" })
      .click();
    const nextLevel =
      level === "Professional" ? "Subprofessional" : "Professional";
    await page
      .getByRole("radio", { name: new RegExp(`^${nextLevel} Includes`) })
      .check();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(
      page.getByText("Confirm that you understand the level change.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "I understand this level change." })
      .check();
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", {
        name: `${nextLevel} preparation`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("time")).toHaveAttribute(
      "datetime",
      "2099-12-01",
    );
    await page
      .getByRole("link", { name: "Edit preparation preferences" })
      .click();
    await page.getByLabel("Target exam date (optional)").fill("");
    await page
      .getByRole("button", { name: "Save preferences", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await expect(
      page.getByText("No target exam date set.", { exact: true }),
    ).toBeVisible();
  });
}

import { expect, test } from "@playwright/test";

// Public rendering regression: no accounts, JWT templates, or auth artifacts.
test.use({ trace: "off", screenshot: "off", video: "off" });

for (const mode of ["sign-in", "sign-up"] as const) {
  test(`${mode} hydrates cleanly on initial load and warm reload`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    let hydrationFailed = false;
    const recordHydrationFailure = (message: string) => {
      if (
        /hydration|server rendered.*match|Minified React error #(418|423|425)/i.test(
          message,
        )
      )
        hydrationFailed = true;
    };
    page.on("pageerror", (error) => recordHydrationFailure(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") recordHydrationFailure(message.text());
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    // Third-party assets need not reach window.load for hydration to finish.
    // The visible Clerk fields below remain the application-readiness assertion.
    await page.goto(`/${mode}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/email address/i)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId("auth-form-skeleton")).toHaveCount(0);
    expect(hydrationFailed).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/email address/i)).toBeVisible({
      timeout: 30000,
    });
    if (mode === "sign-up")
      await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByTestId("auth-form-skeleton")).toHaveCount(0);
    expect(hydrationFailed).toBe(false);
  });
}

import { expect, test } from "@playwright/test";

// Public account entry can still contain Clerk development-session information.
test.use({ trace: "off", screenshot: "off", video: "off" });

for (const width of [390, 768, 1440]) {
  test(`account entry stays usable at ${width}px with reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const analytics: string[] = [];
    page.on("request", (request) => {
      if (/analytics|plausible|posthog|segment|mixpanel/i.test(request.url()))
        analytics.push(request.url());
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const hero = page.locator('[data-motion-target="hero-actions"]');
    await expect(
      hero.getByRole("link", { name: "Create your account", exact: true }),
    ).toHaveAttribute("href", "/sign-up");
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/sign-in");
    await expect(
      page.getByRole("link", { name: "Start preparing", exact: true }),
    ).toHaveAttribute("href", "/sign-up");
    await expect(
      page.getByRole("link", {
        name: "I already have an account",
        exact: true,
      }),
    ).toHaveAttribute("href", "/sign-in");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(
      hero.getByRole("link", { name: "Create your account", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-up$/);
    expect(analytics).toEqual([]);
  });
}

test("failed browser scripts leave public copy and account links navigable", async ({
  page,
}) => {
  // Block hydration, GSAP and Clerk rather than relying on a fast network race.
  await page.route(/\.(?:js|mjs)(?:\?|$)/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const hero = page.locator('[data-motion-target="hero-actions"]');
  await expect(
    hero.getByRole("link", { name: "See how it works" }),
  ).toHaveAttribute("href", "#how-it-works");
  await hero
    .getByRole("link", { name: "Create your account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

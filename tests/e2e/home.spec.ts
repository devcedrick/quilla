import { expect, test } from "@playwright/test";

const title = "Quilla | Smarter CSE preparation";
const description =
  "Quilla is designed to help Professional and Subprofessional Civil Service Examination candidates turn practice into focused, explainable progress.";

test.describe("Quilla landing page", () => {
  test("presents the complete landing narrative and navigation contract", async ({
    page,
  }) => {
    const analyticsRequests: string[] = [];

    page.on("request", (request) => {
      if (/analytics|plausible|posthog|segment|mixpanel/i.test(request.url())) {
        analyticsRequests.push(request.url());
      }
    });

    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Turn every practice session into your next best study step.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "From first diagnostic to focused review.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "One goal. Two distinct CSE levels.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Review should tell you what to do next.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Preparation you can use with confidence.",
      }),
    ).toBeVisible();

    const professional = page.getByRole("article").filter({
      has: page.getByText("Professional", { exact: true }),
    });
    await expect(
      professional.getByRole("heading", {
        level: 3,
        name: "Analytical Ability",
      }),
    ).toBeVisible();
    await expect(
      professional.getByText("Clerical Ability is not included."),
    ).toBeVisible();

    const subprofessional = page.getByRole("article").filter({
      has: page.getByText("Subprofessional", { exact: true }),
    });
    await expect(
      subprofessional.getByRole("heading", {
        level: 3,
        name: "Clerical Ability",
      }),
    ).toBeVisible();
    await expect(
      subprofessional.getByText("Analytical Ability is not included."),
    ).toBeVisible();

    await expect(
      page.getByText(
        "Quilla does not host leaked or actual Civil Service Examination questions.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Quilla is an independent learning platform. It is not affiliated with, endorsed by, or connected to the Philippine Civil Service Commission.",
      ),
    ).toBeVisible();

    const registrationLinks = page.getByRole("link", {
      name: "Create your account",
      exact: true,
    });
    await expect(registrationLinks).toHaveCount(2);
    for (const registrationLink of await registrationLinks.all()) {
      await expect(registrationLink).toHaveAttribute("href", "/sign-up");
    }

    await expect(
      page.getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/sign-in");
    await expect(
      page.getByRole("link", { name: "See how it works", exact: true }),
    ).toHaveAttribute("href", "#how-it-works");

    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      description,
    );
    await expect(
      page.locator(
        'script[src*="analytics"], script[src*="plausible"], script[src*="posthog"]',
      ),
    ).toHaveCount(0);
    const kuwi = page.getByTestId("kuwi-hero");
    await expect(kuwi).toBeVisible();
    await expect(kuwi).toHaveAttribute("alt", "");
    await expect(kuwi).toHaveJSProperty("complete", true);
    expect(
      await kuwi.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);

    const headerBox = await page.locator("header").boundingBox();
    const kuwiBox = await kuwi.boundingBox();
    const studyLoopBox = await page
      .getByTestId("study-loop-card")
      .boundingBox();

    expect(headerBox).not.toBeNull();
    expect(kuwiBox).not.toBeNull();
    expect(studyLoopBox).not.toBeNull();

    if (headerBox && kuwiBox && studyLoopBox) {
      const kuwiBottom = kuwiBox.y + kuwiBox.height;

      expect(kuwiBox.y).toBeGreaterThanOrEqual(
        headerBox.y + headerBox.height + 24,
      );
      expect(kuwiBottom).toBeGreaterThan(studyLoopBox.y);
      expect(kuwiBottom).toBeLessThanOrEqual(studyLoopBox.y + 48);
    }

    expect(analyticsRequests).toEqual([]);
  });

  test("supports keyboard navigation and a visible skip link", async ({
    page,
  }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("link", { name: "Create your account", exact: true })
        .last(),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "See how it works", exact: true }),
    ).toBeFocused();
  });

  test("does not overflow a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Turn every practice session into your next best study step.",
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: "Create your account", exact: true })
        .last(),
    ).toBeVisible();
    await expect(page.getByTestId("kuwi-hero")).toBeVisible();
  });
});

test.describe("Quilla landing page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps its content and actions available", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Turn every practice session into your next best study step.",
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: "Create your account", exact: true })
        .last(),
    ).toHaveAttribute("href", "/sign-up");
    await expect(
      page.getByRole("link", { name: "See how it works", exact: true }),
    ).toHaveAttribute("href", "#how-it-works");
    await expect(
      page.getByText(
        "Quilla is an independent learning platform. It is not affiliated with, endorsed by, or connected to the Philippine Civil Service Commission.",
      ),
    ).toBeVisible();
    await expect(page.getByTestId("kuwi-hero")).toBeVisible();
  });
});

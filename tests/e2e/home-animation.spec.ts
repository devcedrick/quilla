import { expect, test, type Locator, type Page } from "@playwright/test";

const sectionTriggers = {
  benefits: { desktopEndRatio: 0.42, endRatio: 0.42, startRatio: 0.86 },
  cta: { endRatio: 0.65, startRatio: 0.9 },
  hero: { endRatio: 0, startRatio: 0 },
  journey: { desktopEndRatio: 0.42, endRatio: 0.38, startRatio: 0.88 },
  levels: { desktopEndRatio: 0.42, endRatio: 0.42, startRatio: 0.86 },
  trust: { desktopEndRatio: 0.42, endRatio: 0.42, startRatio: 0.86 },
} as const;

type SectionName = keyof typeof sectionTriggers;

const narrativeSectionNames: SectionName[] = [
  "journey",
  "levels",
  "benefits",
  "trust",
  "cta",
];

const cardGroups = [
  { section: "journey", target: "journey-item" },
  { section: "levels", target: "levels-shared" },
  { section: "levels", target: "levels-card" },
  { section: "benefits", target: "benefits-card" },
  { section: "trust", target: "trust-item" },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectProgress(
  section: Locator,
  minimum: number,
  maximum: number,
) {
  const readProgress = async () =>
    Number((await section.getAttribute("data-motion-progress")) ?? Number.NaN);

  await expect.poll(readProgress).toBeGreaterThanOrEqual(minimum);
  await expect.poll(readProgress).toBeLessThanOrEqual(maximum);
}

async function seekSectionProgress(
  page: Page,
  name: SectionName,
  progress: number,
) {
  const section = page.locator(`[data-motion-section="${name}"]`);
  const trigger = sectionTriggers[name];
  const desktopEndRatio =
    "desktopEndRatio" in trigger ? trigger.desktopEndRatio : null;

  await section.evaluate(
    (element, parameters) => {
      const bounds = element.getBoundingClientRect();
      const absoluteTop = bounds.top + window.scrollY;
      const maximumScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const unclampedStart =
        absoluteTop - window.innerHeight * parameters.startRatio;
      const unclampedEnd =
        window.innerWidth >= 1024 && parameters.desktopEndRatio !== null
          ? absoluteTop - window.innerHeight * parameters.desktopEndRatio
          : absoluteTop +
            bounds.height -
            window.innerHeight * parameters.endRatio;
      const start = Math.min(maximumScroll, Math.max(0, unclampedStart));
      const end = Math.min(maximumScroll, Math.max(start, unclampedEnd));
      const destination =
        parameters.progress <= 0
          ? start - 2
          : parameters.progress >= 1
            ? end + 2
            : start + (end - start) * parameters.progress;

      window.scrollTo({
        behavior: "instant",
        top: Math.min(maximumScroll, Math.max(0, destination)),
      });
    },
    { desktopEndRatio, progress, ...trigger },
  );

  const tolerance = progress === 0 || progress === 1 ? 0.02 : 0.08;
  await expectProgress(
    section,
    Math.max(0, progress - tolerance),
    Math.min(1, progress + tolerance),
  );
  return section;
}

async function readOpacity(locator: Locator) {
  return locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).opacity),
  );
}

async function readTransform(locator: Locator) {
  return locator.evaluate((element) => {
    const transform = window.getComputedStyle(element).transform;
    const matrix =
      transform === "none" ? new DOMMatrix() : new DOMMatrix(transform);

    return { translateY: matrix.f };
  });
}

async function readTransformValue(locator: Locator) {
  return locator.evaluate(
    (element) => window.getComputedStyle(element).transform,
  );
}

test.describe("Quilla landing-page motion", () => {
  test("scrubs the complete desktop story forward and backward without flicker", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const root = page.getByTestId("landing-motion-root");
    const hero = page.locator('[data-motion-section="hero"]');
    const heroStage = page.locator('[data-motion-target="hero-stage"]');

    await expect(root).toHaveAttribute("data-motion-ready", "true");
    await expect(root).toHaveAttribute("data-motion-mode", "desktop");
    const initialHeroTransform = await heroStage.evaluate(
      (element) => window.getComputedStyle(element).transform,
    );

    await seekSectionProgress(page, "hero", 0.5);
    const midpointHeroTransform = await heroStage.evaluate(
      (element) => window.getComputedStyle(element).transform,
    );
    expect(midpointHeroTransform).not.toBe(initialHeroTransform);
    await expectProgress(hero, 0.42, 0.58);

    const journey = await seekSectionProgress(page, "journey", 0);
    const firstJourneyStep = journey
      .locator('[data-motion-target="journey-item"]')
      .first();
    const opacitySamples: number[] = [];

    for (const progress of [0, 0.08, 0.16, 0.24, 0.32, 0.4]) {
      await seekSectionProgress(page, "journey", progress);
      await expectProgress(
        journey,
        Math.max(0, progress - 0.015),
        Math.min(1, progress + 0.03),
      );
      opacitySamples.push(await readOpacity(firstJourneyStep));
    }

    expect(opacitySamples[0]).toBeGreaterThan(0);
    expect(opacitySamples.at(-1)).toBeGreaterThan(opacitySamples[0]);
    opacitySamples.slice(1).forEach((opacity, index) => {
      expect(opacity).toBeGreaterThanOrEqual(opacitySamples[index] - 0.02);
    });

    await seekSectionProgress(page, "journey", 1);

    for (const name of narrativeSectionNames.slice(1)) {
      await seekSectionProgress(page, name, 0.5);
      await seekSectionProgress(page, name, 1);
    }

    for (const group of cardGroups) {
      const section = await seekSectionProgress(page, group.section, 1);
      const sectionTop = await section.evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      expect(sectionTop).toBeGreaterThanOrEqual(viewportHeight * 0.35);

      const cards = section.locator(`[data-motion-target="${group.target}"]`);
      for (let index = 0; index < (await cards.count()); index += 1) {
        await expect
          .poll(() => readOpacity(cards.nth(index)))
          .toBeGreaterThanOrEqual(0.99);
      }
    }

    await seekSectionProgress(page, "cta", 1);
    const startPreparing = page.getByRole("link", { name: "Start preparing" });
    await expect(startPreparing).toBeVisible();
    await startPreparing.focus();
    await expect(startPreparing).toBeFocused();

    await seekSectionProgress(page, "journey", 0.35);
    await expect.poll(() => readOpacity(firstJourneyStep)).toBeLessThan(0.98);
    const reversedOpacity = await readOpacity(firstJourneyStep);
    expect(reversedOpacity).toBeGreaterThan(opacitySamples[0]);
    expect(reversedOpacity).toBeLessThan(1);

    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });

  test("keeps a restored mid-page section settled during hydration", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("landing-motion-root")).toHaveAttribute(
      "data-motion-ready",
      "true",
    );

    await seekSectionProgress(page, "levels", 0.5);
    await page.reload({ waitUntil: "load" });

    const root = page.getByTestId("landing-motion-root");
    const levels = page.locator('[data-motion-section="levels"]');
    await expect(root).toHaveAttribute("data-motion-ready", "true");
    await expect(levels).toHaveAttribute("data-motion-state", "settled");

    const levelStyles = await levels
      .locator("[data-motion-target]")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const htmlElement = element as HTMLElement;
          return {
            opacity: window.getComputedStyle(htmlElement).opacity,
            inlineOpacity: htmlElement.style.opacity,
            inlineTransform: htmlElement.style.transform,
          };
        }),
      );

    expect(levelStyles).toEqual(
      levelStyles.map(() => ({
        inlineOpacity: "",
        inlineTransform: "",
        opacity: "1",
      })),
    );
  });

  test("loops the hero accents while visible and pauses them off-screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const hero = page.locator('[data-motion-section="hero"]');
    const kuwiLoop = hero.locator('[data-motion-loop="hero-kuwi"]');
    const orbitLoop = hero.locator('[data-motion-loop="hero-orbit"]');
    const initialKuwiTransform = await readTransformValue(kuwiLoop);
    const initialOrbitTransform = await readTransformValue(orbitLoop);

    await expect(hero).toHaveAttribute("data-motion-loop-state", "running");
    await expect
      .poll(() => readTransformValue(kuwiLoop))
      .not.toBe(initialKuwiTransform);
    await expect
      .poll(() => readTransformValue(orbitLoop))
      .not.toBe(initialOrbitTransform);

    await seekSectionProgress(page, "hero", 1);
    await expect(hero).toHaveAttribute("data-motion-loop-state", "paused");
    const pausedTransform = await readTransformValue(kuwiLoop);
    await page.waitForTimeout(250);
    expect(await readTransformValue(kuwiLoop)).toBe(pausedTransform);

    await seekSectionProgress(page, "hero", 0.5);
    await expect(hero).toHaveAttribute("data-motion-loop-state", "running");
    await expect
      .poll(() => readTransformValue(kuwiLoop))
      .not.toBe(pausedTransform);
  });

  test("keeps every motion target static when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const root = page.getByTestId("landing-motion-root");
    await expect(root).toHaveAttribute("data-motion-ready", "true");
    await expect(root).toHaveAttribute("data-motion-mode", "reduced");

    const motionStyles = await page
      .locator("[data-motion-target], [data-motion-loop]")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const htmlElement = element as HTMLElement;

          return {
            opacity: htmlElement.style.opacity,
            transform: htmlElement.style.transform,
            transformOrigin: htmlElement.style.transformOrigin,
            willChange: htmlElement.style.willChange,
          };
        }),
      );

    expect(motionStyles).toEqual(
      motionStyles.map(() => ({
        opacity: "",
        transform: "",
        transformOrigin: "",
        willChange: "",
      })),
    );

    for (const name of narrativeSectionNames) {
      const section = page.locator(`[data-motion-section="${name}"]`);
      await section.evaluate((element) => {
        element.scrollIntoView({ block: "center" });
      });
      await expect(section).not.toHaveAttribute("data-motion-state", /.+/);
    }

    await expect(
      page.locator('[data-motion-section="hero"]'),
    ).not.toHaveAttribute("data-motion-loop-state", /.+/);

    const startPreparing = page.getByRole("link", { name: "Start preparing" });
    await expect(startPreparing).toBeVisible();
    await startPreparing.focus();
    await expect(startPreparing).toBeFocused();
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("uses the mobile scrub profile without horizontal drift or jank", async ({
    page,
  }) => {
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const root = page.getByTestId("landing-motion-root");
    await expect(root).toHaveAttribute("data-motion-ready", "true");
    await expect(root).toHaveAttribute("data-motion-mode", "mobile");
    await expectNoHorizontalOverflow(page);

    await seekSectionProgress(page, "hero", 0.5);
    const firstJourneyCard = page
      .locator('[data-motion-target="journey-item"]')
      .first();

    await seekSectionProgress(page, "journey", 0.1);
    await expect
      .poll(async () =>
        Math.abs((await readTransform(firstJourneyCard)).translateY),
      )
      .toBeGreaterThan(10);

    await seekSectionProgress(page, "journey", 0.75);
    await expect
      .poll(async () =>
        Math.abs((await readTransform(firstJourneyCard)).translateY),
      )
      .toBeLessThan(1);

    await seekSectionProgress(page, "journey", 0.1);
    await expect
      .poll(async () =>
        Math.abs((await readTransform(firstJourneyCard)).translateY),
      )
      .toBeGreaterThan(10);

    for (const name of narrativeSectionNames) {
      const section = await seekSectionProgress(page, name, 0.5);
      await expectProgress(section, 0.42, 0.58);

      if (name === "levels") {
        const horizontalTranslations = await section
          .locator('[data-motion-target="levels-card"]')
          .evaluateAll((elements) =>
            elements.map((element) => {
              const transform = window.getComputedStyle(element).transform;
              return transform === "none" ? 0 : new DOMMatrix(transform).m41;
            }),
          );
        horizontalTranslations.forEach((translation) => {
          expect(Math.abs(translation)).toBeLessThan(0.5);
        });
      }

      await seekSectionProgress(page, name, 1);
      await expectNoHorizontalOverflow(page);
    }

    for (const group of cardGroups) {
      const cards = page.locator(
        `[data-motion-section="${group.section}"] [data-motion-target="${group.target}"]`,
      );

      for (let index = 0; index < (await cards.count()); index += 1) {
        const card = cards.nth(index);
        await card.evaluate((element) => {
          element.scrollIntoView({ behavior: "instant", block: "center" });
        });
        await expect(card).toBeInViewport({ ratio: 0.2 });
        await expect.poll(() => readOpacity(card)).toBeGreaterThanOrEqual(0.99);
        expect(
          await card.evaluate(
            (element) => (element as HTMLElement).style.opacity,
          ),
        ).toBe("");
        await expectNoHorizontalOverflow(page);
      }
    }

    await seekSectionProgress(page, "cta", 1);

    await expect(
      page.getByRole("link", { name: "Start preparing" }),
    ).toBeVisible();
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
  });

  test("recreates one clean motion boundary after route navigation", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    await expect(page.getByTestId("landing-motion-root")).toHaveAttribute(
      "data-motion-ready",
      "true",
    );
    await seekSectionProgress(page, "trust", 1);

    await page
      .getByRole("link", { name: "Sign in", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goBack();

    const root = page.getByTestId("landing-motion-root");
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute("data-motion-ready", "true");
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("rebuilds responsive motion contexts without recursive cleanup", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const root = page.getByTestId("landing-motion-root");
    await expect(root).toHaveAttribute("data-motion-mode", "desktop");

    const responsiveModes = [
      { height: 844, mode: "mobile", width: 390 },
      { height: 900, mode: "tablet", width: 900 },
      { height: 900, mode: "desktop", width: 1440 },
      { height: 844, mode: "mobile", width: 390 },
      { height: 900, mode: "desktop", width: 1440 },
    ] as const;

    for (const viewport of responsiveModes) {
      await page.evaluate(() =>
        window.scrollTo({ behavior: "instant", top: 0 }),
      );
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });
      await expect(root).toHaveAttribute("data-motion-ready", "true");
      await expect(root).toHaveAttribute("data-motion-mode", viewport.mode);
      await seekSectionProgress(page, "journey", 0.5);
    }

    await page
      .getByRole("link", { name: "Sign in", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(pageErrors).toEqual([]);
  });
});

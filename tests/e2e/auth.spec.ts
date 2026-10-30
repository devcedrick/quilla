import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page, Route } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountError } from "@/components/auth/account-error";
import { developmentClerk, expect, test } from "./support/clerk";
import { captureAuthEvidence } from "./support/auth-evidence";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

async function currentApplicationAccess(page: Page) {
  // Keep the synthetic identity token in memory only, outside assertion payloads.
  let stage = "token";
  try {
    // Landing actions can arrive from SSR before the browser SDK is ready.
    // Observe readiness before asking the synthetic session for a token.
    await page.waitForFunction(
      () => window.Clerk?.loaded && Boolean(window.Clerk.session),
    );
    const token = await page.evaluate(() =>
      window.Clerk.session?.getToken({ template: "convex" }),
    );
    if (!token) throw new Error("Missing identity token");
    stage = "configuration";
    if (!process.env.NEXT_PUBLIC_CONVEX_URL)
      throw new Error("Missing test configuration");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
      logger: false,
    });
    client.setAuth(token);
    stage = "query";
    return await client.query(api.users.currentAccess, {});
  } catch {
    throw new Error(
      `Synthetic account application-access verification failed at ${stage} (details redacted).`,
    );
  }
}

async function checkAccountViewports(
  page: Page,
  state: string,
  assertState?: () => Promise<void>,
) {
  await expect
    .poll(() =>
      page
        .getByRole("link", { name: "Quilla", exact: true })
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertState?.();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator('section[aria-labelledby="account-title"]'),
    ).toBeVisible();
    if (width < 1024 && (await page.getByTestId("auth-welcome").count())) {
      const welcome = await page.getByTestId("auth-welcome").boundingBox();
      const surface = await page
        .locator('section[aria-labelledby="account-title"]')
        .boundingBox();
      expect(surface!.y - (welcome!.y + welcome!.height)).toBeLessThanOrEqual(
        40,
      );
    }
    await captureAuthEvidence(page, `${state}-${width}`);
  }
}

async function fillSignIn(page: Page, email: string, password: string) {
  await page.getByLabel(/email address/i).fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

async function enterCode(page: Page) {
  // The new-device screen can mount before Clerk's code preparation completes.
  // Wait for the provider's observable verification state, never an arbitrary sleep.
  if (
    await page.evaluate(
      () => window.Clerk.client?.signIn.status === "needs_client_trust",
    )
  ) {
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            window.Clerk.client?.signIn.secondFactorVerification.expireAt,
          ),
        ),
      )
      .toBe(true);
  } else if (
    await page.evaluate(
      () => window.Clerk.client?.signIn.status === "needs_first_factor",
    )
  ) {
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(window.Clerk.client?.signIn.firstFactorVerification.expireAt),
        ),
      )
      .toBe(true);
  }
  await page
    .locator('input[autocomplete="one-time-code"]')
    .first()
    .fill("424242");
}

async function completeOnboarding(page: Page) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: /^Professional\b/ }).check();
  await page
    .getByRole("button", {
      name: "Save and view diagnostic next steps",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/diagnostic$/);
  await expect(
    page.getByText("The assessment is not available yet.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Go to your dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Clerk account flows", () => {
  test("landing recognizes sessions without bootstrapping profiles or sharing decisions", async ({
    page,
    account,
    browser,
  }) => {
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: account.email });
    await expect(
      page.getByRole("link", { name: "Go to your dashboard", exact: true }),
    ).toHaveCount(3);
    expect((await currentApplicationAccess(page)).status).toBe(
      "missing_profile",
    );
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("link", { name: "Go to your dashboard", exact: true }),
      ).toHaveCount(3);
      await expect(
        page.getByRole("link", { name: "Create your account", exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
    expect((await currentApplicationAccess(page)).status).toBe(
      "missing_profile",
    );
    // A separate anonymous request must not inherit the authenticated SSR decision.
    const anonymous = await browser.newContext();
    try {
      const other = await anonymous.newPage();
      await setupClerkTestingToken({ page: other });
      await other.goto("/", { waitUntil: "domcontentloaded" });
      await expect(
        other.getByRole("link", { name: "Start preparing", exact: true }),
      ).toHaveAttribute("href", "/sign-up");
      await expect(
        other.getByRole("link", { name: "Go to your dashboard", exact: true }),
      ).toHaveCount(0);
      await page
        .locator('[data-motion-target="hero-actions"]')
        .getByRole("link", { name: "Go to your dashboard", exact: true })
        .click();
      await completeOnboarding(page);
      // Next retains the diagnostic route hidden during dashboard navigation.
      await expect(
        page.getByTestId("account-status").filter({ visible: true }),
      ).toBeVisible();
      expect((await currentApplicationAccess(page)).status).toBe("active");
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole("link", { name: "Start preparing", exact: true }),
      ).toHaveAttribute("href", "/sign-up");
      await page.goBack();
      await expect(page.getByTestId("account-status")).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  });

  test("first protected access creates a stable default profile across reloads", async ({
    page,
    account,
  }) => {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);
    const first = await currentApplicationAccess(page);
    expect(first.status).toBe("active");
    if (first.status !== "active")
      throw new Error("Expected active synthetic profile");
    expect(first.role).toBe("user");
    await page.reload();
    await expect(page).toHaveURL(/\/onboarding$/);
    expect(await currentApplicationAccess(page)).toEqual(first);
    await completeOnboarding(page);
    await expect(
      page.getByTestId("account-status").filter({ visible: true }),
    ).toBeVisible();
  });
  for (const mode of ["sign-in", "sign-up"] as const) {
    test(`${mode} skeleton stays usable while the provider loads and yields to the form`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.emulateMedia({ reducedMotion: "reduce" });
      let holding = true;
      const held: Route[] = [];
      await page.route(
        (url) =>
          url.hostname.endsWith(".accounts.dev") &&
          /\.(js|mjs)$/.test(url.pathname),
        (route) => {
          if (holding) held.push(route);
          else return route.continue();
        },
      );
      try {
        await page.goto(`/${mode}`, { waitUntil: "domcontentloaded" });
        // Next streaming can briefly retain the previous fallback in a hidden
        // container while the provider's identical fallback hydrates.
        const skeleton = page.locator(
          '[data-testid="auth-form-skeleton"]:visible',
        );
        await expect(skeleton).toHaveCount(1);
        await expect(skeleton).toBeVisible();
        await expect(skeleton).toHaveAttribute("role", "status");
        await expect(skeleton.locator("[data-skeleton-field]")).toHaveCount(
          mode === "sign-in" ? 1 : 4,
        );
        await expect(
          skeleton.locator("input, button, a, [tabindex]"),
        ).toHaveCount(0);
        await expect(
          skeleton.locator('[aria-hidden="true"]').first(),
        ).toHaveCSS("animation-name", "none");
        for (const width of [390, 768, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
            ),
          ).toBe(true);
          await expect(
            page.getByRole("link", { name: "Back to home", exact: true }),
          ).toBeVisible();
          if (width !== 768)
            await captureAuthEvidence(page, `skeleton-${mode}-${width}`);
        }
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await expect(
          skeleton.locator('[aria-hidden="true"]').first(),
        ).toHaveCSS("animation-name", "pulse");
        holding = false;
        await Promise.all(held.splice(0).map((route) => route.continue()));
        await expect(page.getByLabel(/email address/i)).toBeVisible({
          timeout: 30000,
        });
        await expect(skeleton).toHaveCount(0);
        if (mode === "sign-up")
          await expect(page.getByLabel(/first name/i)).toBeVisible();
      } finally {
        holding = false;
        await Promise.all(
          held.splice(0).map((route) => route.abort().catch(() => {})),
        );
      }
    });
  }

  test("Rive loads from this origin and yields to reduced motion", async ({
    page,
  }) => {
    const runtimeRequests: string[] = [];
    page.on("request", (request) => {
      if (/\.wasm(?:\?|$)|\.riv(?:\?|$)/.test(request.url()))
        runtimeRequests.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/sign-in");
    const root = page.getByTestId("kuwi-rive");
    await expect(root).toHaveAttribute("data-rive-state", "ready", {
      timeout: 15000,
    });
    const canvas = root.locator("canvas");
    await expect(canvas).toBeVisible();
    const playback = page.getByTestId("kuwi-playback");
    await expect(playback).toHaveAttribute("data-playing", "true");
    // Read decorative pixels only; do not retain an authentication screenshot.
    const fingerprint = () =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const pixels = element
          .getContext("2d")!
          .getImageData(0, 0, element.width, element.height).data;
        let hash = 0;
        for (let i = 0; i < pixels.length; i++)
          hash = (Math.imul(hash, 31) + pixels[i]) | 0;
        return hash;
      });
    const firstFrame = await fingerprint();
    await expect.poll(fingerprint, { timeout: 5000 }).not.toBe(firstFrame);
    await expect(root.getByRole("button")).toHaveCount(0);
    // Exercise visibility events without relying on headless tab policy.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(playback).toHaveAttribute("data-playing", "false");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const pausedFrame = await fingerprint();
    await page.waitForTimeout(250); // Measure the hidden-page pause, not provider readiness.
    expect(await fingerprint()).toBe(pausedFrame);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(playback).toHaveAttribute("data-playing", "true");
    await expect.poll(fingerprint, { timeout: 5000 }).not.toBe(pausedFrame);
    expect(
      await canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("2d");
        if (!context || !element.width || !element.height) return false;
        return context
          .getImageData(0, 0, element.width, element.height)
          .data.some((value, index) => index % 4 === 3 && value > 0);
      }),
    ).toBe(true);
    expect(runtimeRequests.some((url) => url.endsWith(".riv"))).toBe(true);
    expect(runtimeRequests.some((url) => url.endsWith(".wasm"))).toBe(true);
    expect(
      runtimeRequests.every(
        (url) => new URL(url).origin === new URL(page.url()).origin,
      ),
    ).toBe(true);
    await page.waitForFunction(() => window.Clerk?.loaded);
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await captureAuthEvidence(page, "rive-auth-desktop");
    // The runtime updates inline canvas pixels on a ResizeObserver callback.
    // Its CSS display size must follow the container immediately, not overflow
    // the mobile page while waiting for that framebuffer update.
    await page.setViewportSize({ width: 390, height: 844 });
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="kuwi-rive"]')!;
      const canvas = root.querySelector("canvas")!;
      return {
        pageWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasWidth: canvas.getBoundingClientRect().width,
        rootWidth: root.getBoundingClientRect().width,
      };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.pageWidth);
    expect(geometry.canvasWidth).toBeLessThanOrEqual(geometry.rootWidth);
    await captureAuthEvidence(page, "rive-auth-mobile");
    await page.setViewportSize({ width: 390, height: 400 });
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() =>
        root.evaluate((element) => element.getBoundingClientRect().bottom),
      )
      .toBeLessThanOrEqual(0);
    await expect(playback).toHaveAttribute("data-playing", "false");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(playback).toHaveAttribute("data-playing", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(root).toHaveAttribute("data-rive-state", "fallback");
    await expect(canvas).toHaveCount(0);
    await expect(
      page.locator('img[src$="kuwi-auth-welcome.svg"]'),
    ).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(root).toHaveAttribute("data-rive-state", "ready", {
      timeout: 15000,
    });
    await page.getByRole("link", { name: "Back to home", exact: true }).click();
    await expect(page).toHaveURL("/");
    // Next Cache Components can retain inactive pages in a hidden Activity.
    await expect(page.getByTestId("kuwi-rive")).toBeHidden();
  });

  test("reduced motion never downloads Rive assets", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (/\.wasm(?:\?|$)|\.riv(?:\?|$)/.test(request.url()))
        requests.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-up");
    await page.waitForFunction(() => window.Clerk?.loaded);
    await expect(page.getByTestId("kuwi-rive")).toHaveAttribute(
      "data-rive-state",
      "fallback",
    );
    await expect(
      page.locator('img[src$="kuwi-auth-welcome.svg"]'),
    ).toBeVisible();
    await expect(page.getByTestId("kuwi-rive").locator("canvas")).toHaveCount(
      0,
    );
    expect(requests).toEqual([]);
  });

  for (const failure of ["asset", "wasm", "timeout"] as const) {
    test(`Rive ${failure} failure retains the static mascot and working form`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const heldRequests: Route[] = [];
      await page.route(
        failure !== "wasm"
          ? "**/brand/kuwi/rive/kuwi-auth.riv"
          : "**/brand/kuwi/rive/*.wasm",
        (route) => {
          if (failure === "timeout") heldRequests.push(route);
          else return route.abort();
        },
      );
      await page.goto("/sign-in");
      await expect(page.getByTestId("kuwi-rive")).toHaveAttribute(
        "data-rive-state",
        "failed",
        { timeout: 15000 },
      );
      await expect(
        page.locator('img[src$="kuwi-auth-welcome.svg"]'),
      ).toBeVisible();
      await expect(page.getByTestId("kuwi-rive").locator("canvas")).toHaveCount(
        0,
      );
      await page.waitForFunction(() => window.Clerk?.loaded);
      await expect(page.getByLabel(/email address/i)).toBeVisible();
      for (const request of heldRequests) await request.abort().catch(() => {});
    });
  }

  test("without JavaScript the approved SVG remains visible", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto("/sign-in");
      await expect(
        page.locator('img[src$="kuwi-auth-welcome.svg"]'),
      ).toBeVisible();
      await expect(page.locator("canvas")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test.describe.configure({ timeout: 60000 });
  test("account typography, contrast, and text reflow use the brand tokens", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await page.waitForFunction(() => window.Clerk?.loaded);
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    const contrast = await page.evaluate(() => {
      const tokens = getComputedStyle(document.documentElement);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (token: string) => {
        context.fillStyle = tokens.getPropertyValue(token);
        context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data]
          .slice(0, 3)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const pairs = [
        ["--foreground", "--background"],
        ["--muted-foreground", "--background"],
        ["--primary", "--card"],
        ["--muted-foreground", "--card"],
        ["--destructive", "--card"],
        ["--primary-foreground", "--primary"],
      ];
      return pairs.map(([foreground, background]) => {
        const a = luminance(foreground);
        const b = luminance(background);
        return {
          foreground,
          background,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    for (const pair of contrast)
      expect(
        pair.ratio,
        `${pair.foreground} on ${pair.background}`,
      ).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('[data-account-layout="auth"]')).toHaveCSS(
      "font-family",
      /Manrope/i,
    );
    await expect(page.locator("#account-title")).toHaveCSS(
      "font-family",
      /Fraunces/i,
    );
    for (const [width, fontSize] of [
      [320, "100%"],
      [768, "200%"],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, fontSize);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      for (const control of [
        page.getByLabel(/email address/i),
        page.getByRole("button", { name: "Continue", exact: true }),
      ]) {
        const box = await control.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
  });
  test("account error fallback retains compact branding at every viewport", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    const sheets = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLLinkElement).href),
      );
    const bodyClass = await page.locator("body").getAttribute("class");
    const origin = new URL(page.url()).origin;
    const styles = await Promise.all(
      sheets.map(async (url) => {
        const response = await page.request.get(url);
        expect(response.ok()).toBe(true);
        return response.text();
      }),
    );
    const fallback = renderToStaticMarkup(
      createElement(AccountError, { retry: () => {} }),
    );
    // Visual fixture of the real fallback, not a public debug route or a fake
    // authentication result. Unit tests separately exercise its retry callback.
    await page.route(`${origin}/__account-error-visual-fixture`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html lang="en"><body class="${bodyClass ?? ""}">${fallback}</body></html>`,
      }),
    );
    await page.goto("/__account-error-visual-fixture");
    for (const content of styles) await page.addStyleTag({ content });
    await expect(page.locator('[data-account-layout="compact"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByTestId("auth-welcome")).toHaveCount(0);
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await checkAccountViewports(page, "account-error-fixture");
  });
  for (const width of [390, 768, 1440]) {
    for (const route of ["sign-in", "sign-up"]) {
      test(`branded ${route} is usable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`/${route}`);
        await page.waitForFunction(() => window.Clerk?.loaded);
        await expect(page.getByLabel(/email address/i)).toBeVisible();
        const switchLink = page.getByRole("link", {
          name: route === "sign-in" ? "Sign up" : "Sign in",
          exact: true,
        });
        await expect(switchLink).toBeVisible();
        const switchRow = page
          .locator(".cl-footerAction")
          .filter({ has: switchLink });
        await expect(switchRow).toHaveCSS("align-items", "baseline");
        await expect(switchRow).toHaveCSS("justify-content", "center");
        const alignment = await switchRow.evaluate((row) => {
          const text = row.querySelector(".cl-footerActionText")!;
          const link = row.querySelector(".cl-footerActionLink")!;
          const textStyle = getComputedStyle(text);
          const linkStyle = getComputedStyle(link);
          return {
            textSize: textStyle.fontSize,
            linkSize: linkStyle.fontSize,
            textLine: textStyle.lineHeight,
            linkLine: linkStyle.lineHeight,
            topDifference: Math.abs(
              text.getBoundingClientRect().top -
                link.getBoundingClientRect().top,
            ),
          };
        });
        expect(alignment.textSize).toBe(alignment.linkSize);
        expect(alignment.textLine).toBe(alignment.linkLine);
        expect(alignment.topDifference).toBeLessThanOrEqual(1);
        await expect(
          page.getByRole("navigation", { name: "Account navigation" }),
        ).toHaveCount(0);
        await expect(
          page.getByText("A little focus. A fresh beginning.", { exact: true }),
        ).toHaveCount(0);
        const backdrop = page.getByTestId("auth-mascot-backdrop");
        await expect(backdrop).toBeVisible({ visible: width >= 1024 });
        if (width >= 1024) {
          const bounds = await backdrop.boundingBox();
          expect(bounds).not.toBeNull();
          expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThanOrEqual(
            1,
          );
        }
        await expect(page.getByLabel(/email address/i)).toHaveCSS(
          "border-top-width",
          "1px",
        );
        await expect(
          page.getByRole("heading", { name: "A steady start.", exact: true }),
        ).toBeVisible({ visible: width >= 1024 });
        await expect(
          page.locator('[data-account-layout="auth"]'),
        ).toBeVisible();
        await expect(page.locator('[data-account-layout="auth"]')).toHaveClass(
          /paper-grid/,
        );
        await expect(page.locator('[data-account-layout="auth"]')).toHaveCSS(
          "background-size",
          "32px 32px, 32px 32px",
        );
        // Clerk owns the visible step heading; the shell title remains available
        // to assistive technology without duplicating the large form headline.
        await expect(page.locator("#account-title")).toHaveClass(/sr-only/);
        await expect(
          page.getByRole("heading", { level: 1 }).last(),
        ).toBeVisible();
        const composition = await page
          .getByTestId("account-composition")
          .boundingBox();
        const welcome = await page.getByTestId("auth-welcome").boundingBox();
        const form = await page
          .locator('section[aria-labelledby="account-title"]')
          .boundingBox();
        if (width >= 1024) {
          expect(form!.x).toBeGreaterThanOrEqual(
            welcome!.x + welcome!.width - 1,
          );
          expect(form!.x + form!.width).toBeLessThanOrEqual(
            composition!.x + composition!.width,
          );
          expect(Math.abs(form!.y - welcome!.y)).toBeLessThanOrEqual(1);
        }
        const mascot = page.locator('img[src$="kuwi-auth-welcome.svg"]');
        await expect(mascot).toHaveAttribute("alt", "");
        await expect(mascot).toHaveAttribute("aria-hidden", "true");
        for (const preference of ["no-preference", "reduce"] as const) {
          await page.emulateMedia({ reducedMotion: preference });
          await expect(mascot).toHaveCSS("animation-name", "none");
          await expect(mascot).toHaveCSS("transform", "none");
          expect(
            await mascot.evaluate((image) => image.getAnimations().length),
          ).toBe(0);
        }
        await expect(
          page.locator(".auth-kuwi-eyelid, .auth-kuwi-wing"),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /mascot animation/i }),
        ).toHaveCount(0);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        const input = await page.getByLabel(/email address/i).boundingBox();
        expect(input!.x).toBeGreaterThanOrEqual(0);
        expect(input!.x + input!.width).toBeLessThanOrEqual(width);
        await page.getByRole("link", { name: "Quilla", exact: true }).focus();
        await page.keyboard.press("Shift+Tab");
        await expect(
          page.getByRole("link", { name: "Skip to main content" }),
        ).toBeFocused();
        await expect(
          page.getByRole("link", { name: "Skip to main content" }),
        ).toBeVisible();
        await page.keyboard.press("Tab");
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .focus();
        await expect(
          page.getByRole("button", { name: "Continue", exact: true }),
        ).toHaveCSS("box-shadow", "none");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(
          page.getByRole("button", { name: "Continue", exact: true }),
        ).toHaveCSS("transition-duration", "0s");
        await captureAuthEvidence(page, `${route}-${width}`);
      });
    }
  }
  test("public pages, protected routes, keyboard navigation, and mobile account forms", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("region", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    // Provider boot can exceed the normal five-second assertion window. Wait
    // for its real readiness state within this test's existing bounded timeout.
    await page.waitForFunction(() => window.Clerk?.loaded);
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
    await page.getByLabel(/email address/i).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("link", { name: "Back to home", exact: true }),
    ).toBeFocused();
    await page.getByRole("link", { name: "Sign up", exact: true }).click();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?/);
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    const response = await page.request.get("/dashboard", { maxRedirects: 0 });
    expect(await response.text()).not.toContain('data-testid="account-status"');
    await page.goto("/dashboard?from=protected");
    await expect(page).toHaveURL(
      /redirect_url=%2Fdashboard%3Ffrom%3Dprotected/,
    );
    await page.reload();
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await page.goto("/admin/questions");
    await expect(page).toHaveURL(/\/sign-in\?/);
  });

  test("registration enforces required names, email, password length, and email verification", async ({
    page,
    identity,
  }) => {
    await page.goto("/sign-up");
    await page.waitForFunction(() => window.Clerk?.loaded);
    const firstName = page.getByLabel(/first name/i);
    const lastName = page.getByLabel(/last name/i);
    const email = page.getByLabel(/email address/i);
    const password = page.getByLabel("Password", { exact: true });
    await expect(firstName).toHaveAttribute("required", "");
    await expect(lastName).toHaveAttribute("required", "");
    await email.fill("not-an-email");
    expect(
      await email.evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false);
    await firstName.fill(identity.firstName);
    await lastName.fill(identity.lastName);
    await email.fill(identity.email);
    await password.fill("aB9!xY7");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await expect(password).toBeVisible();
    await password.fill(identity.password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.locator('input[autocomplete="one-time-code"]').first(),
    ).toBeVisible();
    await checkAccountViewports(page, "email-verification");
    // The unfinished sign-up must not grant dashboard access.
    const other = await page.context().newPage();
    await other.goto("/dashboard");
    await expect(other).toHaveURL(/\/sign-in/);
    await other.close();
    await enterCode(page);
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30000 });
    await completeOnboarding(page);
    await expect(
      page.getByTestId("account-status").filter({ visible: true }),
    ).toBeVisible();
    // The provider's email lookup can become visible after session creation.
    // Wait for this exact synthetic identity before checking persisted names.
    await expect
      .poll(
        async () => {
          const result = await developmentClerk().users.getUserList({
            emailAddress: [identity.email],
            limit: 1,
          });
          return result.data.length;
        },
        { timeout: 10000 },
      )
      .toBe(1);
    const users = await developmentClerk().users.getUserList({
      emailAddress: [identity.email],
      limit: 1,
    });
    expect(users.data[0]?.firstName).toBe(identity.firstName);
    expect(users.data[0]?.lastName).toBe(identity.lastName);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: "Go to your dashboard", exact: true }),
    ).toHaveCount(3);
  });

  test("password sign-in, authenticated auth-page redirect, sign-out, and back navigation", async ({
    page,
    preparedAccount: account,
  }) => {
    await page.goto("/dashboard?from=password-login");
    await expect(page).toHaveURL(/\/sign-in\?/);
    await fillSignIn(page, account.email, account.password);
    // Clerk may require its existing device-trust verification for a new browser.
    const code = page.locator('input[autocomplete="one-time-code"]').first();
    await Promise.race([
      code.waitFor({ state: "visible" }),
      page.waitForURL(/\/dashboard\?from=password-login$/),
    ]);
    if (await code.isVisible()) await enterCode(page);
    await expect(page).toHaveURL(/\/dashboard\?from=password-login$/, {
      timeout: 30000,
    });
    await expect(page.getByTestId("account-status")).toBeVisible();
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("wrong passwords cannot establish a session", async ({
    page,
    account,
  }) => {
    await page.goto("/sign-in");
    await fillSignIn(page, account.email, "WrongFixturePassword9!");
    await expect(
      page
        .locator(
          '[data-localization-key="formFieldError__incorrectPassword"], .cl-formFieldErrorText, [role="alert"]',
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: /Password is incorrect/i }),
    ).toBeVisible();
    await checkAccountViewports(page, "validation-error", async () => {
      // Clerk may remount its responsive form on resize. Re-establish the
      // rejected submission so every viewport actually shows validation.
      await page
        .getByLabel("Password", { exact: true })
        .fill("WrongFixturePassword9!");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(
        page.locator("p").filter({ hasText: /Password is incorrect/i }),
      ).toBeVisible();
    });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("password recovery completes and invalidates the old password", async ({
    page,
    preparedAccount: account,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email address/i).fill(account.email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("link", { name: /forgot.*password/i }).click();
    await page
      .getByRole("button", { name: "Reset your password", exact: true })
      .click();
    await expect(
      page.locator('input[autocomplete="one-time-code"]').first(),
    ).toBeVisible();
    await enterCode(page);
    // Code verification can succeed before Clerk finishes transitioning to its
    // password-reset step. Await the provider's real state, not an extra sleep.
    await page.waitForFunction(
      () => window.Clerk.client?.signIn.status === "needs_new_password",
    );
    const newPassword = `${randomBytes(20).toString("base64url")}aA9!`;
    const passwords = page.locator('input[type="password"]');
    await expect(passwords.first()).toBeVisible();
    const otherSessions = page.getByRole("checkbox", {
      name: /sign out of all other devices/i,
    });
    await expect(otherSessions).toBeVisible();
    const checkbox = await otherSessions.boundingBox();
    expect(checkbox!.width).toBeLessThanOrEqual(24);
    expect(checkbox!.height).toBeLessThanOrEqual(24);
    await checkAccountViewports(page, "password-recovery");
    for (const input of await passwords.all()) await input.fill(newPassword);
    await page
      .getByRole("button", { name: /reset password|continue|set password/i })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/sign-in");
    await fillSignIn(page, account.email, account.password);
    await expect(
      page.locator('.cl-formFieldErrorText, [role="alert"]').first(),
    ).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: /Password is incorrect/i }),
    ).toBeVisible();
  });

  test("safe return destinations survive login and malicious destinations cannot escape the app", async ({
    page,
    preparedAccount: account,
  }) => {
    await page.goto(
      "/sign-in?redirect_url=https%3A%2F%2Fevil.example%2Fdashboard",
    );
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto(
      "/sign-in?redirect_url=https%3A%2F%2Fevil.example%2Fdashboard",
    );
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/sign-in?redirect_url=%2Fdashboard%3Ffrom%3Dtest");
    await expect(page).toHaveURL(/\/dashboard\?from=test$/);
    await page.goto("/sign-in?redirect_url=%2Fsign-up");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/admin");
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });

  test("isolated sessions cannot reuse another user's server payload", async ({
    page,
    preparedAccount: account,
    secondAccount,
    browser,
  }) => {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto("/dashboard");
    await page.waitForFunction(() => window.Clerk?.loaded);
    await expect(page.getByTestId("account-status")).toBeVisible();
    const anonymousContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      const anonymous = await anonymousContext.newPage();
      await anonymous.goto("/dashboard");
      await expect(anonymous).toHaveURL(/\/sign-in/);
      await expect(anonymous.getByTestId("account-status")).toHaveCount(0);
      await setupClerkTestingToken({ page: anonymous });
      await clerk.signIn({
        page: anonymous,
        emailAddress: secondAccount.email,
      });
      await anonymous.goto("/dashboard");
      // A full navigation boots this context's provider again. Await its real
      // readiness within the existing test deadline, then keep the unchanged
      // protected-content and user-isolation assertions below.
      await anonymous.waitForFunction(() => window.Clerk?.loaded);
      await expect(anonymous.getByTestId("account-status")).toBeVisible();
      expect(await page.evaluate(() => window.Clerk.user?.id)).toBe(account.id);
      expect(await anonymous.evaluate(() => window.Clerk.user?.id)).toBe(
        secondAccount.id,
      );
      const firstAccess = await currentApplicationAccess(page);
      const secondAccess = await currentApplicationAccess(anonymous);
      expect(firstAccess.status).toBe("active");
      expect(secondAccess.status).toBe("active");
      if (firstAccess.status !== "active" || secondAccess.status !== "active")
        throw new Error("Expected isolated active synthetic profiles");
      expect(firstAccess.userId).not.toBe(secondAccess.userId);
      await anonymous
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await expect(anonymous).toHaveURL(/\/$/);
      await page.reload();
      await page.waitForFunction(() => window.Clerk?.loaded);
      await expect(page.getByTestId("account-status")).toBeVisible();
    } finally {
      await anonymousContext.close();
    }
  });

  test("revoking the actual disposable session removes account access", async ({
    page,
    preparedAccount: account,
  }) => {
    test.setTimeout(120000);
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto("/dashboard");
    await expect(page.getByTestId("account-status")).toBeVisible();
    const sessionId = await page.evaluate(() => window.Clerk.session?.id);
    expect(sessionId).toBeTruthy();
    await developmentClerk().sessions.revokeSession(sessionId!);
    await expect(async () => {
      await page.reload();
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
    }).toPass({ timeout: 90000, intervals: [1000, 5000, 10000] });
    await expect(page.getByTestId("account-status")).toHaveCount(0);
  });

  test("failed browser provider loading never exposes account content", async ({
    page,
  }) => {
    let blocked = false;
    await page.route(
      (url) =>
        url.hostname.endsWith(".accounts.dev") &&
        /\.(js|mjs)$/.test(url.pathname),
      (route) => {
        // Do not block Next's development chunks merely because their names
        // contain "clerk"; the failure fallback itself must still hydrate.
        blocked = true;
        return route.abort();
      },
    );
    await page.goto("/sign-in");
    await expect(
      page.getByRole("region", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await expect.poll(() => blocked).toBe(true);
    await expect(page.getByLabel(/email address/i)).toHaveCount(0);
    await expect(page.getByRole("status")).toBeVisible();
    await checkAccountViewports(page, "provider-loading");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "The account service could not load" }),
    ).toBeVisible({ timeout: 30000 });
    await checkAccountViewports(page, "provider-failure");
    await expect(
      page.getByRole("link", { name: "Back to home", exact: true }),
    ).toBeVisible();
  });
});

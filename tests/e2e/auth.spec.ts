import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { developmentClerk, expect, test } from "./support/clerk";

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

test.describe("Clerk account flows", () => {
  test.describe.configure({ timeout: 60000 });
  test("public pages, protected routes, keyboard navigation, and mobile account forms", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toHaveCount(0);
    await page.getByLabel(/email address/i).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("link", { name: "Quilla", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("link", { name: "Create an account", exact: true })
      .click();
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
    await page.getByRole("link", { name: "Your account", exact: true }).click();
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
    // The unfinished sign-up must not grant dashboard access.
    const other = await page.context().newPage();
    await other.goto("/dashboard");
    await expect(other).toHaveURL(/\/sign-in/);
    await other.close();
    await enterCode(page);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    await expect(page.getByTestId("account-status")).toBeVisible();
    const users = await developmentClerk().users.getUserList({
      emailAddress: [identity.email],
      limit: 1,
    });
    expect(users.data[0]?.firstName).toBe(identity.firstName);
    expect(users.data[0]?.lastName).toBe(identity.lastName);
  });

  test("password sign-in, authenticated auth-page redirect, sign-out, and back navigation", async ({
    page,
    account,
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
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("password recovery completes and invalidates the old password", async ({
    page,
    account,
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
    const newPassword = `${randomBytes(20).toString("base64url")}aA9!`;
    const passwords = page.locator('input[type="password"]');
    await expect(passwords.first()).toBeVisible();
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
  });

  test("safe return destinations survive login and malicious destinations cannot escape the app", async ({
    page,
    account,
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
    account,
    secondAccount,
    browser,
  }) => {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: account.email });
    await page.goto("/dashboard");
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
      await expect(anonymous.getByTestId("account-status")).toBeVisible();
      expect(await page.evaluate(() => window.Clerk.user?.id)).toBe(account.id);
      expect(await anonymous.evaluate(() => window.Clerk.user?.id)).toBe(
        secondAccount.id,
      );
      await anonymous
        .getByRole("button", { name: "Sign out", exact: true })
        .click();
      await expect(anonymous).toHaveURL(/\/$/);
      await page.reload();
      await expect(page.getByTestId("account-status")).toBeVisible();
    } finally {
      await anonymousContext.close();
    }
  });

  test("revoking the actual disposable session removes account access", async ({
    page,
    account,
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
    await page.route(/clerk.*\.(js|mjs)(\?|$)/, (route) => {
      blocked = true;
      return route.abort();
    });
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("account-status")).toHaveCount(0);
    await expect.poll(() => blocked).toBe(true);
    await expect(page.getByLabel(/email address/i)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Back to home", exact: true }),
    ).toBeVisible();
  });
});

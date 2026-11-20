import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "./support/clerk";

const adminRoutes = [
  "/admin",
  "/admin/questions",
  "/admin/questions/new",
  "/admin/questions/not-a-version",
  "/admin/questions/not-a-version/revise",
] as const;

test.describe("admin question bank access control", () => {
  test("signed-out visitors are redirected before admin data renders", async ({
    page,
  }) => {
    await page.goto("/admin/questions");
    await expect(page).toHaveURL(/\/sign-in\?/);
    await expect(
      page.getByRole("heading", { name: "Question bank" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("admin-question-row")).toHaveCount(0);
  });

  test("non-admin accounts receive not found for every admin question route", async ({
    page,
    preparedAccount,
  }) => {
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress: preparedAccount.email });
    for (const route of adminRoutes) {
      await page.goto(route);
      await expect(page.getByText("404", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Question bank" }),
      ).toHaveCount(0);
      await expect(page.getByTestId("admin-question-row")).toHaveCount(0);
    }
  });
});

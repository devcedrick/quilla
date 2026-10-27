import { clerkSetup } from "@clerk/testing/playwright";
import { test } from "@playwright/test";
import { verifyConvexTemplate, verifyDevelopmentKeys } from "./support/clerk";

test("validate development credentials and obtain testing token", async () => {
  await verifyDevelopmentKeys();
  // Fail before synthetic fixture creation rather than timing out at dashboard access.
  await verifyConvexTemplate();
  try {
    await clerkSetup({
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      dotenv: false,
    });
  } catch {
    throw new Error(
      "Clerk testing setup failed; no provider response or credentials logged.",
    );
  }
});

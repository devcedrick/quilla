import { clerkSetup } from "@clerk/testing/playwright";
import { test } from "@playwright/test";
import { verifyDevelopmentKeys } from "./support/clerk";

test("validate development credentials and obtain testing token", async () => {
  await verifyDevelopmentKeys();
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

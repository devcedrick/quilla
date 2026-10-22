import "server-only";

import { validateClerkConfiguration } from "./configuration";

export function getClerkConfiguration() {
  return validateClerkConfiguration({
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}

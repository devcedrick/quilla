import { createClerkClient } from "@clerk/backend";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { test as base, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

// Clerk's routing helper can log full provider URLs when a context closes during
// a retry. Those URLs may include development-session tokens; retain only a
// sanitized warning. Assertion failures and unrelated diagnostics are unchanged.
for (const level of ["warn", "error"] as const) {
  const write = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("[Clerk Testing]")) {
      write(
        "[Clerk Testing] request retry/failure (URL and provider details redacted).",
      );
    } else {
      write(...args);
    }
  };
}

export function developmentClerk() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (
    !publishableKey?.startsWith("pk_test_") ||
    !secretKey?.startsWith("sk_test_")
  ) {
    throw new Error(
      "Auth tests require Clerk development credentials; live or missing keys are refused.",
    );
  }
  return createClerkClient({ secretKey, apiUrl: "https://api.clerk.com" });
}

export async function verifyDevelopmentKeys() {
  const api = developmentClerk();
  try {
    const instance = await api.instance.get();
    if (instance.environmentType !== "development")
      throw new Error("not_development");
    const host = Buffer.from(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.slice(8),
      "base64",
    )
      .toString("utf8")
      .replace(/\$$/, "");
    if (!/^[a-z0-9.-]+\.accounts\.dev$/.test(host))
      throw new Error("unexpected_host");
    const response = await fetch(`https://${host}/.well-known/jwks.json`, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("jwks_unavailable");
    const frontend: unknown = await response.json();
    if (
      typeof frontend !== "object" ||
      frontend === null ||
      !("keys" in frontend) ||
      !Array.isArray(frontend.keys)
    )
      throw new Error("invalid_jwks");
    const backend = await api.jwks.getJwks();
    const frontendKeys = frontend.keys;
    const matches = backend.keys?.some((key) =>
      frontendKeys.some(
        (candidate: unknown) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "kid" in candidate &&
          "n" in candidate &&
          "e" in candidate &&
          candidate.kid === key.kid &&
          candidate.n === key.n &&
          candidate.e === key.e,
      ),
    );
    if (!matches) throw new Error("pair_mismatch");
  } catch {
    throw new Error(
      "Clerk development instance/key-pair verification failed (provider details redacted).",
    );
  }
}

export async function verifyConvexTemplate() {
  try {
    const api = developmentClerk();
    let offset = 0;
    while (true) {
      const page = await api.jwtTemplates.list({ limit: 100, offset });
      const template = page.data.find((item) => item.name === "convex");
      if (template) {
        if (!("aud" in template.claims) || template.claims.aud !== "convex") {
          throw new Error("Unexpected audience");
        }
        return;
      }
      offset += page.data.length;
      if (page.data.length === 0 || offset >= page.totalCount) break;
    }
  } catch {
    throw new Error(
      "Could not verify the development Clerk convex JWT template (provider details redacted).",
    );
  }
  throw new Error(
    "Auth tests require a development Clerk JWT template named convex with audience convex. See docs/auth/clerk-development-setup.md; no settings were changed.",
  );
}

type Identity = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};
type Fixtures = {
  testingToken: void;
  identity: Identity;
  account: Identity & { id: string };
  secondAccount: Identity & { id: string };
};

let verifiedDevelopment: Promise<void> | undefined;

export const test = base.extend<Fixtures>({
  testingToken: [
    async ({ page }, provide) => {
      await setupClerkTestingToken({ page });
      await provide();
    },
    { auto: true },
  ],
  identity: async ({}, provide) => {
    // Also enforce the guard in fixture workers (including a --no-deps run).
    verifiedDevelopment ??= verifyDevelopmentKeys().then(verifyConvexTemplate);
    await verifiedDevelopment;
    // Each base address is unique even if subaddress restrictions change later.
    const identity = {
      email: `quilla-${randomUUID()}+clerk_test@example.com`,
      firstName: "Quilla",
      lastName: "Fixture",
      password: `${randomBytes(20).toString("base64url")}aA9!`,
    };
    const api = developmentClerk();
    try {
      await provide(identity);
    } finally {
      // Look up ONLY this run's unique synthetic email; never enumerate or delete real users.
      try {
        const users = await api.users.getUserList({
          emailAddress: [identity.email],
          limit: 2,
        });
        for (const user of users.data) {
          if (
            user.emailAddresses.some(
              (email) => email.emailAddress === identity.email,
            )
          ) {
            await api.users.deleteUser(user.id);
          }
        }
      } catch {
        throw new Error(
          "Synthetic Clerk fixture cleanup failed; provider details redacted.",
        );
      }
    }
  },
  account: async ({ identity }, provide) => {
    const api = developmentClerk();
    let id: string;
    try {
      const user = await api.users.createUser({
        firstName: identity.firstName,
        lastName: identity.lastName,
        emailAddress: [identity.email],
        password: identity.password,
      });
      id = user.id;
    } catch {
      throw new Error(
        "Synthetic Clerk fixture creation failed; verify development configuration (details redacted).",
      );
    }
    await provide({ ...identity, id });
  },
  secondAccount: async ({ account }, provide) => {
    const api = developmentClerk();
    const email = `quilla-${randomUUID()}+clerk_test@example.com`;
    let id: string;
    try {
      const user = await api.users.createUser({
        firstName: account.firstName,
        lastName: account.lastName,
        emailAddress: [email],
        password: account.password,
      });
      id = user.id;
    } catch {
      throw new Error(
        "Second synthetic Clerk fixture creation failed (details redacted).",
      );
    }
    try {
      await provide({ ...account, email, id });
    } finally {
      try {
        await api.users.deleteUser(id);
      } catch {
        throw new Error(
          "Second synthetic Clerk fixture cleanup failed (details redacted).",
        );
      }
    }
  },
});

export { expect };

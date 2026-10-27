// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Clerk issuer configuration", () => {
  it("keeps the existing Convex audience and HTTPS issuer", async () => {
    vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", "https://identity.example");
    const { default: config } = await import("./auth.config");
    expect(config.providers).toEqual([
      { domain: "https://identity.example", applicationID: "convex" },
    ]);
  });

  it.each([
    undefined,
    "",
    "not-an-origin",
    "http://identity.example",
    "https://secret@identity.example",
    "https://identity.example/path",
    "https://identity.example?secret=value",
    "https://identity.example#secret",
    " https://identity.example",
  ])(
    "rejects missing or invalid issuers without echoing values",
    async (issuer) => {
      vi.stubEnv("CLERK_JWT_ISSUER_DOMAIN", issuer);
      await expect(import("./auth.config")).rejects.toThrow(
        /CLERK_JWT_ISSUER_DOMAIN/,
      );
      if (issuer) {
        await expect(import("./auth.config")).rejects.not.toThrow(issuer);
      }
    },
  );
});

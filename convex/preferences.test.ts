// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import {
  requireOnboarding,
  requireDiagnosticEligibility,
} from "./lib/learning";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const identity = { issuer: "https://identity.example", subject: "alice" };
const otherIdentity = { ...identity, subject: "bob" };
const code = (operation: Promise<unknown>, value: string) =>
  expect(operation).rejects.toMatchObject({ data: { code: value } });
async function fixture() {
  const t = convexTest(schema, modules);
  const user = t.withIdentity(identity);
  const access = await user.mutation(api.users.ensureCurrentUser);
  return { t, user, id: access.userId };
}
describe("preparation preferences and gates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T16:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("keeps legacy profiles unonboarded and validates minimal reads", async () => {
    const { user } = await fixture();
    expect(await user.query(api.users.currentPreferences)).toEqual({
      preferredLevel: null,
      targetExamDate: null,
    });
    await code(user.run(requireOnboarding), "ONBOARDING_REQUIRED");
    expect(
      await user.query(api.learning.currentAccess, { level: "professional" }),
    ).toEqual({ level: "professional", status: "onboarding_required" });
  });
  it.each(["professional", "subprofessional"] as const)(
    "persists %s with idempotent saves and no identity/role reset",
    async (level) => {
      const { t, user, id } = await fixture();
      await t.run((ctx) => ctx.db.patch("users", id, { role: "admin" }));
      const args = { preferredLevel: level, targetExamDate: "2026-10-29" };
      await Promise.all([
        user.mutation(api.users.savePreferences, args),
        user.mutation(api.users.savePreferences, args),
      ]);
      expect(await user.query(api.users.currentPreferences)).toEqual(args);
      expect(await t.run((ctx) => ctx.db.get("users", id))).toMatchObject({
        role: "admin",
        status: "active",
        tokenIdentifier: `${identity.issuer}|${identity.subject}`,
        ...args,
      });
      await user.run(requireOnboarding);
      for (const requested of ["professional", "subprofessional"] as const) {
        await code(
          user.run((ctx) => requireDiagnosticEligibility(ctx, requested)),
          "DIAGNOSTIC_REQUIRED",
        );
        expect(
          (await user.query(api.learning.currentAccess, { level: requested }))
            .status,
        ).toBe("diagnostic_required");
      }
    },
  );
  it("preserves an omitted expired date on level change, but validates resubmitted dates and explicit clearing", async () => {
    const { user } = await fixture();
    await user.mutation(api.users.savePreferences, {
      preferredLevel: "professional",
      targetExamDate: "2026-10-29",
    });
    vi.setSystemTime(new Date("2026-10-30T16:00:00Z"));
    expect(
      await user.mutation(api.users.savePreferences, {
        preferredLevel: "subprofessional",
      }),
    ).toEqual({
      preferredLevel: "subprofessional",
      targetExamDate: "2026-10-29",
    });
    await code(
      user.mutation(api.users.savePreferences, {
        preferredLevel: "professional",
        targetExamDate: "2026-10-29",
      }),
      "INVALID_TARGET_DATE",
    );
    expect(
      await user.mutation(api.users.savePreferences, {
        preferredLevel: "professional",
        targetExamDate: null,
      }),
    ).toEqual({ preferredLevel: "professional", targetExamDate: null });
  });
  it("does not clear a concurrently supplied date when another save omits it", async () => {
    const { user } = await fixture();
    await Promise.all([
      user.mutation(api.users.savePreferences, {
        preferredLevel: "professional",
        targetExamDate: "2026-11-01",
      }),
      user.mutation(api.users.savePreferences, {
        preferredLevel: "subprofessional",
      }),
    ]);
    const saved = await user.query(api.users.currentPreferences);
    expect(saved.targetExamDate).toBe("2026-11-01");
    expect(["professional", "subprofessional"]).toContain(saved.preferredLevel);
  });
  it("uses the mutation clock across Manila midnight", async () => {
    vi.setSystemTime(new Date("2026-10-28T15:59:59Z"));
    const { user } = await fixture();
    await user.mutation(api.users.savePreferences, {
      preferredLevel: "professional",
      targetExamDate: "2026-10-28",
    });
    vi.setSystemTime(new Date("2026-10-28T16:00:00Z"));
    await code(
      user.mutation(api.users.savePreferences, {
        preferredLevel: "professional",
        targetExamDate: "2026-10-28",
      }),
      "INVALID_TARGET_DATE",
    );
    expect(
      (await user.query(api.users.currentPreferences)).targetExamDate,
    ).toBe("2026-10-28");
  });
  it.each(["2026-10-28", "2026-02-30", "2027-02-29", "bad"])(
    "rejects invalid date %s atomically",
    async (date) => {
      const { user } = await fixture();
      await code(
        user.mutation(api.users.savePreferences, {
          preferredLevel: "professional",
          targetExamDate: date,
        }),
        "INVALID_TARGET_DATE",
      );
      expect(
        (await user.query(api.users.currentPreferences)).preferredLevel,
      ).toBeNull();
    },
  );
  it("separates caller data and never accepts supplied identities, roles or unlock flags", async () => {
    const { t, user } = await fixture();
    const other = t.withIdentity(otherIdentity);
    await other.mutation(api.users.ensureCurrentUser);
    await user.mutation(api.users.savePreferences, {
      preferredLevel: "professional",
    });
    expect(
      (await other.query(api.users.currentPreferences)).preferredLevel,
    ).toBeNull();
    for (const extra of [
      { userId: "other" },
      { role: "admin" },
      { diagnosticCompleted: true },
    ]) {
      // Deliberately cross the runtime validation boundary; extra public args must fail.
      await expect(
        user.mutation(api.users.savePreferences, {
          preferredLevel: "professional",
          ...extra,
        }),
      ).rejects.toThrow();
    }
    await expect(
      user.mutation(api.users.savePreferences, {
        // @ts-expect-error Deliberate invalid enum at the public boundary.
        preferredLevel: "other",
      }),
    ).rejects.toThrow();
  });
  it("rejects unauthenticated, missing and suspended profiles, including admins", async () => {
    const { t, user, id } = await fixture();
    for (const client of [t, t.withIdentity(otherIdentity)]) {
      const error = client === t ? "UNAUTHENTICATED" : "PROFILE_REQUIRED";
      await code(client.query(api.users.currentPreferences), error);
      await code(
        client.mutation(api.users.savePreferences, {
          preferredLevel: "professional",
        }),
        error,
      );
      await code(
        client.query(api.learning.currentAccess, { level: "professional" }),
        error,
      );
    }
    await t.run((ctx) =>
      ctx.db.patch("users", id, { role: "admin", status: "suspended" }),
    );
    await code(user.query(api.users.currentPreferences), "ACCOUNT_SUSPENDED");
    await code(
      user.query(api.learning.currentAccess, { level: "subprofessional" }),
      "ACCOUNT_SUSPENDED",
    );
    await code(
      user.mutation(api.users.savePreferences, {
        preferredLevel: "professional",
      }),
      "ACCOUNT_SUSPENDED",
    );
    await code(
      user.run((ctx) => requireDiagnosticEligibility(ctx, "professional")),
      "ACCOUNT_SUSPENDED",
    );
  });
});

// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
  requireActiveUser,
  requireAdmin,
  requireIdentity,
  requireOwner,
} from "./lib/auth";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);
const alice = {
  issuer: "https://identity.example",
  subject: "alice",
  email: "same@example.test",
};
const bob = {
  issuer: "https://identity.example",
  subject: "bob",
  email: "same@example.test",
};

async function expectCode(operation: Promise<unknown>, code: string) {
  await expect(operation).rejects.toMatchObject({ data: { code } });
}

describe("application profiles", () => {
  it("requires verified identity for both public functions and every guard", async () => {
    const t = convexTest(schema, modules);
    await expectCode(t.query(api.users.currentAccess), "UNAUTHENTICATED");
    await expectCode(
      t.mutation(api.users.ensureCurrentUser),
      "UNAUTHENTICATED",
    );
    await expectCode(t.run(requireIdentity), "UNAUTHENTICATED");
    await expectCode(t.run(requireActiveUser), "UNAUTHENTICATED");
    await expectCode(t.run(requireAdmin), "UNAUTHENTICATED");
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "fixture-owner",
        role: "user",
        status: "active",
      }),
    );
    await expectCode(
      t.run((ctx) => requireOwner(ctx, ownerId)),
      "UNAUTHENTICATED",
    );
  });

  it("bootstraps an existing Clerk identity once and returns only application access", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity(alice);
    await expect(user.query(api.users.currentAccess)).resolves.toEqual({
      status: "missing_profile",
    });
    await expectCode(user.run(requireActiveUser), "PROFILE_REQUIRED");
    await expectCode(user.run(requireAdmin), "PROFILE_REQUIRED");
    const ownerId = await t
      .withIdentity(bob)
      .mutation(api.users.ensureCurrentUser);
    await expectCode(
      user.run((ctx) => requireOwner(ctx, ownerId.userId)),
      "PROFILE_REQUIRED",
    );
    const first = await user.mutation(api.users.ensureCurrentUser);
    const repeated = await user.mutation(api.users.ensureCurrentUser);
    expect(first).toEqual(repeated);
    expect(first).toEqual({
      status: "active",
      userId: expect.any(String),
      role: "user",
    });
    await expect(user.query(api.users.currentAccess)).resolves.toEqual(first);
    const stored = await t.run((ctx) => ctx.db.get("users", first.userId));
    expect(stored).toEqual({
      _id: first.userId,
      _creationTime: expect.any(Number),
      tokenIdentifier: `${alice.issuer}|${alice.subject}`,
      role: "user",
      status: "active",
    });
  });

  it("handles concurrent first access without duplicate profiles", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity(alice);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        user.mutation(api.users.ensureCurrentUser),
      ),
    );
    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    const records = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("by_tokenIdentifier", (q) =>
          q.eq("tokenIdentifier", `${alice.issuer}|${alice.subject}`),
        )
        .take(2),
    );
    expect(records).toHaveLength(1);
  });

  it("ignores role-like JWT claims and keeps email and issuer identities distinct", async () => {
    const t = convexTest(schema, modules);
    const first = await t
      .withIdentity({
        ...alice,
        role: "admin",
        publicMetadata: { role: "admin" },
      })
      .mutation(api.users.ensureCurrentUser);
    const second = await t
      .withIdentity(bob)
      .mutation(api.users.ensureCurrentUser);
    const third = await t
      .withIdentity({ ...alice, issuer: "https://other-identity.example" })
      .mutation(api.users.ensureCurrentUser);
    expect(first.role).toBe("user");
    expect(new Set([first.userId, second.userId, third.userId]).size).toBe(3);
    await expectCode(t.withIdentity(alice).run(requireAdmin), "FORBIDDEN");
  });

  it("preserves application-assigned admin roles on repeated bootstrap", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity(alice);
    const initial = await user.mutation(api.users.ensureCurrentUser);
    await t.run((ctx) =>
      ctx.db.patch("users", initial.userId, { role: "admin" }),
    );
    await expect(user.mutation(api.users.ensureCurrentUser)).resolves.toEqual({
      ...initial,
      role: "admin",
    });
    expect((await user.run(requireAdmin))._id).toBe(initial.userId);
  });

  it.each(["user", "admin"] as const)(
    "denies suspended %s accounts without resetting state",
    async (role) => {
      const t = convexTest(schema, modules);
      const user = t.withIdentity(alice);
      const initial = await user.mutation(api.users.ensureCurrentUser);
      await t.run((ctx) =>
        ctx.db.patch("users", initial.userId, { role, status: "suspended" }),
      );
      await expect(user.query(api.users.currentAccess)).resolves.toEqual({
        status: "suspended",
      });
      await expectCode(
        user.mutation(api.users.ensureCurrentUser),
        "ACCOUNT_SUSPENDED",
      );
      await expectCode(user.run(requireActiveUser), "ACCOUNT_SUSPENDED");
      await expectCode(user.run(requireAdmin), "ACCOUNT_SUSPENDED");
      await expectCode(
        user.run((ctx) => requireOwner(ctx, initial.userId)),
        "ACCOUNT_SUSPENDED",
      );
      expect(
        await t.run((ctx) => ctx.db.get("users", initial.userId)),
      ).toMatchObject({ role, status: "suspended" });
    },
  );

  it("requires resource ownership even for an active admin", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(alice);
    const other = t.withIdentity(bob);
    const ownerProfile = await owner.mutation(api.users.ensureCurrentUser);
    const otherProfile = await other.mutation(api.users.ensureCurrentUser);
    expect(
      (await owner.run((ctx) => requireOwner(ctx, ownerProfile.userId)))._id,
    ).toBe(ownerProfile.userId);
    await expectCode(
      other.run((ctx) => requireOwner(ctx, ownerProfile.userId)),
      "FORBIDDEN",
    );
    await t.run((ctx) =>
      ctx.db.patch("users", otherProfile.userId, { role: "admin" }),
    );
    await expectCode(
      other.run((ctx) => requireOwner(ctx, ownerProfile.userId)),
      "FORBIDDEN",
    );
  });

  it("rejects client-supplied identity and role arguments", async () => {
    const t = convexTest(schema, modules).withIdentity(alice);
    for (const args of [
      { userId: "spoofed" },
      { tokenIdentifier: "spoofed" },
      { role: "admin" },
      { status: "active" },
    ]) {
      await expect(
        // @ts-expect-error Exercise malicious wire arguments rejected by the validator.
        t.mutation(api.users.ensureCurrentUser, args),
      ).rejects.toThrow();
      // @ts-expect-error Exercise malicious wire arguments rejected by the validator.
      await expect(t.query(api.users.currentAccess, args)).rejects.toThrow();
    }
    await expect(t.query(api.users.currentAccess)).resolves.toEqual({
      status: "missing_profile",
    });
  });

  it("fails closed without exposing duplicate identity records", async () => {
    const t = convexTest(schema, modules);
    const tokenIdentifier = "private-duplicate-identity";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        tokenIdentifier,
        role: "user",
        status: "active",
      });
      await ctx.db.insert("users", {
        tokenIdentifier,
        role: "admin",
        status: "active",
      });
    });
    const user = t.withIdentity({ ...alice, tokenIdentifier });
    for (const operation of [
      user.query(api.users.currentAccess),
      user.mutation(api.users.ensureCurrentUser),
      user.run(requireActiveUser),
    ]) {
      try {
        await operation;
        expect.fail("Expected account denial");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(error).toMatchObject({ data: { code: "ACCOUNT_UNAVAILABLE" } });
        expect(String(error)).not.toContain(tokenIdentifier);
      }
    }
  });
});

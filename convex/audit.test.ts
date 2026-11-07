// @vitest-environment edge-runtime
import { defineTestApp } from "convex-test";
import { describe, expect, it } from "vitest";
import * as audit from "./audit";
import schema from "./schema";
import { appendAdminAudit } from "./lib/audit";

// Typed in-memory API avoids deployment/codegen solely to execute tests.
const { api, createTest } = defineTestApp({ schema }).defineModules({ audit });
const paginationOpts = { numItems: 10, cursor: null };
const event = {
  entityType: "question",
  entityId: "q1",
  action: "revise",
  before: null,
  after: { version: 2 },
};

async function fixture() {
  const t = createTest();
  const identity = { issuer: "https://identity.example", subject: "admin" };
  const id = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier: `${identity.issuer}|${identity.subject}`,
      role: "admin",
      status: "active",
    }),
  );
  return { t, admin: t.withIdentity(identity), id };
}

describe("admin audit", () => {
  it("derives actor/time, preserves snapshots and exposes only reads", async () => {
    const { admin, id } = await fixture();
    const before = Date.now();
    const spoofed = {
      ...event,
      actorId: "client-nominated-actor",
      occurredAt: -1,
    };
    await admin.run((ctx) => appendAdminAudit(ctx, spoofed));
    const result = await admin.query(api.audit.listRecent, { paginationOpts });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      actorId: id,
      entityId: "q1",
      beforeJson: null,
      afterJson: '{"version":2}',
    });
    expect(result.page[0].occurredAt).toBeGreaterThanOrEqual(before);
    expect(result.page[0].occurredAt).toBeLessThanOrEqual(Date.now());
    expect(Object.keys(audit).sort()).toEqual([
      "listByActor",
      "listByEntity",
      "listRecent",
    ]);
    expect(
      (
        await admin.query(api.audit.listRecent, {
          paginationOpts: { numItems: 100, cursor: null },
        })
      ).page,
    ).toHaveLength(1);
  });

  it("refuses anonymous, missing-profile, regular and suspended actors on every read and helper", async () => {
    const { t, id } = await fixture();
    const missing = t.withIdentity({
      issuer: "https://identity.example",
      subject: "missing",
    });
    const user = t.withIdentity({
      issuer: "https://identity.example",
      subject: "user",
    });
    const suspended = t.withIdentity({
      issuer: "https://identity.example",
      subject: "suspended",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        tokenIdentifier: "https://identity.example|user",
        role: "user",
        status: "active",
      });
      await ctx.db.insert("users", {
        tokenIdentifier: "https://identity.example|suspended",
        role: "admin",
        status: "suspended",
      });
    });
    for (const [client, code] of [
      [t, "UNAUTHENTICATED"],
      [missing, "PROFILE_REQUIRED"],
      [user, "FORBIDDEN"],
      [suspended, "ACCOUNT_SUSPENDED"],
    ] as const) {
      for (const operation of [
        () => client.query(api.audit.listRecent, { paginationOpts }),
        () =>
          client.query(api.audit.listByActor, { actorId: id, paginationOpts }),
        () =>
          client.query(api.audit.listByEntity, {
            entityType: "question",
            entityId: "q1",
            paginationOpts,
          }),
        () => client.run((ctx) => appendAdminAudit(ctx, event)),
      ])
        await expect(operation()).rejects.toMatchObject({ data: { code } });
    }
    expect(await t.run((ctx) => ctx.db.query("auditEvents").take(1))).toEqual(
      [],
    );
  });

  it("paginates descending with no overlap and isolates entity and actor filters", async () => {
    const { t, admin, id } = await fixture();
    const otherId = await t.run((ctx) =>
      ctx.db.insert("users", {
        tokenIdentifier: "other",
        role: "admin",
        status: "active",
      }),
    );
    await t.run(async (ctx) => {
      for (let n = 0; n < 4; n++)
        await ctx.db.insert("auditEvents", {
          actorId: n === 3 ? otherId : id,
          entityType: n === 2 ? "taxonomy" : "question",
          entityId: n === 1 ? "q2" : "q1",
          action: "fixture",
          beforeJson: null,
          afterJson: null,
          occurredAt: n,
        });
    });
    const first = await admin.query(api.audit.listRecent, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    const second = await admin.query(api.audit.listRecent, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect([...first.page, ...second.page].map((r) => r.occurredAt)).toEqual([
      3, 2, 1, 0,
    ]);
    expect(second.isDone).toBe(true);
    expect(
      (
        await admin.query(api.audit.listByEntity, {
          entityType: "question",
          entityId: "q1",
          paginationOpts,
        })
      ).page.map((r) => r.occurredAt),
    ).toEqual([3, 0]);
    expect(
      (
        await admin.query(api.audit.listByActor, {
          actorId: id,
          paginationOpts,
        })
      ).page.map((r) => r.occurredAt),
    ).toEqual([2, 1, 0]);
  });

  it.each([0, -1, 101, 1.5])(
    "rejects page size %s on each endpoint",
    async (numItems) => {
      const { admin, id } = await fixture();
      const opts = { numItems, cursor: null };
      for (const operation of [
        () => admin.query(api.audit.listRecent, { paginationOpts: opts }),
        () =>
          admin.query(api.audit.listByActor, {
            actorId: id,
            paginationOpts: opts,
          }),
        () =>
          admin.query(api.audit.listByEntity, {
            entityType: "question",
            entityId: "q1",
            paginationOpts: opts,
          }),
      ])
        await expect(operation()).rejects.toMatchObject({
          data: { code: "INVALID_PAGE_SIZE" },
        });
    },
  );

  it("enforces UTF-8 snapshot bounds and rejects lossy/nonserializable snapshots", async () => {
    const { admin } = await fixture();
    // JSON quotes use two bytes; ASCII at the exact limit succeeds.
    await admin.run((ctx) =>
      appendAdminAudit(ctx, { ...event, after: "x".repeat(16382) }),
    );
    for (const after of [
      "x".repeat(16383),
      "é".repeat(8192),
      { n: NaN },
      { n: Infinity },
    ]) {
      await expect(
        admin.run((ctx) => appendAdminAudit(ctx, { ...event, after })),
      ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
    }
    // The helper is a trusted typed boundary; use a recursive JSON type for a cycle fixture.
    const recursive: { [key: string]: typeof recursive } = {};
    recursive.self = recursive;
    await expect(
      admin.run((ctx) => appendAdminAudit(ctx, { ...event, after: recursive })),
    ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
  });

  it("rejects invalid metadata without inserting an audit event", async () => {
    const { t, admin } = await fixture();
    for (const patch of [
      { entityType: " " },
      { entityType: "x".repeat(101) },
      { entityId: "" },
      { entityId: "x".repeat(257) },
      { action: " " },
      { action: "x".repeat(101) },
    ]) {
      await expect(
        admin.run((ctx) => appendAdminAudit(ctx, { ...event, ...patch })),
      ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
    }
    expect(await t.run((ctx) => ctx.db.query("auditEvents").take(1))).toEqual(
      [],
    );
    for (const patch of [
      { entityType: " " },
      { entityId: "" },
      { entityId: "x".repeat(257) },
    ]) {
      await expect(
        admin.query(api.audit.listByEntity, {
          entityType: "question",
          entityId: "q1",
          ...patch,
          paginationOpts,
        }),
      ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
    }
  });

  it("rolls back the domain change and audit insert when the transaction fails", async () => {
    const { t, admin, id } = await fixture();
    await expect(
      admin.run(async (ctx) => {
        await ctx.db.patch("users", id, { preferredLevel: "professional" });
        await appendAdminAudit(ctx, {
          ...event,
          entityType: "user",
          entityId: id,
        });
        throw new Error("synthetic domain failure");
      }),
    ).rejects.toThrow("synthetic domain failure");
    expect(
      (await t.run((ctx) => ctx.db.get("users", id)))?.preferredLevel,
    ).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("auditEvents").take(1))).toEqual(
      [],
    );
    await expect(
      admin.run(async (ctx) => {
        await ctx.db.patch("users", id, { preferredLevel: "professional" });
        await appendAdminAudit(ctx, { ...event, after: "x".repeat(17000) });
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_AUDIT_DATA" } });
    expect(
      (await t.run((ctx) => ctx.db.get("users", id)))?.preferredLevel,
    ).toBeUndefined();
  });
});

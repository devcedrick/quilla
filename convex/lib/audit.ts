import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin } from "./auth";

export const auditEventFields = {
  actorId: v.id("users"),
  entityType: v.string(),
  entityId: v.string(),
  action: v.string(),
  beforeJson: v.union(v.null(), v.string()),
  afterJson: v.union(v.null(), v.string()),
  occurredAt: v.number(),
};

type Snapshot =
  null | boolean | number | string | Snapshot[] | { [key: string]: Snapshot };
type AuditEvent = {
  entityType: string;
  entityId: string;
  action: string;
  before: Snapshot;
  after: Snapshot;
};

/** Create a sanitized validation error without exposing snapshot contents. */
function invalidAudit() {
  return new ConvexError({
    code: "INVALID_AUDIT_DATA",
    message: "Invalid audit metadata or snapshot.",
  });
}

/** Validate bounded nonblank audit metadata. */
export function validateAuditIdentifier(value: string, maximum: number) {
  if (!value.trim() || value.length > maximum) throw invalidAudit();
}

/** Serialize JSON snapshots without lossy values and enforce the UTF-8 limit. */
function serialize(snapshot: Snapshot): string | null {
  if (snapshot === null) return null;
  try {
    const encoded = JSON.stringify(snapshot, (_key, value: unknown) => {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
      )
        return value;
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (
        typeof value === "object" &&
        (Array.isArray(value) ||
          Object.getPrototypeOf(value) === Object.prototype ||
          Object.getPrototypeOf(value) === null)
      )
        return value;
      throw invalidAudit();
    });
    if (new TextEncoder().encode(encoded).byteLength > 16 * 1024)
      throw invalidAudit();
    return encoded;
  } catch {
    // Do not expose snapshot values, serialization errors, or credentials.
    throw invalidAudit();
  }
}

/** Call inside the domain mutation; pass only explicitly allowlisted snapshots. */
async function insertAudit(
  ctx: MutationCtx,
  actorId: Id<"users">,
  event: AuditEvent,
) {
  validateAuditIdentifier(event.entityType, 100);
  validateAuditIdentifier(event.entityId, 256);
  validateAuditIdentifier(event.action, 100);
  return await ctx.db.insert("auditEvents", {
    actorId,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    beforeJson: serialize(event.before),
    afterJson: serialize(event.after),
    occurredAt: Date.now(),
  });
}

/** Attribute an event to an already-authorized admin or system actor. */
export async function appendActorAudit(
  ctx: MutationCtx,
  actor: Doc<"users">,
  event: AuditEvent,
) {
  if (
    actor.status !== "active" ||
    (actor.role !== "admin" && actor.role !== "system")
  )
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "This actor cannot write audit events.",
    });
  return insertAudit(ctx, actor._id, event);
}

/** Call inside an authorized domain mutation; the actor is resolved from identity. */
export async function appendAdminAudit(ctx: MutationCtx, event: AuditEvent) {
  const actor = await requireAdmin(ctx);
  return insertAudit(ctx, actor._id, event);
}

/** Internal bootstrap path only: attribute an event to a non-login system actor. */
export async function appendSystemAudit(
  ctx: MutationCtx,
  actorId: Id<"users">,
  event: AuditEvent,
) {
  const actor = await ctx.db.get("users", actorId);
  if (!actor || actor.role !== "system" || actor.status !== "active")
    throw new ConvexError({
      code: "BOOTSTRAP_SYSTEM_ACTOR_REQUIRED",
      message: "System audit attribution is unavailable.",
    });
  return insertAudit(ctx, actorId, event);
}

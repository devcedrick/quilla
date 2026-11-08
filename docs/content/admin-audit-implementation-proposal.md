# Proposed protected changes for #24: transactional admin audit

**Status: schema/authorization proposal approved by the maintainer on 6 November
2026; implementation and in-memory verification are local, not deployed.**

This proposal is the first protected step in #95's prerequisite sequence. It
changes no existing identity provider, user roles or user-table fields. Later
taxonomy, lifecycle and import schemas require their own concrete review.

## Storage and read interface

Add an `auditEvents` table with required fields:

| Field      | Validator / meaning                                                   |
| ---------- | --------------------------------------------------------------------- |
| actorId    | `v.id("users")`; derived from the authenticated active admin          |
| entityType | Nonempty bounded string supplied by trusted domain code               |
| entityId   | Nonempty bounded stable entity identity supplied by domain code       |
| action     | Nonempty bounded action name supplied by domain code                  |
| beforeJson | `v.union(v.null(), v.string())`; server-serialized prior snapshot     |
| afterJson  | `v.union(v.null(), v.string())`; server-serialized resulting snapshot |
| occurredAt | `v.number()`; mutation-time timestamp, never client-supplied          |

Use indexes `by_occurredAt`, `by_actorId_and_occurredAt` and
`by_entityType_and_entityId_and_occurredAt`. Public read APIs are `listRecent`,
`listByActor` and `listByEntity`. Every query calls the existing `requireAdmin`,
uses its index in descending order and native pagination. Accept 1–100 items per
page; reject invalid sizes. Actor/entity filters identify audited resources only,
never the requesting identity. Unauthenticated, suspended and nonadmin callers
receive no audit records. Actor IDs remain durable references, not email copies.

## Write boundary

Implement an unregistered server helper `appendAdminAudit(ctx, event)` under
`convex/lib/`. It derives the actor via existing `requireAdmin`, serializes
allowlisted domain snapshots, validates metadata lengths (entity type/action
1–100 characters, entity identity 1–256), and rejects either serialized snapshot
over 16 KiB in UTF-8. Null represents absent before/after state. Domain callers
must supply explicitly constructed snapshots; never pass arbitrary request
objects, credentials, tokens or raw user profiles. Invalid serialization/size
fails the transaction rather than silently truncating evidence.

Call it inside the domain mutation's transaction, after computing the change and
before returning. Do not create a public append mutation, a separate scheduled
audit write, or any update/delete API. Domain and audit writes both roll back on
failure. Successful idempotent no-op imports must avoid calling the helper; their
deduplication belongs to #95, not a second logging mechanism.

## Proposed files and tests

Extend `convex/schema.ts`; add the shared validators/helper, `convex/audit.ts`
read queries and `convex/audit.test.ts`. Reuse `convex/lib/auth.ts` unchanged.
Do not hand-edit generated bindings or deploy to generate them.

Use convex-test fixtures to prove active-admin reads, unauthenticated/wrong-role/
suspended refusal, entity and actor isolation, page bounds/order, server-derived
actor/time, snapshot limits, no exported write/delete surface, and rollback of
both a synthetic domain write and its audit insert. No production or development
deployment is contacted. Run lint, typecheck, full units, Knip and build; record
any environment-dependent build limitation.

## Approval boundary

The maintainer approved only this new table, indexed admin-only read surface and
unregistered transactional write helper for #24 implementation. This is not approval to
modify authentication, deploy, migrate, import or publish. Further protected
changes for #29/#32/#95 will be proposed after this prerequisite is validated.

## Local implementation

`convex/audit.ts` implements the three read queries; `convex/lib/audit.ts` holds
the unregistered helper and shared validators. There is no standalone audit write
endpoint or change to existing identity guards. Future domain mutations must
explicitly call the helper inside their transaction. This does not retroactively
audit existing profile/preference operations or implement a domain admin mutation.

Tests use convex-test's typed `defineTestApp` references without altering generated
bindings. Normal supported API generation remains part of a later authorized
Convex workflow before typed application consumers adopt these queries. No live
schema/deployment validation has been performed. Append-only guarantees apply to
application APIs; privileged operators with direct database access remain outside
that boundary.

## Verification result

Local verification on 6 November 2026: all 403 unit tests passed, including 10
audit tests. Lint, strict typecheck, Knip, scoped formatting and whitespace checks
passed. The production build completed compilation, TypeScript and page
generation, then exited with `SecurityFatalError` reporting a known vulnerability
in the installed Next.js version. Dependency remediation is separate work; the
build is recorded as failed, not waived. The build also warned about a lockfile
outside the repository. E2E was not run because this adds backend primitives with
no changed browser journey. No generated bindings, deployment or live data were
changed.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { appendSystemAudit } from "./lib/audit";
import { questionWorkflowError as fail } from "./lib/questionWorkflow";
import {
  ensureSystemUser,
  requireBootstrapTarget,
  requireKnownBootstrapTarget,
} from "./lib/seedBootstrapProtocol";
import { loadCatalog, taxonomyState, type TaxonomyEntry } from "./lib/taxonomy";
import {
  assertSeedTaxonomyCatalog,
  catalogMatchesFrozen,
  systemTaxonomyInstallerIdentifier,
  taxonomyCounts,
} from "./lib/taxonomyBootstrap";
import { initialV2Catalog } from "./lib/taxonomyCatalog";
import { seedTaxonomyPolicy } from "../lib/question-import-contract.mjs";

const taxonomyCountsValidator = v.object({
  level: v.number(),
  difficulty: v.number(),
  language: v.number(),
  subject: v.number(),
  subtopic: v.number(),
  concept: v.number(),
  total: v.number(),
});

const installResult = v.object({
  taxonomyVersionId: v.id("taxonomyVersions"),
  taxonomyId: v.string(),
  state: v.literal("sealed"),
  revision: v.number(),
  created: v.boolean(),
  counts: taxonomyCountsValidator,
  digest: v.string(),
});

const verifyResult = v.union(
  v.object({
    present: v.literal(false),
    target: v.string(),
    taxonomyId: v.string(),
    expectedDigest: v.string(),
    expectedCounts: taxonomyCountsValidator,
  }),
  v.object({
    present: v.literal(true),
    target: v.string(),
    taxonomyVersionId: v.id("taxonomyVersions"),
    taxonomyId: v.string(),
    state: taxonomyState,
    revision: v.number(),
    sealed: v.boolean(),
    archivedEntries: v.number(),
    counts: taxonomyCountsValidator,
    matchesExpected: v.boolean(),
    expectedDigest: v.string(),
    expectedCounts: taxonomyCountsValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
);

/** Reject a catalog digest that differs from the reviewed frozen value. */
function requireCatalogDigest(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value) || value !== seedTaxonomyPolicy.digest)
    fail("TAXONOMY_CATALOG_MISMATCH");
}

/**
 * Install and seal the reviewed taxonomy atomically. Internal deploy-key access
 * plus the target registry, the bootstrap window, and the pinned digest are the
 * complete authorization boundary; no client-supplied actor establishes identity.
 */
export const install = internalMutation({
  args: { target: v.string(), catalogDigest: v.string() },
  returns: installResult,
  handler: async (ctx, args) => {
    requireBootstrapTarget(args.target);
    requireCatalogDigest(args.catalogDigest);
    const counts = await assertSeedTaxonomyCatalog(initialV2Catalog);

    const existing = await ctx.db
      .query("taxonomyVersions")
      .withIndex("by_taxonomyId", (q) =>
        q.eq("taxonomyId", seedTaxonomyPolicy.taxonomyId),
      )
      .unique();
    if (existing) {
      const rows: TaxonomyEntry[] = await loadCatalog(ctx, existing._id);
      if (existing.state !== "sealed" || !catalogMatchesFrozen(rows))
        fail("TAXONOMY_VERSION_CONFLICT");
      return {
        taxonomyVersionId: existing._id,
        taxonomyId: existing.taxonomyId,
        state: "sealed" as const,
        revision: existing.revision,
        created: false,
        counts: taxonomyCounts(rows),
        digest: seedTaxonomyPolicy.digest,
      };
    }

    // Every guard above fails closed before this point, so a rejected request
    // creates neither the installer identity nor a partial draft.
    const actor = await ensureSystemUser(
      ctx,
      systemTaxonomyInstallerIdentifier,
    );
    const now = Date.now();
    const taxonomyVersionId = await ctx.db.insert("taxonomyVersions", {
      taxonomyId: seedTaxonomyPolicy.taxonomyId,
      state: "draft",
      revision: 1,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    for (const entry of initialV2Catalog)
      await ctx.db.insert("taxonomyEntries", {
        ...entry,
        taxonomyVersionId,
      });
    await appendSystemAudit(ctx, actor._id, {
      entityType: "taxonomy_version",
      entityId: taxonomyVersionId,
      action: "seed_install",
      before: null,
      after: {
        taxonomyId: seedTaxonomyPolicy.taxonomyId,
        state: "draft",
        revision: 1,
        digest: seedTaxonomyPolicy.digest,
        counts,
      },
    });
    const revision = 2;
    await ctx.db.patch("taxonomyVersions", taxonomyVersionId, {
      state: "sealed",
      revision,
      updatedAt: Date.now(),
    });
    await appendSystemAudit(ctx, actor._id, {
      entityType: "taxonomy_version",
      entityId: taxonomyVersionId,
      action: "sealed",
      before: { state: "draft", revision: 1 },
      after: {
        state: "sealed",
        revision,
        digest: seedTaxonomyPolicy.digest,
        counts,
      },
    });
    return {
      taxonomyVersionId,
      taxonomyId: seedTaxonomyPolicy.taxonomyId,
      state: "sealed" as const,
      revision,
      created: true,
      counts,
      digest: seedTaxonomyPolicy.digest,
    };
  },
});

/**
 * Read-only installation evidence. The registry guard is used without the
 * bootstrap window so verification remains available after it closes.
 */
export const verify = internalQuery({
  args: { target: v.string() },
  returns: verifyResult,
  handler: async (ctx, { target }) => {
    requireKnownBootstrapTarget(target);
    // Fail closed if the deployed fixture no longer matches the pinned digest.
    const expectedCounts = await assertSeedTaxonomyCatalog(initialV2Catalog);
    const version = await ctx.db
      .query("taxonomyVersions")
      .withIndex("by_taxonomyId", (q) =>
        q.eq("taxonomyId", seedTaxonomyPolicy.taxonomyId),
      )
      .unique();
    if (!version)
      return {
        present: false as const,
        target,
        taxonomyId: seedTaxonomyPolicy.taxonomyId,
        expectedDigest: seedTaxonomyPolicy.digest,
        expectedCounts,
      };
    const rows: TaxonomyEntry[] = await loadCatalog(ctx, version._id);
    return {
      present: true as const,
      target,
      taxonomyVersionId: version._id,
      taxonomyId: version.taxonomyId,
      state: version.state,
      revision: version.revision,
      sealed: version.state === "sealed",
      archivedEntries: rows.filter((entry) => entry.archived).length,
      counts: taxonomyCounts(rows),
      matchesExpected: version.state === "sealed" && catalogMatchesFrozen(rows),
      expectedDigest: seedTaxonomyPolicy.digest,
      expectedCounts,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    };
  },
});

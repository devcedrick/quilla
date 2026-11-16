import { seedTaxonomyPolicy } from "../../lib/question-import-contract.mjs";
import { digest } from "./questionContent";
import { questionWorkflowError as fail } from "./questionWorkflow";
import { initialV2Catalog } from "./taxonomyCatalog";
import {
  taxonomyEntryValue,
  validateCatalog,
  type TaxonomyEntry,
} from "./taxonomy";

export const systemTaxonomyInstallerIdentifier =
  "system:seed-taxonomy-installer";

const taxonomyKinds = [
  "level",
  "difficulty",
  "language",
  "subject",
  "subtopic",
  "concept",
] as const;

export type TaxonomyCounts = Record<(typeof taxonomyKinds)[number], number> & {
  total: number;
};

/** Count one catalog by kind without trusting an operator-supplied summary. */
export function taxonomyCounts(
  entries: readonly Pick<TaxonomyEntry, "kind">[],
): TaxonomyCounts {
  const counts: Record<(typeof taxonomyKinds)[number], number> = {
    level: 0,
    difficulty: 0,
    language: 0,
    subject: 0,
    subtopic: 0,
    concept: 0,
  };
  for (const entry of entries) counts[entry.kind] += 1;
  return { ...counts, total: entries.length };
}

/**
 * Require the exact frozen catalog, not merely a complete-looking one. The
 * digest pins labels, eligibility, and paths, so a modified frozen fixture can
 * never be installed under the reviewed identifiers.
 */
export async function assertSeedTaxonomyCatalog(
  entries: TaxonomyEntry[],
  taxonomyId: string = seedTaxonomyPolicy.taxonomyId,
) {
  if (taxonomyId !== seedTaxonomyPolicy.taxonomyId)
    fail("TAXONOMY_CATALOG_MISMATCH");
  try {
    validateCatalog(entries, true);
  } catch {
    // Never echo validator details or the candidate content.
    fail("TAXONOMY_CATALOG_MISMATCH");
  }
  const counts = taxonomyCounts(entries);
  if (
    counts.total !== seedTaxonomyPolicy.expectedEntries ||
    taxonomyKinds.some(
      (kind) => counts[kind] !== seedTaxonomyPolicy.expectedCounts[kind],
    )
  )
    fail("TAXONOMY_CATALOG_MISMATCH");
  if ((await digest(entries)) !== seedTaxonomyPolicy.digest)
    fail("TAXONOMY_CATALOG_MISMATCH");
  return counts;
}

/**
 * Compare stored rows with the frozen catalog order-insensitively. Database
 * insertion order is not part of the contract; identity, label, archived state,
 * paths, and sorted eligibility are.
 */
export function catalogMatchesFrozen(rows: readonly TaxonomyEntry[]) {
  if (rows.length !== initialV2Catalog.length) return false;
  const expected = new Map(
    initialV2Catalog.map((entry) => [
      `${entry.kind}:${entry.key}`,
      JSON.stringify(taxonomyEntryValue(entry)),
    ]),
  );
  const seen = new Set<string>();
  for (const row of rows) {
    const identity = `${row.kind}:${row.key}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    if (expected.get(identity) !== JSON.stringify(taxonomyEntryValue(row)))
      return false;
  }
  return seen.size === expected.size;
}

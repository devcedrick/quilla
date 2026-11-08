import { ConvexError, v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const taxonomyState = v.union(
  v.literal("draft"),
  v.literal("sealed"),
  v.literal("archived"),
);
export const taxonomyKind = v.union(
  v.literal("level"),
  v.literal("subject"),
  v.literal("subtopic"),
  v.literal("concept"),
  v.literal("difficulty"),
  v.literal("language"),
);
const common = { key: v.string(), label: v.string(), archived: v.boolean() };
export const taxonomyEntry = v.union(
  v.object({ ...common, kind: v.literal("level") }),
  v.object({ ...common, kind: v.literal("difficulty") }),
  v.object({ ...common, kind: v.literal("language") }),
  v.object({
    ...common,
    kind: v.literal("subject"),
    levels: v.array(v.string()),
  }),
  v.object({
    ...common,
    kind: v.literal("subtopic"),
    subjectKey: v.string(),
    levels: v.array(v.string()),
  }),
  v.object({
    ...common,
    kind: v.literal("concept"),
    subjectKey: v.string(),
    subtopicKey: v.string(),
    levels: v.array(v.string()),
  }),
);
export type TaxonomyEntry = Infer<typeof taxonomyEntry>;
export const levels = ["professional", "subprofessional"];
export const subjects = [
  "general_information",
  "verbal_ability",
  "numerical_ability",
  "analytical_ability",
  "clerical_ability",
];
const foundation = {
  level: levels,
  subject: subjects,
  difficulty: ["easy", "medium", "hard"],
  language: ["english", "filipino"],
};
/** Reject a taxonomy operation with a stable domain error code. */
export function taxonomyError(code: string): never {
  throw new ConvexError({
    code,
    message: "Taxonomy operation rejected: " + code,
  });
}
/** Validate the bounded stable taxonomy identifier format. */
export function identifier(key: string) {
  if (!/^[a-z0-9_-]{1,100}$/.test(key)) taxonomyError("INVALID_IDENTIFIER");
}

/** Validate bounded catalogs, including archived paths and active-parent eligibility. */
export function validateCatalog(entries: TaxonomyEntry[], complete = false) {
  if (entries.length > 128) taxonomyError("CATALOG_LIMIT");
  const keys = new Set<string>();
  for (const e of entries) {
    identifier(e.key);
    if (!e.label.trim() || e.label.length > 200) taxonomyError("INVALID_LABEL");
    const identity = e.kind + ":" + e.key;
    if (keys.has(identity)) taxonomyError("DUPLICATE_IDENTITY");
    keys.add(identity);
    if (
      e.kind in foundation &&
      !(
        foundation[e.kind as keyof typeof foundation] as readonly string[]
      ).includes(e.key)
    )
      taxonomyError("UNKNOWN_FOUNDATION");
    if (!("levels" in e)) continue;
    if (
      !e.levels.length ||
      new Set(e.levels).size !== e.levels.length ||
      e.levels.some((l) => !levels.includes(l))
    )
      taxonomyError("INVALID_ELIGIBILITY");
    for (const level of e.levels)
      if (
        !entries.some(
          (p) =>
            p.kind === "level" &&
            p.key === level &&
            (e.archived || !p.archived),
        )
      )
        taxonomyError("MISSING_PARENT");
    if (e.kind === "subject") {
      const expected =
        e.key === "analytical_ability"
          ? [levels[0]]
          : e.key === "clerical_ability"
            ? [levels[1]]
            : levels;
      if (
        e.levels.length !== expected.length ||
        expected.some((l) => !e.levels.includes(l))
      )
        taxonomyError("INVALID_ELIGIBILITY");
    } else {
      const parent = entries.find(
        (p) =>
          p.kind === "subject" &&
          p.key === e.subjectKey &&
          (e.archived || !p.archived),
      );
      if (!parent || !("levels" in parent)) taxonomyError("MISSING_PARENT");
      if (e.levels.some((l) => !parent.levels.includes(l)))
        taxonomyError("INVALID_ELIGIBILITY");
      if (e.kind === "concept") {
        const sub = entries.find(
          (p) =>
            p.kind === "subtopic" &&
            p.key === e.subtopicKey &&
            (e.archived || !p.archived),
        );
        if (!sub || sub.kind !== "subtopic" || sub.subjectKey !== e.subjectKey)
          taxonomyError("MISSING_PARENT");
        if (e.levels.some((l) => !sub.levels.includes(l)))
          taxonomyError("INVALID_ELIGIBILITY");
      }
    }
  }
  if (complete) {
    for (const [kind, required] of Object.entries(foundation))
      for (const key of required) {
        if (
          !entries.some((e) => e.kind === kind && e.key === key && !e.archived)
        )
          taxonomyError("INCOMPLETE_CATALOG");
      }
    for (const key of subjects)
      if (
        !entries.some(
          (e) => e.kind === "concept" && e.subjectKey === key && !e.archived,
        )
      )
        taxonomyError("INCOMPLETE_CATALOG");
  }
}

/** Load one bounded catalog through its version index. */
export async function loadCatalog(
  ctx: Pick<QueryCtx, "db">,
  id: Id<"taxonomyVersions">,
) {
  const rows = await ctx.db
    .query("taxonomyEntries")
    .withIndex("by_taxonomyVersionId", (q) => q.eq("taxonomyVersionId", id))
    .take(129);
  if (rows.length > 128) taxonomyError("CATALOG_LIMIT");
  return rows;
}

/** Trusted domain helper: never creates reference data or authorizes the caller. */
export async function validateTaxonomySelection(
  ctx: Pick<QueryCtx, "db">,
  selection: {
    taxonomyId: string;
    subjectKey: string;
    subtopicKey: string;
    conceptKey: string;
    level: string;
    language: string;
    difficulty: string;
  },
) {
  const version = await ctx.db
    .query("taxonomyVersions")
    .withIndex("by_taxonomyId", (q) => q.eq("taxonomyId", selection.taxonomyId))
    .unique();
  if (!version || version.state !== "sealed")
    taxonomyError("TAXONOMY_UNAVAILABLE");
  const rows = await loadCatalog(ctx, version._id);
  validateCatalog(rows, true);
  if (
    selection.subjectKey !== "verbal_ability" &&
    selection.language !== "english"
  )
    taxonomyError("INVALID_ELIGIBILITY");
  for (const [kind, key] of [
    ["subject", selection.subjectKey],
    ["subtopic", selection.subtopicKey],
    ["concept", selection.conceptKey],
    ["level", selection.level],
    ["language", selection.language],
    ["difficulty", selection.difficulty],
  ]) {
    const e = rows.find((e) => e.kind === kind && e.key === key && !e.archived);
    if (!e) taxonomyError("UNKNOWN_TAXONOMY_ENTRY");
    if ("levels" in e && !e.levels.includes(selection.level))
      taxonomyError("INVALID_ELIGIBILITY");
    if ("subjectKey" in e && e.subjectKey !== selection.subjectKey)
      taxonomyError("INVALID_TAXONOMY_PATH");
    if (e.kind === "concept" && e.subtopicKey !== selection.subtopicKey)
      taxonomyError("INVALID_TAXONOMY_PATH");
  }
  return version._id;
}

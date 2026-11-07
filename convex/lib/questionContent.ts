import { v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { validateTaxonomySelection } from "./taxonomy";
import { questionWorkflowError as fail } from "./questionWorkflow";

export const provenance = v.object({
  kind: v.union(
    v.literal("original"),
    v.literal("licensed"),
    v.literal("synthetic"),
  ),
  author: v.string(),
  assistance: v.string(),
  sources: v.array(v.string()),
});
export const moduleId = v.union(
  v.literal("shared-core"),
  v.literal("professional-numerical"),
  v.literal("analytical"),
  v.literal("clerical"),
);
export const language = v.union(v.literal("english"), v.literal("filipino"));
export const level = v.union(
  v.literal("professional"),
  v.literal("subprofessional"),
);
export const questionContent = v.object({
  family: v.number(),
  module: moduleId,
  subjectId: v.string(),
  subtopicId: v.string(),
  conceptId: v.string(),
  levelApplicability: v.array(level),
  language,
  difficulty: v.union(
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard"),
  ),
  stem: v.string(),
  choices: v.array(v.object({ choiceId: v.string(), text: v.string() })),
  correctChoiceId: v.string(),
  explanation: v.string(),
  provenance,
});
export const referenceContent = v.object({
  family: v.number(),
  module: moduleId,
  language,
  title: v.string(),
  provenance,
  blocks: v.array(
    v.union(
      v.object({ type: v.literal("text"), text: v.string() }),
      v.object({
        type: v.literal("table"),
        caption: v.string(),
        headers: v.array(v.string()),
        rows: v.array(v.array(v.string())),
      }),
      v.object({
        type: v.literal("image"),
        assetId: v.id("questionAssets"),
        caption: v.string(),
        alt: v.string(),
        description: v.string(),
      }),
    ),
  ),
});
export type QuestionContent = Infer<typeof questionContent>;
/** Serialize objects with sorted keys while preserving semantically ordered arrays. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
      .join(",") +
    "}"
  );
}
/** Hash canonical UTF-8 content into a hexadecimal SHA-256 fingerprint. */
export async function digest(value: unknown) {
  const data = new TextEncoder().encode(canonical(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
/** Reject blank or executable-markup-like content strings. */
export function text(value: string) {
  if (!value.trim() || /<\/?[a-z][^>]*>|javascript:/iu.test(value))
    fail("VALIDATION_FAILED");
}
/** Reject canonical content larger than the allowed UTF-8 byte count. */
export function bounded(value: unknown, bytes: number) {
  if (new TextEncoder().encode(canonical(value)).length > bytes)
    fail("VALIDATION_FAILED");
}
/** Require a positive safe integer for counts and immutable versions. */
export function positive(n: number) {
  if (!Number.isSafeInteger(n) || n < 1) fail("VALIDATION_FAILED");
}
/** Validate authoring attribution and required licensed-source evidence. */
export function validateProvenance(p: Infer<typeof provenance>) {
  text(p.author);
  text(p.assistance);
  if (
    p.sources.some((s) => !s.trim()) ||
    (p.kind === "licensed" && !p.sources.length)
  )
    fail("VALIDATION_FAILED");
}
/** Validate immutable question content, eligibility and exact reference integrity. */
export async function validateQuestion(
  ctx: Pick<QueryCtx, "db">,
  content: QuestionContent,
  taxonomyVersionId: import("../_generated/dataModel").Id<"taxonomyVersions">,
  referenceVersionId?: import("../_generated/dataModel").Id<"questionReferenceVersions">,
) {
  bounded(content, 65536);
  positive(content.family);
  validateProvenance(content.provenance);
  text(content.stem);
  text(content.explanation);
  for (const choice of content.choices) {
    text(choice.text);
    if (!/^[a-z][a-z0-9_-]*$/.test(choice.choiceId)) fail("VALIDATION_FAILED");
  }
  if (
    content.choices.length < 2 ||
    content.choices.length > 6 ||
    content.choices.some((c) => !c.choiceId.trim() || !c.text.trim()) ||
    new Set(content.choices.map((c) => c.choiceId)).size !==
      content.choices.length ||
    new Set(
      content.choices.map((c) =>
        c.text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " "),
      ),
    ).size !== content.choices.length ||
    !content.choices.some((c) => c.choiceId === content.correctChoiceId)
  )
    fail("VALIDATION_FAILED");
  const allowed =
    content.module === "shared-core"
      ? ["professional", "subprofessional"]
      : content.module === "clerical"
        ? ["subprofessional"]
        : ["professional"];
  const expectedSubject =
    content.module === "clerical"
      ? "clerical_ability"
      : content.module === "analytical"
        ? "analytical_ability"
        : content.module === "professional-numerical"
          ? "numerical_ability"
          : null;
  if (
    content.levelApplicability.length !== allowed.length ||
    new Set(content.levelApplicability).size !==
      content.levelApplicability.length ||
    content.levelApplicability.some((l) => !allowed.includes(l)) ||
    (expectedSubject
      ? content.subjectId !== expectedSubject
      : ![
          "general_information",
          "verbal_ability",
          "numerical_ability",
        ].includes(content.subjectId))
  )
    fail("VALIDATION_FAILED");
  const taxonomy = await ctx.db.get("taxonomyVersions", taxonomyVersionId);
  if (!taxonomy) fail("VALIDATION_FAILED");
  for (const examLevel of content.levelApplicability)
    await validateTaxonomySelection(ctx, {
      taxonomyId: taxonomy.taxonomyId,
      subjectKey: content.subjectId,
      subtopicKey: content.subtopicId,
      conceptKey: content.conceptId,
      level: examLevel,
      language: content.language,
      difficulty: content.difficulty,
    });
  let reference = null;
  if (referenceVersionId) {
    reference = await ctx.db.get(
      "questionReferenceVersions",
      referenceVersionId,
    );
    if (
      !reference ||
      reference.content.family !== content.family ||
      reference.content.module !== content.module ||
      reference.content.language !== content.language
    )
      fail("VALIDATION_FAILED");
    if ((await digest(reference.content)) !== reference.contentHash)
      fail("CONTENT_CONFLICT");
    for (const block of reference.content.blocks)
      if (block.type === "image") {
        const asset = await ctx.db.get("questionAssets", block.assetId);
        if (!asset || asset.state !== "verified" || !asset.storageId)
          fail("UNVERIFIED_ASSET");
        if (!(await ctx.db.system.get("_storage", asset.storageId)))
          fail("UNVERIFIED_ASSET");
      }
  }
  const normalize = (s: string) =>
    s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  return {
    contentHash: await digest({
      content,
      taxonomyVersionId,
      referenceVersionId: referenceVersionId ?? null,
    }),
    contentFingerprint: await digest({
      stem: normalize(content.stem),
      choices: content.choices.map((c) => normalize(c.text)).sort(),
      reference: reference?.content.blocks ?? null,
    }),
  };
}

import { digest } from "./questionContent";
import type { Descriptor, SourceRecord } from "./questionImportProtocol";

/** Synthetic two-family corpus that exercises every bootstrap record kind. */
export const bootstrapFixturePolicy = Object.freeze({
  families: 2,
  perFamilyQuestions: 2,
  expectedQuestions: 4,
  expectedReferences: 1,
  expectedAssets: 1,
});

const provenance = {
  kind: "synthetic" as const,
  author: "fixture",
  assistance: "Synthetic bootstrap tests only",
  sources: [],
};

const reference: SourceRecord = {
  kind: "reference",
  value: {
    referenceId: "fixture-reference",
    version: 1,
    family: 1,
    module: "shared-core",
    language: "english",
    title: "Practice facts",
    blocks: [
      { type: "text", text: "There are two red and three blue counters." },
    ],
    provenance,
  },
};

function questionSource(
  questionId: string,
  family: number,
  stem: string,
  withReference = false,
): SourceRecord {
  return {
    kind: "question",
    value: {
      questionId,
      version: 1,
      family,
      module: "shared-core",
      subjectId: "numerical_ability",
      subtopicId: "numerical_reasoning",
      conceptId: "numerical_reasoning",
      language: "english",
      difficulty: "easy",
      levelApplicability: ["professional", "subprofessional"],
      stem,
      choices: [
        { choiceId: "a", text: "5" },
        { choiceId: "b", text: "6" },
      ],
      correctChoiceId: "a",
      explanation: `${stem} Synthetic explanation.`,
      provenance,
      ...(withReference
        ? {
            reference: {
              referenceId: "fixture-reference",
              referenceVersion: 1,
            },
          }
        : {}),
    },
  };
}

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";

/**
 * Build the exact ordered inventory and its frozen plan checksums. Assets are
 * ordered before references and questions, matching the offline importer.
 *
 * Keep this module free of top-level await and top-level environment access:
 * Convex analyzes every module under `convex/`, including test fixtures.
 */
export async function bootstrapFixturePlan() {
  const pngBytes = Uint8Array.from(atob(pngBase64), (character) =>
    character.charCodeAt(0),
  );
  const pngSha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", pngBytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const asset: SourceRecord = {
    kind: "asset",
    value: {
      assetId: "fixture-image",
      path: "content/fixture/image.png",
      sha256: pngSha256,
      mediaType: "image/png",
      width: 1,
      height: 1,
      provenance,
    },
  };
  const sources: SourceRecord[] = [
    asset,
    reference,
    questionSource("fixture-question-1", 1, "What is two plus three?", true),
    questionSource("fixture-question-2", 1, "What is three plus two?", false),
    questionSource("fixture-question-3", 2, "What is one plus four?", false),
    questionSource("fixture-question-4", 2, "What is four plus one?", false),
  ];
  const descriptors: Descriptor[] = [];
  let inventoryHash = "0".repeat(64);
  for (const source of sources) {
    const descriptor: Descriptor = {
      ordinal: descriptors.length,
      kind: source.kind,
      sourceId:
        source.kind === "asset"
          ? source.value.assetId
          : source.kind === "reference"
            ? source.value.referenceId
            : source.value.questionId,
      version: source.kind === "asset" ? 0 : source.value.version,
      family: source.kind === "asset" ? 1 : source.value.family,
      sourceChecksum: await digest(source.value),
    };
    descriptors.push(descriptor);
    inventoryHash = await digest({ chain: inventoryHash, entry: descriptor });
  }
  const manifests = [
    {
      corpusId: "fixture-family-1",
      revision: 1,
      checksum: "a".repeat(64),
      family: 1,
      taxonomyId: "cse-taxonomy-2027-v2",
      blueprintIds: ["cse-professional-2027-v3", "cse-subprofessional-2027-v3"],
      questions: 2,
      references: 1,
      assets: 1,
    },
    {
      corpusId: "fixture-family-2",
      revision: 1,
      checksum: "b".repeat(64),
      family: 2,
      taxonomyId: "cse-taxonomy-2027-v2",
      blueprintIds: ["cse-professional-2027-v3", "cse-subprofessional-2027-v3"],
      questions: 2,
      references: 0,
      assets: 0,
    },
  ];
  const planChecksum = await digest({ manifests, inventoryHash });
  return {
    policy: bootstrapFixturePolicy,
    manifests,
    descriptors,
    inventoryHash,
    planChecksum,
    records: sources.map((source, index) => ({
      source,
      descriptor: descriptors[index],
    })),
    pngBytes,
  };
}

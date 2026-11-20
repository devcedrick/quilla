// @vitest-environment happy-dom
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { QuestionContent } from "@/convex/lib/questionContent";

const mocks = vi.hoisted(() => ({
  context: undefined as unknown,
  history: undefined as unknown,
  preview: undefined as unknown,
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "questions:getAdminVersion") return mocks.context;
    if (name === "questions:listAdminQuestionVersions") return mocks.history;
    if (name === "questionReferences:getAdminPreview") return mocks.preview;
    if (name === "users:currentAccess")
      return { status: "active", userId: "user-a", role: "admin" };
    return undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { QuestionVersionDetailPage } from "./question-version-detail";

const content: QuestionContent = {
  family: 1,
  module: "shared-core",
  subjectId: "numerical_ability",
  subtopicId: "numerical_reasoning",
  conceptId: "numerical_reasoning",
  levelApplicability: ["professional", "subprofessional"],
  language: "english",
  difficulty: "easy",
  stem: "What is 2 + 3?",
  choices: [
    { choiceId: "a", text: "5" },
    { choiceId: "b", text: "6" },
  ],
  correctChoiceId: "a",
  explanation: "Two plus three is five.",
  provenance: {
    kind: "synthetic",
    author: "Fixture",
    assistance: "None",
    sources: [],
  },
};
const question: Doc<"questions"> = {
  _id: "question-1" as Id<"questions">,
  _creationTime: 1,
  questionId: "q-1",
  contributorId: "user-b" as Id<"users">,
  family: 1,
  latestVersion: 2,
  revision: 2,
  createdAt: 1,
};
function versionFor(
  version: number,
  state: Doc<"questionVersions">["state"],
  overrides: Partial<Doc<"questionVersions">> = {},
): Doc<"questionVersions"> {
  return {
    _id: `version-${version}` as Id<"questionVersions">,
    _creationTime: version,
    questionId: question._id,
    version,
    content,
    contentHash: "a".repeat(64),
    contentFingerprint: "b".repeat(64),
    taxonomyVersionId: "tax-1" as Id<"taxonomyVersions">,
    creatorId: "user-b" as Id<"users">,
    createdAt: version,
    state,
    workflowRevision: 1,
    canonicalQuestionId: "q-1",
    contributorId: question.contributorId,
    searchText: "q-1",
    family: 1,
    module: "shared-core",
    subjectId: "numerical_ability",
    subtopicId: "numerical_reasoning",
    conceptId: "numerical_reasoning",
    difficulty: "easy",
    language: "english",
    origin: "synthetic",
    professionalEligible: true,
    subprofessionalEligible: true,
    ...overrides,
  };
}
const review: Doc<"questionReviews"> = {
  _id: "review-1" as Id<"questionReviews">,
  _creationTime: 2,
  questionVersionId: "version-1" as Id<"questionVersions">,
  reviewerId: "user-a" as Id<"users">,
  expectedRevision: 1,
  resultingRevision: 2,
  reason: "Meets all criteria",
  rubric: "editorial-quality-v1",
  duplicateDisposition: "none_found",
  duplicateEvidence: "No duplicates",
  candidateFingerprint: "f".repeat(64),
  decidedAt: 2,
  kind: "review",
  decision: "approve",
  assessment: Array.from({ length: 5 }, () => ({
    passed: true,
    evidence: "Independently verified",
  })),
  score: 5,
};
const taxonomy: Doc<"taxonomyVersions"> = {
  _id: "tax-1" as Id<"taxonomyVersions">,
  _creationTime: 1,
  taxonomyId: "cse-taxonomy-2027-v2",
  state: "sealed",
  revision: 1,
  createdBy: "user-a" as Id<"users">,
  createdAt: 1,
  updatedAt: 1,
};
function contextFor(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const version = versionFor(1, "pending_review");
  return {
    version,
    question,
    taxonomy,
    reference: null,
    reviews: [review],
    reviewOverflow: false,
    duplicates: {
      ids: [] as Id<"questions">[],
      fingerprint: "f".repeat(64),
      overflow: false,
    },
    ...overrides,
  };
}

let view: ReactTestRenderer;
async function render(versionId = "version-1") {
  await act(async () => {
    view = create(<QuestionVersionDetailPage versionId={versionId} />);
  });
}

describe("admin question version detail", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.context = contextFor();
    mocks.history = {
      question,
      versions: [versionFor(2, "published"), versionFor(1, "pending_review")],
      overflow: false,
    };
    mocks.preview = undefined;
  });
  afterEach(async () => {
    if (view) await act(async () => view.unmount());
  });
  it("shows immutable content, review history, and version history", async () => {
    await render();
    const markup = JSON.stringify(view.toJSON());
    expect(markup).toContain("Immutable content");
    expect(markup).toContain("What is 2 + 3?");
    expect(markup).toContain("Immutable review history");
    expect(markup).toContain("Meets all criteria");
    expect(markup).toContain("Quality score:");
    expect(markup).toContain("/5");
    expect(markup).toContain("Immutable version history");
    expect(markup).toContain("/admin/questions/version-2");
    expect(markup).toContain("Published");
    expect(markup).toContain("cse-taxonomy-2027-v2");
  });
  it("renders a missing version as not found", async () => {
    mocks.context = null;
    await render("missing");
    expect(JSON.stringify(view.toJSON())).toContain(
      "This question version could not be found.",
    );
  });
  it("renders a loading state while the version resolves", async () => {
    mocks.context = undefined;
    await render();
    expect(JSON.stringify(view.toJSON())).toContain(
      "Loading the question version…",
    );
  });
  it("shows the exact immutable shared reference", async () => {
    const reference: Doc<"questionReferenceVersions"> = {
      _id: "ref-1" as Id<"questionReferenceVersions">,
      _creationTime: 1,
      referenceId: "passage",
      version: 1,
      content: {
        family: 1,
        module: "shared-core",
        language: "english",
        title: "Passage",
        provenance: content.provenance,
        blocks: [{ type: "text", text: "Read this passage." }],
      },
      contentHash: "c".repeat(64),
      creatorId: "user-a" as Id<"users">,
      createdAt: 1,
      family: 1,
      module: "shared-core",
      language: "english",
    };
    mocks.context = contextFor({
      version: versionFor(1, "pending_review", {
        referenceVersionId: reference._id,
      }),
      reference,
    });
    mocks.preview = { reference, assets: [] };
    await render();
    const markup = JSON.stringify(view.toJSON());
    expect(markup).toContain("Shared reference");
    expect(markup).toContain("Read this passage.");
  });
});

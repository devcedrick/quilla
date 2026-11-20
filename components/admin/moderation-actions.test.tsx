// @vitest-environment happy-dom
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { QuestionContent } from "@/convex/lib/questionContent";

const mocks = vi.hoisted(() => ({
  access: undefined as unknown,
  submit: vi.fn(),
  review: vi.fn(),
  publish: vi.fn(),
  archive: vi.fn(),
  recheck: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(ref) === "users:currentAccess") return mocks.access;
    return undefined;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "questions:submitForReview") return mocks.submit;
    if (name === "questions:reviewVersion") return mocks.review;
    if (name === "questions:publishVersion") return mocks.publish;
    if (name === "questions:archiveVersion") return mocks.archive;
    if (name === "questions:reviewDuplicateCandidates") return mocks.recheck;
    return vi.fn();
  },
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

import { ModerationActions } from "./moderation-actions";

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
  latestVersion: 1,
  revision: 1,
  createdAt: 1,
};
function versionFor(
  state: Doc<"questionVersions">["state"],
  overrides: Partial<Doc<"questionVersions">> = {},
): Doc<"questionVersions"> {
  return {
    _id: "version-1" as Id<"questionVersions">,
    _creationTime: 1,
    questionId: question._id,
    version: 1,
    content,
    contentHash: "a".repeat(64),
    contentFingerprint: "b".repeat(64),
    taxonomyVersionId: "tax-1" as Id<"taxonomyVersions">,
    creatorId: "user-b" as Id<"users">,
    createdAt: 1,
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
const duplicates = {
  ids: [] as Id<"questions">[],
  fingerprint: "f".repeat(64),
  overflow: false,
};

let view: ReactTestRenderer;
async function render(
  version: Doc<"questionVersions">,
  duplicateState: typeof duplicates = duplicates,
) {
  await act(async () => {
    view = create(
      <ModerationActions
        version={version}
        question={question}
        reviews={[]}
        duplicates={duplicateState}
      />,
    );
  });
}
async function click(label: string) {
  const button = view.root
    .findAllByType("button")
    .find((candidate) => candidate.props.children === label);
  expect(button).toBeDefined();
  await act(async () => button!.props.onClick());
}
function fill(id: string, value: string) {
  const field = view.root
    .findAllByProps({ id })
    .find((node) => typeof node.type === "string");
  if (!field) throw new Error(`Missing field ${id}`);
  act(() => field.props.onChange({ target: { value } }));
}
async function submitReview() {
  await act(async () => {
    const form = view.root.findByType("form");
    form.props.onSubmit({ preventDefault() {} });
  });
}
function activeAdmin(userId: string) {
  return { status: "active", userId, role: "admin" };
}

describe("admin moderation actions", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
      callback(),
    );
    mocks.access = activeAdmin("user-b");
    mocks.submit.mockResolvedValue(2);
    mocks.review.mockResolvedValue(3);
    mocks.publish.mockResolvedValue(4);
    mocks.archive.mockResolvedValue(5);
  });
  afterEach(async () => {
    if (view) await act(async () => view.unmount());
    vi.unstubAllGlobals();
  });
  it("lets the contributor submit an exact draft revision", async () => {
    await render(versionFor("draft"));
    await click("Submit for review");
    expect(mocks.submit).toHaveBeenCalledWith({
      questionVersionId: "version-1",
      expectedWorkflowRevision: 1,
    });
    expect(JSON.stringify(view.toJSON())).toContain(
      "Draft submitted for independent review.",
    );
  });
  it("records a rejection with all five rubric notes", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("pending_review"));
    await click("Review this version");
    const reject = view.root.findByProps({
      name: "moderation-decision",
      value: "reject",
    });
    act(() => reject.props.onChange());
    fill("moderation-reason", "The explanation needs a source.");
    for (let index = 0; index < 5; index++)
      fill(`assessment-evidence-${index}`, `Evidence ${index + 1}`);
    fill("duplicate-evidence", "No duplicate candidates were found.");
    await submitReview();
    expect(mocks.review).toHaveBeenCalledWith({
      questionVersionId: "version-1",
      expectedWorkflowRevision: 1,
      decision: "reject",
      reason: "The explanation needs a source.",
      assessment: Array.from({ length: 5 }, (_, index) => ({
        passed: false,
        evidence: `Evidence ${index + 1}`,
      })),
      duplicateDisposition: "none_found",
      duplicateEvidence: "No duplicate candidates were found.",
    });
    expect(JSON.stringify(view.toJSON())).toContain("Rejection recorded.");
  });
  it("blocks self-review without weakening the backend rule", async () => {
    await render(versionFor("pending_review"));
    expect(JSON.stringify(view.toJSON())).toContain(
      "You cannot review this version because you are its contributor or creator.",
    );
    expect(
      view.root
        .findAllByType("button")
        .some((button) => button.props.children === "Review this version"),
    ).toBe(false);
  });
  it("blocks approval when duplicate candidates overflow", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("pending_review"), {
      ...duplicates,
      overflow: true,
    });
    await click("Review this version");
    for (let index = 0; index < 5; index++)
      fill(`assessment-evidence-${index}`, `Evidence ${index + 1}`);
    fill("duplicate-evidence", "Candidate set reviewed.");
    await submitReview();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain(
      "Approval is blocked because the duplicate candidate scan overflowed.",
    );
  });
  it("publishes and archives only from allowed states", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("approved"));
    await click("Publish version");
    expect(mocks.publish).toHaveBeenCalledWith({
      questionVersionId: "version-1",
      expectedWorkflowRevision: 1,
    });
    await click("Archive version");
    expect(mocks.archive).toHaveBeenCalledWith({
      questionVersionId: "version-1",
      expectedWorkflowRevision: 1,
    });
    await act(async () =>
      view.update(
        <ModerationActions
          version={versionFor("archived")}
          question={question}
          reviews={[]}
          duplicates={duplicates}
        />,
      ),
    );
    expect(JSON.stringify(view.toJSON())).toContain(
      "No further lifecycle action is available for this version.",
    );
    expect(
      view.root
        .findAllByType("button")
        .some((button) => button.props.children === "Publish version"),
    ).toBe(false);
  });
});

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

function approvalReview(fingerprint: string): Doc<"questionReviews"> {
  return {
    _id: "review-1" as Id<"questionReviews">,
    _creationTime: 2,
    questionVersionId: "version-1" as Id<"questionVersions">,
    reviewerId: "user-a" as Id<"users">,
    expectedRevision: 2,
    resultingRevision: 3,
    reason: "",
    rubric: "editorial-quality-v1",
    duplicateDisposition: "none_found",
    duplicateEvidence: "No duplicates at approval time",
    candidateFingerprint: fingerprint,
    decidedAt: 2,
    kind: "review",
    decision: "approve",
    assessment: Array.from({ length: 5 }, () => ({
      passed: true,
      evidence: "Independently verified",
    })),
    score: 5,
  };
}

let view: ReactTestRenderer;
function element(
  version: Doc<"questionVersions">,
  duplicateState: typeof duplicates,
  reviews: Doc<"questionReviews">[],
) {
  return (
    <ModerationActions
      version={version}
      question={question}
      reviews={reviews}
      duplicates={duplicateState}
    />
  );
}
async function render(
  version: Doc<"questionVersions">,
  duplicateState: typeof duplicates = duplicates,
  reviews: Doc<"questionReviews">[] = [],
) {
  await act(async () => {
    view = create(element(version, duplicateState, reviews));
  });
}
async function rerender(
  version: Doc<"questionVersions">,
  duplicateState: typeof duplicates,
  reviews: Doc<"questionReviews">[] = [],
) {
  await act(async () => {
    view.update(element(version, duplicateState, reviews));
  });
}
function findButton(label: string) {
  return view.root
    .findAllByType("button")
    .find((candidate) => candidate.props.children === label);
}
async function submitForm() {
  await act(async () => {
    view.root.findByType("form").props.onSubmit({ preventDefault() {} });
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
    vi.restoreAllMocks();
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
      candidateSetFingerprint: duplicates.fingerprint,
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
    await rerender(versionFor("archived"), duplicates);
    expect(JSON.stringify(view.toJSON())).toContain(
      "No further lifecycle action is available for this version.",
    );
    for (const label of ["Publish version", "Archive version"])
      expect(
        view.root
          .findAllByType("button")
          .some((candidate) => candidate.props.children === label),
      ).toBe(false);
  });
  it("focuses the summary when only field errors block a review", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("pending_review"));
    await click("Review this version");
    const focus = vi.fn();
    vi.spyOn(document, "getElementById").mockImplementation((id: string) =>
      id === "moderation-form-error"
        ? ({ focus } as unknown as HTMLElement)
        : null,
    );
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return 0;
    });
    await submitReview();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(
      view.root.findByProps({ id: "moderation-form-error" }),
    ).toBeDefined();
    expect(JSON.stringify(view.toJSON())).toContain(
      "Correct the highlighted fields before recording the decision.",
    );
    expect(frames).toHaveLength(1);
    act(() => frames[0](0));
    expect(focus).toHaveBeenCalledTimes(1);
  });
  it("clears scan-specific review input when the candidate set changes", async () => {
    mocks.access = activeAdmin("user-a");
    const first = { ...duplicates, fingerprint: "1".repeat(64) };
    const second = { ...duplicates, fingerprint: "2".repeat(64) };
    await render(versionFor("pending_review"), first);
    await click("Review this version");
    fill("duplicate-evidence", "Evidence for the first scan.");
    await rerender(versionFor("pending_review"), second);
    expect(JSON.stringify(view.toJSON())).toContain(
      "The duplicate candidate set changed.",
    );
    expect(
      view.root
        .findAllByProps({ id: "duplicate-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("");
    for (let index = 0; index < 5; index++)
      fill(`assessment-evidence-${index}`, `Evidence ${index + 1}`);
    for (let index = 0; index < 5; index++) {
      const checkbox = view.root
        .findAllByType("input")
        .filter((input) => input.props.type === "checkbox")[index];
      act(() => checkbox.props.onChange({ target: { checked: true } }));
    }
    fill("duplicate-evidence", "Evidence for the second scan.");
    await submitReview();
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateSetFingerprint: second.fingerprint,
        duplicateDisposition: "none_found",
        duplicateEvidence: "Evidence for the second scan.",
      }),
    );
  });
  it("preserves review input when the fingerprint is unchanged", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("pending_review"), duplicates);
    await click("Review this version");
    fill("duplicate-evidence", "Evidence for the current scan.");
    await click("Close review form");
    await click("Review this version");
    expect(
      view.root
        .findAllByProps({ id: "duplicate-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("Evidence for the current scan.");
  });
  it("does not reuse review evidence after the scan changes while closed", async () => {
    mocks.access = activeAdmin("user-a");
    const first = { ...duplicates, fingerprint: "1".repeat(64) };
    const second = { ...duplicates, fingerprint: "2".repeat(64) };
    await render(versionFor("pending_review"), first);
    await click("Review this version");
    fill("duplicate-evidence", "Evidence for the first scan.");
    await click("Close review form");
    await rerender(versionFor("pending_review"), second);
    await click("Review this version");
    expect(
      view.root
        .findAllByProps({ id: "duplicate-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("");
  });
  it("blocks publish and recheck on overflow while keeping archive available", async () => {
    mocks.access = activeAdmin("user-a");
    const approved = versionFor("approved", {
      approvalDecisionId: "review-1" as Id<"questionReviews">,
    });
    const changed = { ...duplicates, fingerprint: "2".repeat(64) };
    const reviews = [approvalReview("1".repeat(64))];
    await render(approved, { ...changed, overflow: true }, reviews);
    expect(findButton("Publish version")).toBeUndefined();
    expect(findButton("Record duplicate recheck")).toBeUndefined();
    expect(findButton("Archive version")).toBeDefined();
    expect(JSON.stringify(view.toJSON())).toContain(
      "Publication and duplicate recheck are blocked because the candidate scan overflowed.",
    );
    await rerender(approved, changed, reviews);
    expect(findButton("Publish version")).toBeDefined();
    expect(findButton("Record duplicate recheck")).toBeDefined();
    expect(findButton("Archive version")).toBeDefined();
  });
  it("offers only the dispositions the current scan can record", async () => {
    mocks.access = activeAdmin("user-a");
    const withCandidate = {
      ids: ["question-2" as Id<"questions">],
      fingerprint: "2".repeat(64),
      overflow: false,
    };
    await render(
      versionFor("approved", {
        approvalDecisionId: "review-1" as Id<"questionReviews">,
      }),
      withCandidate,
      [approvalReview("1".repeat(64))],
    );
    await click("Record duplicate recheck");
    let options = view.root
      .findAllByProps({ id: "recheck-disposition" })
      .find((node) => typeof node.type === "string")!
      .findAllByType("option");
    expect(options.map((option) => option.props.value)).toEqual([
      "adjudicated_distinct",
    ]);
    await rerender(
      versionFor("approved", {
        approvalDecisionId: "review-1" as Id<"questionReviews">,
      }),
      { ...withCandidate, ids: [] },
      [approvalReview("1".repeat(64))],
    );
    options = view.root
      .findAllByProps({ id: "recheck-disposition" })
      .find((node) => typeof node.type === "string")!
      .findAllByType("option");
    expect(options.map((option) => option.props.value)).toEqual(["none_found"]);
  });
  it("clears recheck evidence when the candidate set changes", async () => {
    mocks.access = activeAdmin("user-a");
    const first = {
      ids: ["question-2" as Id<"questions">],
      fingerprint: "1".repeat(64),
      overflow: false,
    };
    const second = { ...first, fingerprint: "2".repeat(64) };
    const approved = versionFor("approved", {
      approvalDecisionId: "review-1" as Id<"questionReviews">,
    });
    const reviews = [approvalReview("0".repeat(64))];
    await render(approved, first, reviews);
    await click("Record duplicate recheck");
    fill("recheck-evidence", "Evidence for the first scan.");
    await rerender(approved, second, reviews);
    expect(JSON.stringify(view.toJSON())).toContain(
      "The duplicate candidate set changed.",
    );
    expect(
      view.root
        .findAllByProps({ id: "recheck-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("");
    fill("recheck-evidence", "Evidence for the second scan.");
    await submitForm();
    expect(mocks.recheck).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateSetFingerprint: second.fingerprint,
        disposition: "adjudicated_distinct",
        evidence: "Evidence for the second scan.",
      }),
    );
  });
  it("preserves recheck evidence for the same scan and drops it after a change", async () => {
    mocks.access = activeAdmin("user-a");
    const first = {
      ids: ["question-2" as Id<"questions">],
      fingerprint: "1".repeat(64),
      overflow: false,
    };
    const second = { ...first, fingerprint: "2".repeat(64) };
    const approved = versionFor("approved", {
      approvalDecisionId: "review-1" as Id<"questionReviews">,
    });
    const reviews = [approvalReview("0".repeat(64))];
    await render(approved, first, reviews);
    await click("Record duplicate recheck");
    fill("recheck-evidence", "Draft for the first scan.");
    await click("Cancel");
    await click("Record duplicate recheck");
    expect(
      view.root
        .findAllByProps({ id: "recheck-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("Draft for the first scan.");
    await click("Cancel");
    await rerender(approved, second, reviews);
    await click("Record duplicate recheck");
    expect(
      view.root
        .findAllByProps({ id: "recheck-evidence" })
        .find((node) => typeof node.type === "string")?.props.value,
    ).toBe("");
  });
  it("clears stale field and summary errors as the admin corrects them", async () => {
    mocks.access = activeAdmin("user-a");
    await render(versionFor("pending_review"));
    await click("Review this version");
    const reject = view.root.findByProps({
      name: "moderation-decision",
      value: "reject",
    });
    act(() => reject.props.onChange());
    for (let index = 0; index < 5; index++)
      fill(`assessment-evidence-${index}`, `Evidence ${index + 1}`);
    fill("duplicate-evidence", "No duplicate candidates were found.");
    await submitReview();
    expect(mocks.review).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain(
      "A nonblank reason is required.",
    );
    fill("moderation-reason", "The explanation needs a source.");
    const markup = JSON.stringify(view.toJSON());
    expect(markup).not.toContain("A nonblank reason is required.");
    expect(markup).not.toContain(
      "Correct the highlighted fields before recording the decision.",
    );
    await submitReview();
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "reject",
        reason: "The explanation needs a source.",
      }),
    );
  });
  it("keeps the duplicate blocker until its inputs change", async () => {
    mocks.access = activeAdmin("user-a");
    const withCandidate = {
      ids: ["question-2" as Id<"questions">],
      fingerprint: "2".repeat(64),
      overflow: false,
    };
    await render(versionFor("pending_review"), withCandidate);
    await click("Review this version");
    for (let index = 0; index < 5; index++)
      fill(`assessment-evidence-${index}`, `Evidence ${index + 1}`);
    for (let index = 0; index < 5; index++) {
      const checkbox = view.root
        .findAllByType("input")
        .filter((input) => input.props.type === "checkbox")[index];
      act(() => checkbox.props.onChange({ target: { checked: true } }));
    }
    fill("duplicate-evidence", "Candidate reviewed.");
    await submitReview();
    expect(mocks.review).not.toHaveBeenCalled();
    const blocker = "Unresolved duplicate risk blocks approval.";
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    fill("moderation-reason", "Optional note.");
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    fill("assessment-evidence-0", "Updated evidence.");
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    const checkbox = view.root
      .findAllByType("input")
      .filter((input) => input.props.type === "checkbox")[0];
    act(() => checkbox.props.onChange({ target: { checked: false } }));
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    act(() => checkbox.props.onChange({ target: { checked: true } }));
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    fill("duplicate-evidence", "Updated duplicate evidence.");
    expect(JSON.stringify(view.toJSON())).toContain(blocker);
    const disposition = view.root
      .findAllByProps({ id: "duplicate-disposition" })
      .find((node) => typeof node.type === "string")!;
    act(() =>
      disposition.props.onChange({
        target: { value: "adjudicated_distinct" },
      }),
    );
    expect(JSON.stringify(view.toJSON())).not.toContain(blocker);
    await submitReview();
    expect(mocks.review).toHaveBeenCalledWith(
      expect.objectContaining({
        duplicateDisposition: "adjudicated_distinct",
        duplicateEvidence: "Updated duplicate evidence.",
      }),
    );
  });
  it("clears a recheck error when the evidence changes", async () => {
    mocks.access = activeAdmin("user-a");
    const withCandidate = {
      ids: ["question-2" as Id<"questions">],
      fingerprint: "2".repeat(64),
      overflow: false,
    };
    await render(
      versionFor("approved", {
        approvalDecisionId: "review-1" as Id<"questionReviews">,
      }),
      withCandidate,
      [approvalReview("1".repeat(64))],
    );
    await click("Record duplicate recheck");
    await submitForm();
    expect(JSON.stringify(view.toJSON())).toContain("Evidence is required.");
    fill("recheck-evidence", "Reviewed the exact candidate.");
    expect(JSON.stringify(view.toJSON())).not.toContain(
      "Evidence is required.",
    );
  });
});

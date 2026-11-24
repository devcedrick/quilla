// @vitest-environment happy-dom
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { QuestionContent } from "@/convex/lib/questionContent";

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  createRevision: vi.fn(),
  push: vi.fn(),
  taxonomyQueries: [] as unknown[],
}));

const taxonomy = {
  catalogs: [
    {
      _id: "tax-1",
      taxonomyId: "cse-taxonomy-2027-v2",
      revision: 1,
      state: "sealed",
    },
    {
      _id: "tax-2",
      taxonomyId: "cse-taxonomy-2028-v1",
      revision: 1,
      state: "sealed",
    },
  ],
  selected: {
    _id: "tax-1",
    taxonomyId: "cse-taxonomy-2027-v2",
    revision: 1,
    state: "sealed",
  },
  entries: [
    {
      kind: "subject",
      key: "numerical_ability",
      label: "Numerical ability",
      archived: false,
      levels: ["professional", "subprofessional"],
    },
    {
      kind: "subtopic",
      key: "numerical_reasoning",
      label: "Numerical reasoning",
      subjectKey: "numerical_ability",
      archived: false,
      levels: ["professional", "subprofessional"],
    },
    {
      kind: "concept",
      key: "numerical_reasoning",
      label: "Numerical reasoning",
      subjectKey: "numerical_ability",
      subtopicKey: "numerical_reasoning",
      archived: false,
      levels: ["professional", "subprofessional"],
    },
  ],
};

vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "questions:createDraft") return mocks.createDraft;
    if (name === "questions:createRevision") return mocks.createRevision;
    return vi.fn();
  },
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args?: unknown) => {
    const name = getFunctionName(ref);
    if (name === "questions:listAdminAuthoringOptions") {
      mocks.taxonomyQueries.push(args);
      return taxonomy;
    }
    if (name === "questionReferences:listAdminOptions")
      return { options: [], overflow: false };
    return undefined;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
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

import { QuestionForm } from "./question-form";

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
const version: Doc<"questionVersions"> = {
  _id: "version-1" as Id<"questionVersions">,
  _creationTime: 1,
  questionId: "question-1" as Id<"questions">,
  version: 1,
  content,
  contentHash: "a".repeat(64),
  contentFingerprint: "b".repeat(64),
  taxonomyVersionId: "tax-1" as Id<"taxonomyVersions">,
  creatorId: "user-b" as Id<"users">,
  createdAt: 1,
  state: "draft",
  workflowRevision: 1,
  canonicalQuestionId: "q-1",
  contributorId: "user-b" as Id<"users">,
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

let view: ReactTestRenderer;
async function renderForm(props?: {
  mode: "create" | "revise";
  initial?: { question: Doc<"questions">; version: Doc<"questionVersions"> };
  sourceTaxonomySealed?: boolean;
}) {
  await act(async () => {
    view = create(
      <QuestionForm
        mode={props?.mode ?? "create"}
        initial={props?.initial}
        sourceTaxonomySealed={props?.sourceTaxonomySealed}
      />,
    );
  });
}
function host(id: string) {
  const node = view.root
    .findAllByProps({ id })
    .find((candidate) => typeof candidate.type === "string");
  if (!node) throw new Error(`Missing field ${id}`);
  return node;
}
function fill(id: string, value: string) {
  const field = host(id);
  act(() => {
    field.props.onChange({ target: { value } });
  });
}
async function submit() {
  await act(async () =>
    view.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
}

describe("admin question form", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.taxonomyQueries.length = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
      callback(),
    );
    mocks.createDraft.mockResolvedValue("version-1");
    mocks.createRevision.mockResolvedValue("version-2");
  });
  afterEach(async () => {
    if (view) await act(async () => view.unmount());
    vi.unstubAllGlobals();
  });
  it("sends every required authoring field and navigates to the new version", async () => {
    await renderForm();
    fill("admin-question-id", "q-1");
    fill("admin-family", "1");
    fill("admin-subject", "numerical_ability");
    fill("admin-subtopic", "numerical_reasoning");
    fill("admin-concept", "numerical_reasoning");
    fill("admin-stem", "What is 2 + 3?");
    fill("admin-choice-0", "5");
    fill("admin-choice-1", "6");
    fill("admin-explanation", "Two plus three is five.");
    fill("admin-origin", "synthetic");
    fill("admin-author", "Fixture");
    fill("admin-assistance", "None");
    await submit();
    expect(mocks.createDraft).toHaveBeenCalledWith({
      questionId: "q-1",
      content,
      taxonomyVersionId: "tax-1",
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/questions/version-1");
  });
  it("blocks submission and exposes field errors without calling the backend", async () => {
    await renderForm();
    await submit();
    expect(mocks.createDraft).not.toHaveBeenCalled();
    const markup = JSON.stringify(view.toJSON());
    expect(markup).toContain("Enter a canonical question ID.");
    expect(markup).toContain("Family must be a positive whole number.");
    expect(markup).toContain("Enter a stem without markup.");
    expect(markup).toContain("Enter an explanation without markup.");
    expect(markup).toContain("Choose a subject allowed for this module.");
    expect(markup).toContain("Enter the content author.");
  });
  it("creates a revision from the immutable source version", async () => {
    await renderForm({
      mode: "revise",
      initial: { question, version },
    });
    expect(host("admin-question-id").props.disabled).toBe(true);
    expect(host("admin-family").props.disabled).toBe(true);
    await submit();
    expect(mocks.createRevision).toHaveBeenCalledWith({
      questionId: "question-1",
      expectedCanonicalRevision: 1,
      content,
      taxonomyVersionId: "tax-1",
    });
    expect(mocks.push).toHaveBeenCalledWith("/admin/questions/version-2");
  });
  it("requires a current sealed catalog when the source taxonomy is archived", async () => {
    await renderForm({
      mode: "revise",
      initial: { question, version },
      sourceTaxonomySealed: false,
    });
    expect(JSON.stringify(view.toJSON())).toContain(
      "The source version's taxonomy catalog is no longer sealed.",
    );
    expect(mocks.taxonomyQueries.at(-1)).toEqual({});
    expect(mocks.taxonomyQueries).not.toContainEqual({
      taxonomyVersionId: "tax-1",
    });
    act(() =>
      host("admin-taxonomy").props.onChange({ target: { value: "tax-2" } }),
    );
    expect(mocks.taxonomyQueries.at(-1)).toEqual({
      taxonomyVersionId: "tax-2",
    });
    await submit();
    expect(mocks.createRevision).toHaveBeenCalledWith({
      questionId: "question-1",
      expectedCanonicalRevision: 1,
      content,
      taxonomyVersionId: "tax-2",
    });
  });
  it("reuses the lowest free choice ID after a removal", async () => {
    await renderForm();
    const add = () =>
      view.root
        .findAllByType("button")
        .find((candidate) => candidate.props.children === "Add choice")!;
    act(() => add().props.onClick());
    expect(host("admin-choice-2").props["aria-label"]).toBe("Choice C");
    const removeA = view.root
      .findAllByType("button")
      .find((candidate) => candidate.props["aria-label"] === "Remove choice A");
    act(() => removeA!.props.onClick());
    expect(host("admin-choice-0").props["aria-label"]).toBe("Choice B");
    act(() => add().props.onClick());
    expect(host("admin-choice-2").props["aria-label"]).toBe("Choice A");
  });
});

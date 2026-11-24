// @vitest-environment happy-dom
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paginated: vi.fn(),
  loadMore: vi.fn(),
  status: "Exhausted" as "Exhausted" | "CanLoadMore",
  fail: false,
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    catalogs: [],
    selected: null,
    entries: [
      {
        kind: "subject",
        key: "numerical_ability",
        label: "Numerical ability",
        archived: false,
        levels: ["professional", "subprofessional"],
      },
    ],
  }),
  usePaginatedQuery: (...args: unknown[]) => {
    mocks.paginated(...args);
    if (mocks.fail) throw new Error("simulated query failure");
    return {
      results: [],
      status: mocks.status,
      loadMore: mocks.loadMore,
    };
  },
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { QuestionBank } from "./question-bank";

let renderer: ReactTestRenderer;

function render() {
  act(() => {
    renderer = create(<QuestionBank />);
  });
}

function setField(id: string, value: string) {
  const field = renderer.root
    .findAllByProps({ id })
    .find((node) => typeof node.type === "string");
  if (!field) throw new Error(`Missing field ${id}`);
  act(() => {
    field.props.onChange({ target: { value } });
  });
}

function applyFilters() {
  const form = renderer.root.findByProps({
    "aria-label": "Question bank filters",
  });
  act(() => {
    form.props.onSubmit({ preventDefault: () => undefined });
  });
}

describe("admin question bank filters", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.status = "Exhausted";
    mocks.fail = false;
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
      callback(),
    );
  });
  afterEach(() => {
    renderer?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("applies every control as one combined paginated query", () => {
    render();
    setField("admin-filter-search", "  two plus three  ");
    setField("admin-filter-state", "draft");
    setField("admin-filter-family", "2");
    setField("admin-filter-module", "shared-core");
    setField("admin-filter-difficulty", "medium");
    setField("admin-filter-language", "english");
    setField("admin-filter-level", "professional");
    setField("admin-filter-origin", "synthetic");
    setField("admin-filter-contributor", "user-1");
    setField("admin-filter-question-id", "q-1");
    applyFilters();
    const lastCall = mocks.paginated.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual({
      search: "two plus three",
      state: "draft",
      family: 2,
      module: "shared-core",
      difficulty: "medium",
      language: "english",
      level: "professional",
      origin: "synthetic",
      contributorId: "user-1",
      questionId: "q-1",
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "No question versions match",
    );
  });
  it("reports invalid bounds and keeps the previous query", () => {
    render();
    const initial = mocks.paginated.mock.calls.at(-1)?.[1];
    setField("admin-filter-search", "s".repeat(101));
    setField("admin-filter-family", "0");
    setField("admin-filter-question-id", "q".repeat(101));
    applyFilters();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Search text is limited to 100 characters.",
    );
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Family must be a positive whole number.",
    );
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Question IDs are limited to 100 characters.",
    );
    expect(mocks.paginated.mock.calls.at(-1)?.[1]).toEqual(initial);
  });
  it("offers load more only when another page is available", () => {
    mocks.status = "CanLoadMore";
    render();
    const loadMore = renderer.root.findByProps({
      children: "Load more versions",
    });
    act(() => loadMore.props.onClick());
    expect(mocks.loadMore).toHaveBeenCalledWith(20);
  });
  it("does not claim no matches while more pages remain", () => {
    mocks.status = "CanLoadMore";
    render();
    const markup = JSON.stringify(renderer.toJSON());
    expect(markup).toContain("No matches on this page yet");
    expect(markup).not.toContain("No question versions match these filters");
  });
  it("keeps the filter form mounted when the results query fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.fail = true;
    render();
    expect(
      renderer.root.findByProps({ "aria-label": "Question bank filters" }),
    ).toBeDefined();
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "We could not load the requested admin data.",
    );
    mocks.fail = false;
    const retry = renderer.root
      .findAllByType("button")
      .find((candidate) => candidate.props.children === "Try again");
    expect(retry).toBeDefined();
    act(() => retry!.props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "No question versions match",
    );
  });
});

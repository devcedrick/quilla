import { describe, expect, it } from "vitest";
import {
  assertIndependentReviewer,
  nextQuestionState,
} from "./questionWorkflow";

describe("question lifecycle guards", () => {
  it("advances legal transitions and their workflow revision", () => {
    expect(nextQuestionState("draft", 1, 1, "submit")).toEqual({
      state: "pending_review",
      workflowRevision: 2,
    });
    expect(nextQuestionState("pending_review", 2, 2, "approve").state).toBe(
      "approved",
    );
    expect(nextQuestionState("approved", 3, 3, "publish").state).toBe(
      "published",
    );
    expect(nextQuestionState("published", 4, 4, "archive").state).toBe(
      "archived",
    );
  });
  it("rejects stale decisions and illegal publication", () => {
    expect(() =>
      nextQuestionState("approved", 3, 2, "reject", "reason"),
    ).toThrow();
    for (const state of [
      "draft",
      "pending_review",
      "needs_revision",
      "rejected",
      "archived",
    ] as const)
      expect(() => nextQuestionState(state, 1, 1, "publish")).toThrow();
  });
  it("requires reasons for negative review outcomes", () => {
    for (const action of ["reject", "needs_revision"] as const) {
      expect(() =>
        nextQuestionState("pending_review", 1, 1, action, " "),
      ).toThrow();
      expect(
        nextQuestionState(
          "pending_review",
          1,
          1,
          action,
          "Explain the missing assumption",
        ).workflowRevision,
      ).toBe(2);
    }
  });
  it("excludes both authors and material editors from review", () => {
    expect(() =>
      assertIndependentReviewer("author", "author", "editor"),
    ).toThrow();
    expect(() =>
      assertIndependentReviewer("editor", "author", "editor"),
    ).toThrow();
    expect(() =>
      assertIndependentReviewer("reviewer", "author", "editor"),
    ).not.toThrow();
  });
});

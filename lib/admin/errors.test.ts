import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { adminErrorCode, adminErrorMessage } from "./errors";

describe("admin error presentation", () => {
  it("extracts stable domain codes only", () => {
    expect(
      adminErrorCode(new ConvexError({ code: "STALE_REVISION", message: "x" })),
    ).toBe("STALE_REVISION");
    expect(adminErrorCode(new ConvexError({ code: "lowercase" }))).toBeNull();
    expect(adminErrorCode(new ConvexError({ code: "has space" }))).toBeNull();
    expect(adminErrorCode(new ConvexError("plain string"))).toBeNull();
    expect(adminErrorCode(new Error("boom"))).toBeNull();
    expect(adminErrorCode(null)).toBeNull();
  });
  it("maps known codes to safe user-facing copy", () => {
    expect(
      adminErrorMessage(
        new ConvexError({ code: "SELF_REVIEW", message: "internal detail" }),
        "fallback",
      ),
    ).toContain("cannot review their own question");
  });
  it("uses the fallback for unknown codes and non-domain errors", () => {
    expect(
      adminErrorMessage(
        new ConvexError({ code: "UNKNOWN_CODE", message: "x" }),
        "fallback",
      ),
    ).toBe("fallback");
    expect(adminErrorMessage(new Error("internal detail"), "fallback")).toBe(
      "fallback",
    );
  });
});

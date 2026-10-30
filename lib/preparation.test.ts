import { describe, expect, it } from "vitest";
import { manilaDate, targetDateError } from "./preparation";

describe("Philippine target dates", () => {
  it("changes day at Manila midnight, independent of host timezone", () => {
    expect(manilaDate(Date.parse("2026-10-28T15:59:59Z"))).toBe("2026-10-28");
    expect(manilaDate(Date.parse("2026-10-28T16:00:00Z"))).toBe("2026-10-29");
  });
  it.each(["2026-10-29", "2026-10-30", "2028-02-29"])("accepts %s", (date) =>
    expect(targetDateError(date, "2026-10-29")).toBeNull(),
  );
  it.each([
    "2026-10-28",
    "2027-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2026-1-01",
    "10/29/2026",
    "",
    "2026-10-29T00:00:00Z",
  ])("rejects %s", (date) =>
    expect(targetDateError(date, "2026-10-29")).not.toBeNull(),
  );
});

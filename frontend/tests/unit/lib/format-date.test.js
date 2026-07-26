import { describe, expect, it } from "vitest";
import { formatPeriod } from "../../../lib/format-date";

describe("formatPeriod", () => {
  it("renders a start and end date as a range", () => {
    expect(formatPeriod("2026-08-04T00:00:00+09:00", "2026-08-08T00:00:00+09:00")).toBe("8. 4 - 8. 8");
  });

  it("labels an open-ended run by its start", () => {
    expect(formatPeriod("2026-08-04T00:00:00+09:00", null)).toBe("8. 4 시작");
  });

  it("labels a run with only an end date", () => {
    expect(formatPeriod(null, "2026-08-08T00:00:00+09:00")).toBe("8. 8 종료");
  });

  it("returns nothing when both bounds are missing", () => {
    expect(formatPeriod(null, null)).toBeNull();
  });

  it("ignores unparseable timestamps instead of printing Invalid Date", () => {
    expect(formatPeriod("어제", "내일")).toBeNull();
  });
});

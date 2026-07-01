import { describe, expect, it } from "vitest";
import { formatDistance, formatClock, formatNumber, formatPercent, timeAgo } from "./format";

describe("formatDistance", () => {
  it("formats meters under 1km", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(999)).toBe("999 m");
  });
  it("formats kilometers", () => {
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(3400)).toBe("3.4 km");
    expect(formatDistance(1_240_000)).toBe("1,240 km");
  });
  it("guards invalid input", () => {
    expect(formatDistance(-1)).toBe("—");
  });
});

describe("formatClock", () => {
  it("formats mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(600)).toBe("10:00");
  });
});

describe("formatNumber / formatPercent", () => {
  it("groups thousands", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });
  it("computes percent safely", () => {
    expect(formatPercent(1, 4)).toBe("25%");
    expect(formatPercent(1, 0)).toBe("—");
  });
});

describe("timeAgo", () => {
  it("labels recent times", () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(now, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
});

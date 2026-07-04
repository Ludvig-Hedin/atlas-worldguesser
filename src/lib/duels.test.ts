import { describe, expect, it } from "vitest";
import { duelHealthShare } from "./duels";

describe("duelHealthShare", () => {
  it("splits 50/50 when both scores are zero", () => {
    expect(duelHealthShare(0, 0)).toBe(50);
  });

  it("gives 100 when the opponent has zero and I have any positive score", () => {
    expect(duelHealthShare(3000, 0)).toBe(100);
  });

  it("gives 0 when I have zero and the opponent has a positive score", () => {
    expect(duelHealthShare(0, 4200)).toBe(0);
  });

  it("splits 50/50 for equal nonzero scores", () => {
    expect(duelHealthShare(2500, 2500)).toBe(50);
  });

  it("computes a proportional split", () => {
    expect(duelHealthShare(3000, 1000)).toBe(75);
  });
});

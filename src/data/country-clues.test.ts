import { describe, expect, it } from "vitest";
import { COUNTRY_NAMES } from "@/lib/countries-meta";
import { CLUE_CATEGORIES, DRIVING_SIDE_BY_COUNTRY, drivingSide, drivingSideFact } from "./country-clues";

describe("DRIVING_SIDE_BY_COUNTRY", () => {
  it("covers every country code Atlas recognizes, with no gaps", () => {
    const missing = Object.keys(COUNTRY_NAMES).filter((cc) => !(cc in DRIVING_SIDE_BY_COUNTRY));
    expect(missing).toEqual([]);
  });

  it("has no invented codes beyond what Atlas recognizes", () => {
    const extra = Object.keys(DRIVING_SIDE_BY_COUNTRY).filter((cc) => !(cc in COUNTRY_NAMES));
    expect(extra).toEqual([]);
  });

  it("only uses left or right", () => {
    for (const side of Object.values(DRIVING_SIDE_BY_COUNTRY)) {
      expect(["left", "right"]).toContain(side);
    }
  });

  it.each([
    ["GB", "left"],
    ["IE", "left"],
    ["CY", "left"],
    ["JP", "left"],
    ["TH", "left"],
    ["ID", "left"],
    ["IN", "left"],
    ["ZA", "left"],
    ["KE", "left"],
    ["MZ", "left"],
    ["US", "right"],
    ["FR", "right"],
    ["DE", "right"],
    ["BZ", "right"],
    ["MM", "right"],
  ])("known edge case: %s drives on the %s", (cc, expected) => {
    expect(DRIVING_SIDE_BY_COUNTRY[cc]).toBe(expected);
  });
});

describe("drivingSide", () => {
  it("returns undefined for unknown or missing codes", () => {
    expect(drivingSide(null)).toBeUndefined();
    expect(drivingSide(undefined)).toBeUndefined();
    expect(drivingSide("XX")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(drivingSide("gb")).toBe("left");
  });
});

describe("drivingSideFact", () => {
  it("describes left-hand traffic", () => {
    expect(drivingSideFact("GB")).toBe("Cars drive on the left here.");
  });

  it("describes right-hand traffic", () => {
    expect(drivingSideFact("US")).toBe("Cars drive on the right here.");
  });

  it("returns undefined for unknown codes", () => {
    expect(drivingSideFact("XX")).toBeUndefined();
  });
});

describe("CLUE_CATEGORIES", () => {
  it("has exactly the five expected categories", () => {
    expect(CLUE_CATEGORIES.map((c) => c.id)).toEqual(["bollards", "poles", "plates", "camera", "driving-side"]);
  });

  it("every category has a non-empty title and body", () => {
    for (const category of CLUE_CATEGORIES) {
      expect(category.title.length).toBeGreaterThan(0);
      expect(category.body.length).toBeGreaterThan(0);
    }
  });
});

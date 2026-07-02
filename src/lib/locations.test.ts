import { describe, expect, it } from "vitest";
import { getMapPool, pickLocations, poolSize } from "./locations";
import { EUROPE_CODES } from "./maps-config";
import { seededRandom } from "./utils";

const EU = new Set(EUROPE_CODES);

describe("map pools", () => {
  it("has a non-empty world pool", () => {
    expect(poolSize("world")).toBeGreaterThan(100);
  });

  it("restricts the Europe pool to European countries", () => {
    for (const loc of getMapPool("europe")) {
      expect(EU.has(loc.cc)).toBe(true);
    }
  });

  it("restricts the USA pool to the United States", () => {
    for (const loc of getMapPool("usa")) {
      expect(loc.cc).toBe("US");
    }
  });
});

describe("pickLocations", () => {
  it("returns the requested number of locations", () => {
    const picks = pickLocations("world", 5, seededRandom(42));
    expect(picks).toHaveLength(5);
    for (const p of picks) {
      expect(typeof p.lat).toBe("number");
      expect(typeof p.countryCode).toBe("string");
    }
  });

  it("is deterministic for a given seed", () => {
    const a = pickLocations("world", 5, seededRandom(7));
    const b = pickLocations("world", 5, seededRandom(7));
    expect(a).toEqual(b);
  });

  it("respects the map filter", () => {
    const picks = pickLocations("usa", 5, seededRandom(3));
    for (const p of picks) expect(p.countryCode).toBe("US");
  });
});

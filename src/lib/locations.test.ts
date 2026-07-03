import { describe, expect, it } from "vitest";
import { pickMatchLocations } from "../../convex/gameLogic";
import { getMapPool, pickLocations, poolSize, sampleLocations } from "./locations";
import {
  AFRICA_CODES,
  ASIA_CODES,
  EUROPE_CODES,
  MIDDLE_EAST_CODES,
  NORDIC_CODES,
  NORTH_AMERICA_CODES,
  OCEANIA_CODES,
  SOUTH_AMERICA_CODES,
  SOUTHEAST_ASIA_CODES,
} from "./maps-config";
import { seededRandom } from "./utils";

const EU = new Set(EUROPE_CODES);

/** Region maps (continents + sub-regions): filter the seed dataset via `countryCodes`. */
const REGIONS: { id: string; codes: string[] }[] = [
  { id: "asia", codes: ASIA_CODES },
  { id: "africa", codes: AFRICA_CODES },
  { id: "northamerica", codes: NORTH_AMERICA_CODES },
  { id: "southamerica", codes: SOUTH_AMERICA_CODES },
  { id: "oceania", codes: OCEANIA_CODES },
  // Sub-region maps behave identically — same countryCodes filter, may overlap a
  // continent set. `min` guards against an empty pool if a code typo drops all
  // matches (a filter over the seed dataset must still yield a playable round set).
  { id: "nordics", codes: NORDIC_CODES },
  { id: "middleeast", codes: MIDDLE_EAST_CODES },
  { id: "southeastasia", codes: SOUTHEAST_ASIA_CODES },
];

describe("map pools", () => {
  it("has a non-empty world pool", () => {
    expect(poolSize("world")).toBeGreaterThan(100);
  });

  it("has a non-empty countries pool", () => {
    expect(poolSize("countries")).toBeGreaterThan(100);
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

describe.each(REGIONS)("region map $id", ({ id, codes }) => {
  const set = new Set(codes);

  it("has a non-empty pool", () => {
    expect(poolSize(id)).toBeGreaterThan(0);
  });

  it("only contains in-region countries", () => {
    for (const loc of getMapPool(id)) {
      expect(set.has(loc.cc)).toBe(true);
    }
  });

  it("resolves the same pool on client and server (parity)", () => {
    // getMapPool (client/solo) and pickMatchLocations (server/multiplayer) both
    // drive off the shared countryCodes config; picks must stay in-region.
    const picks = pickMatchLocations(id, 5, 123);
    for (const p of picks) {
      expect(set.has(p.countryCode)).toBe(true);
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

describe("sampleLocations pad-loop", () => {
  // When count > pool.length the pad-loop repeats picks. An injected rng() that
  // returns its 1.0 upper bound must not index past the end (undefined entry).
  it("never yields undefined when rng() returns 1.0 and count exceeds the pool", () => {
    const pool = pickLocations("usa", 2, seededRandom(1)); // 2 real GameLocations
    const padded = sampleLocations(pool, 5, () => 1);
    expect(padded).toHaveLength(5);
    for (const p of padded) expect(p).toBeDefined();
  });
});

describe("daily challenge locations", () => {
  // The Daily Challenge derives its locations from the day number via
  // pickMatchLocations; identical seeds MUST yield identical rounds so every
  // player faces the same challenge.
  it("are identical for the same day seed", () => {
    const day = 20_321;
    const a = pickMatchLocations("world", 5, day);
    const b = pickMatchLocations("world", 5, day);
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });

  it("differ across days", () => {
    const a = pickMatchLocations("world", 5, 20_321);
    const b = pickMatchLocations("world", 5, 20_322);
    expect(a).not.toEqual(b);
  });
});

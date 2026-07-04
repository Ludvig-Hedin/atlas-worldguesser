import { describe, expect, it } from "vitest";
import {
  layeredSample,
  locationKey,
  mergeRecentKeys,
  pickMatchLocations,
  RECENT_LOCATIONS_CAP,
} from "./gameLogic";
import { getMapPool } from "../src/lib/locations";

describe("locationKey", () => {
  it("is stable for the same coordinates", () => {
    expect(locationKey({ lat: 1.5, lng: -2.25 })).toBe(locationKey({ lat: 1.5, lng: -2.25 }));
  });

  it("differs for different coordinates", () => {
    expect(locationKey({ lat: 1, lng: 2 })).not.toBe(locationKey({ lat: 2, lng: 1 }));
  });
});

describe("layeredSample", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const keyOf = (p: { id: string }) => p.id;

  it("returns `count` items with no excludeKeys", () => {
    const out = layeredSample(pool, 2, () => 0.4, keyOf);
    expect(out).toHaveLength(2);
  });

  it("prefers items not in excludeKeys", () => {
    const excludeKeys = new Set(["a", "b", "c"]);
    const out = layeredSample(pool, 1, () => 0, keyOf, excludeKeys);
    expect(out).toEqual([{ id: "d" }]);
  });

  it("falls back to excluded items once the fresh pool is exhausted", () => {
    const excludeKeys = new Set(["a", "b", "c"]);
    const out = layeredSample(pool, 4, () => 0, keyOf, excludeKeys);
    expect(out).toHaveLength(4);
    expect(out.map(keyOf).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("pads with replacement once the whole pool is exhausted (never returns undefined)", () => {
    const out = layeredSample(pool, 6, () => 1, keyOf);
    expect(out).toHaveLength(6);
    for (const p of out) expect(p).toBeDefined();
  });
});

describe("mergeRecentKeys", () => {
  it("appends new keys", () => {
    expect(mergeRecentKeys(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("caps at the given size, evicting the oldest first", () => {
    expect(mergeRecentKeys(["a", "b", "c"], ["d"], 3)).toEqual(["b", "c", "d"]);
  });

  it("defaults to RECENT_LOCATIONS_CAP", () => {
    const existing = Array.from({ length: RECENT_LOCATIONS_CAP }, (_, i) => `k${i}`);
    const merged = mergeRecentKeys(existing, ["new"]);
    expect(merged).toHaveLength(RECENT_LOCATIONS_CAP);
    expect(merged.at(-1)).toBe("new");
    expect(merged).not.toContain("k0");
  });
});

describe("pickMatchLocations with excludeKeys", () => {
  it("avoids excluded locations when enough fresh ones remain", () => {
    const size = getMapPool("usa").length;
    const excludeKeys = new Set(pickMatchLocations("usa", size - 2, 1).map(locationKey));
    const picks = pickMatchLocations("usa", 2, 2, excludeKeys);
    for (const loc of picks) expect(excludeKeys.has(locationKey(loc))).toBe(false);
  });

  it("still returns `rounds` locations once excludeKeys covers the whole pool", () => {
    const size = getMapPool("usa").length;
    const excludeKeys = new Set(pickMatchLocations("usa", size, 1).map(locationKey));
    const picks = pickMatchLocations("usa", 5, 2, excludeKeys);
    expect(picks).toHaveLength(5);
  });

  it("without excludeKeys, is unaffected by this feature (regression)", () => {
    const a = pickMatchLocations("world", 5, 999);
    const b = pickMatchLocations("world", 5, 999);
    expect(a).toEqual(b);
  });
});

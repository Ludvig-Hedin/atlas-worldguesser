import { beforeEach, describe, expect, it } from "vitest";
import { RECENT_LOCATIONS_CAP } from "@convex/gameLogic";
import { getRecentLocationKeys, recordSeenLocations } from "./recent-locations";

describe("recent-locations (localStorage mirror)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty set with no history", () => {
    expect(getRecentLocationKeys("world").size).toBe(0);
  });

  it("records and retrieves seen locations", () => {
    recordSeenLocations("world", [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    const keys = getRecentLocationKeys("world");
    expect(keys.has("1:2")).toBe(true);
    expect(keys.has("3:4")).toBe(true);
  });

  it("keeps history separate per map", () => {
    recordSeenLocations("world", [{ lat: 1, lng: 2 }]);
    recordSeenLocations("usa", [{ lat: 5, lng: 6 }]);
    expect(getRecentLocationKeys("world").has("5:6")).toBe(false);
    expect(getRecentLocationKeys("usa").has("1:2")).toBe(false);
  });

  it("caps history and evicts the oldest entries", () => {
    for (let i = 0; i < RECENT_LOCATIONS_CAP + 10; i++) {
      recordSeenLocations("world", [{ lat: i, lng: i }]);
    }
    const keys = getRecentLocationKeys("world");
    expect(keys.size).toBeLessThanOrEqual(RECENT_LOCATIONS_CAP);
    expect(keys.has("0:0")).toBe(false);
    expect(keys.has(`${RECENT_LOCATIONS_CAP + 9}:${RECENT_LOCATIONS_CAP + 9}`)).toBe(true);
  });
});

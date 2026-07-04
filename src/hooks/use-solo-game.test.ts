import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSoloGame } from "./use-solo-game";
import type { GameLocation, GameSettings } from "@/lib/types";
import { getMapPool } from "@/lib/locations";
import { recordSeenLocations } from "@/lib/recent-locations";

const settings: GameSettings = { rounds: 3, timeLimitSec: 0, movement: "moving" };

// A distinctive server-owned round set (none of these are the Åkers/Grundbro
// easter-egg coordinates, so an accidental egg roll would be visible).
const serverLocations: GameLocation[] = [
  { lat: 48.8566, lng: 2.3522, countryCode: "FR" },
  { lat: 35.6762, lng: 139.6503, countryCode: "JP" },
  { lat: -33.8688, lng: 151.2093, countryCode: "AU" },
];

describe("useSoloGame — fixedOrder (server-authoritative round set)", () => {
  it("plays injected locations verbatim, in order, on the world map", () => {
    // World map is where the client would normally roll hometown easter eggs;
    // fixedOrder must suppress that AND preserve the exact server order so the
    // server can re-derive each round's answer by index (locations[round-1]).
    const { result } = renderHook(() =>
      useSoloGame({ mapId: "world", settings, customLocations: serverLocations, fixedOrder: true }),
    );
    expect(result.current.game.locations).toEqual(serverLocations);
  });

  it("truncates to settings.rounds while keeping order", () => {
    const extra = [...serverLocations, { lat: 1, lng: 1, countryCode: "BR" }];
    const { result } = renderHook(() =>
      useSoloGame({
        mapId: "world",
        settings: { ...settings, rounds: 2 },
        customLocations: extra,
        fixedOrder: true,
      }),
    );
    expect(result.current.game.locations).toEqual(extra.slice(0, 2));
  });

  it("still produces settings.rounds locations from the official pool when no set is injected", () => {
    const { result } = renderHook(() => useSoloGame({ mapId: "world", settings }));
    expect(result.current.game.locations).toHaveLength(settings.rounds);
  });
});

describe("useSoloGame — recent-location exclusion (official pool only)", () => {
  it("avoids locations recorded as recently seen on the same map", () => {
    window.localStorage.clear();
    // Nordics (not World) deliberately — World rolls a small per-round chance
    // of swapping in a hometown easter egg, which would make an exact-match
    // assertion here flaky. It's also small enough (18 seed locations) that
    // "every location except exactly 3" fits under RECENT_LOCATIONS_CAP (30,
    // see convex/gameLogic.ts): recordSeenLocations stores at most `cap` keys,
    // so a bigger map (e.g. Europe's 98) would silently drop most of the
    // exclusions and make this assertion flaky for reasons unrelated to the
    // code under test. Record every Nordics location except exactly 3 as
    // "seen", so the only way this game's 3 rounds can all avoid the seen set
    // is if exclusion actually ran (pure chance would almost certainly hit at
    // least one of the many "seen" entries).
    const pool = getMapPool("nordics");
    const toExclude = pool.slice(0, pool.length - 3);
    recordSeenLocations("nordics", toExclude.map((l) => ({ lat: l.lat, lng: l.lng })));
    const remainingKeys = new Set(pool.slice(pool.length - 3).map((l) => `${l.lat}:${l.lng}`));

    const { result } = renderHook(() =>
      useSoloGame({ mapId: "nordics", settings: { ...settings, rounds: 3 } }),
    );
    expect(result.current.game.usesOfficialPool).toBe(true);
    for (const loc of result.current.game.locations) {
      expect(remainingKeys.has(`${loc.lat}:${loc.lng}`)).toBe(true);
    }
  });

  it("marks fixedOrder (server-authoritative) games as not using the official pool", () => {
    const { result } = renderHook(() =>
      useSoloGame({ mapId: "world", settings, customLocations: serverLocations, fixedOrder: true }),
    );
    expect(result.current.game.usesOfficialPool).toBe(false);
  });
});

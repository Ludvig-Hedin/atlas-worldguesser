import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSoloGame } from "./use-solo-game";
import type { GameLocation, GameSettings } from "@/lib/types";

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

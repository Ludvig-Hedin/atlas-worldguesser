import type { GameModeId, GameSettings } from "./types";

/**
 * Remembers the player's most recent solo setup so they can jump straight back
 * in with one tap ("Continue") instead of re-choosing map + settings every time.
 */

const KEY = "atlas:last-game:v1";

export interface LastGame {
  mapId: GameModeId;
  settings: GameSettings;
  /** Human label for the map (e.g. "World") shown on the Continue button. */
  label: string;
  playedAt: number;
}

export function saveLastGame(input: Omit<LastGame, "playedAt">, now = Date.now()) {
  if (typeof window === "undefined") return;
  try {
    const payload: LastGame = { ...input, playedAt: now };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // storage full / disabled — non-fatal
  }
}

export function loadLastGame(): LastGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastGame>;
    if (!parsed || typeof parsed.mapId !== "string" || !parsed.settings) {
      return null;
    }
    // Validate every GameSettings field so a stale/corrupt entry can't feed
    // undefined settings into the game engine.
    const s = parsed.settings;
    if (
      typeof s.rounds !== "number" ||
      typeof s.timeLimitSec !== "number" ||
      (s.movement !== "moving" && s.movement !== "noMove" && s.movement !== "noMoveNoPanZoom") ||
      typeof parsed.label !== "string"
    ) {
      return null;
    }
    return parsed as LastGame;
  } catch {
    return null;
  }
}

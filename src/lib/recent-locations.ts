import { locationKey, mergeRecentKeys } from "@convex/gameLogic";

const STORAGE_PREFIX = "atlas.recentLocations.";

function storageKey(mapId: string): string {
  return `${STORAGE_PREFIX}${mapId}`;
}

/**
 * Recently shown location keys for `mapId`, read from localStorage. Returns
 * an empty set when unavailable (SSR, private browsing, quota errors) — this
 * is only ever a "nice to have" dedup layer for anonymous, no-account play,
 * never a source of truth to guard against failure.
 */
export function getRecentLocationKeys(mapId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(mapId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((k): k is string => typeof k === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Record that the on-device player was just shown `locations` on `mapId`. */
export function recordSeenLocations(
  mapId: string,
  locations: readonly { lat: number; lng: number }[],
): void {
  if (typeof window === "undefined" || locations.length === 0) return;
  try {
    const existing = Array.from(getRecentLocationKeys(mapId));
    const next = mergeRecentKeys(existing, locations.map(locationKey));
    window.localStorage.setItem(storageKey(mapId), JSON.stringify(next));
  } catch {
    // Private browsing / quota errors — dedup is a nice-to-have, never block play.
  }
}

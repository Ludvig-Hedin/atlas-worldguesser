/**
 * Server-side game logic for multiplayer. Reuses the pure scoring core from the
 * app (`src/lib/scoring`, `src/lib/maps-config`) and the shared seed dataset so
 * solo and multiplayer stay perfectly consistent.
 */
import { haversineMeters, roundScore } from "../src/lib/scoring";
import { getMapConfig, scaleMetersForMap } from "../src/lib/maps-config";
import { WORLD_LOCATIONS, COUNTRY_LOCATIONS, type SeedLocation } from "../src/data/locations";

export { scaleMetersForMap, haversineMeters, roundScore };

export const ANTIPODE_METERS = Math.PI * 6_371_008.8;

export const MAX_ROUNDS = 20;
export const MAX_TIME_LIMIT_SEC = 600;

/** Survival pre-picks a deep buffer up front; a run rarely reaches this many.
 * Shared with `src/hooks/use-solo-game.ts` so client and server (challenges.ts)
 * can never drift on how many locations a Survival run's buffer holds. */
export const SURVIVAL_BUFFER = 200;

/** Clamp untrusted client settings to safe bounds (prevents huge matches). */
export function clampSettings<S extends { rounds: number; timeLimitSec: number }>(s: S): S {
  return {
    ...s,
    rounds: Math.max(1, Math.min(MAX_ROUNDS, Math.floor(s.rounds || 1))),
    timeLimitSec: Math.max(0, Math.min(MAX_TIME_LIMIT_SEC, Math.floor(s.timeLimitSec || 0))),
  };
}

export interface MatchLocation {
  lat: number;
  lng: number;
  countryCode: string;
}

// Mirror of `getMapPool` in src/lib/locations.ts, driven off the same shared
// `countryCodes` config so solo and multiplayer resolve identical pools.
function pool(mapId: string): SeedLocation[] {
  if (mapId === "countries") return COUNTRY_LOCATIONS;
  const codes = getMapConfig(mapId).countryCodes;
  if (!codes) return WORLD_LOCATIONS;
  const set = new Set(codes);
  return WORLD_LOCATIONS.filter((l) => set.has(l.cc));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable identity for a seed/game location — same coordinates always yield
 * the same key, regardless of which pool (world/country/custom) they came
 * from. Used to bias repeat picks away from a player's recent history. */
export function locationKey(l: { lat: number; lng: number }): string {
  return `${l.lat}:${l.lng}`;
}

/**
 * Shuffle-and-slice `count` items out of `pool` using `rng`. When
 * `excludeKeys` is given, items NOT in it are exhausted first (in random
 * order) before falling back to excluded items, so a caller can bias away
 * from recently-seen locations without ever returning fewer than `count`
 * items (as long as the pool itself has enough). Falls back to sampling with
 * replacement only once the whole pool has been used once — identical to the
 * pre-existing pad behavior when `excludeKeys` is omitted.
 */
export function layeredSample<T>(
  pool: readonly T[],
  count: number,
  rng: () => number,
  keyOf: (item: T) => string,
  excludeKeys?: ReadonlySet<string>,
): T[] {
  const shuffled = (items: readonly T[]): T[] => {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      // Math.min guards an rng() that returns exactly 1.0 (mulberry32 never
      // does, but injected/test RNGs may) from indexing past the end.
      const j = Math.min(i, Math.floor(rng() * (i + 1)));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const ordered =
    excludeKeys && excludeKeys.size > 0
      ? [
          ...shuffled(pool.filter((p) => !excludeKeys.has(keyOf(p)))),
          ...shuffled(pool.filter((p) => excludeKeys.has(keyOf(p)))),
        ]
      : shuffled(pool);
  const chosen = ordered.slice(0, Math.min(count, pool.length));
  // Once `count` exceeds the pool, pad with replacement, indexing the
  // ORIGINAL `pool` order (not `ordered`) — same element set either way, but
  // this means a padded pick for a given seed/rng draw isn't reproducible
  // across code versions that padded from a different array order.
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]);
  }
  return chosen;
}

/** Ring-buffer cap for a user's "recently shown locations" history — see
 * convex/recentLocations.ts and src/lib/recent-locations.ts. */
export const RECENT_LOCATIONS_CAP = 30;

/** Append `newKeys` to `existing` and keep only the most recent `cap` entries
 * (oldest evicted first). Pure so both the server-side table and the
 * client-only localStorage mirror share one tested eviction rule. */
export function mergeRecentKeys(
  existing: readonly string[],
  newKeys: readonly string[],
  cap: number = RECENT_LOCATIONS_CAP,
): string[] {
  return [...existing, ...newKeys].slice(-cap);
}

/**
 * Deterministically pick the match's hidden answer locations from a seed.
 * `excludeKeys` (see `locationKey`), when given, biases the pick away from a
 * player's recently-shown locations (see convex/recentLocations.ts) — omit it
 * for contexts that must stay identical for every viewer (Daily Challenge,
 * shared Survival challenge links).
 */
export function pickMatchLocations(
  mapId: string,
  rounds: number,
  seed: number,
  excludeKeys?: ReadonlySet<string>,
): MatchLocation[] {
  const p = pool(mapId);
  const rng = mulberry32(seed);
  const chosen = layeredSample(p, rounds, rng, locationKey, excludeKeys);
  // Hometown easter eggs — small chance any round drops in Åkers Styckebruk or
  // Grundbro, SE. World map only: a Sweden drop inside Europe/USA maps breaks
  // their region contract (matches the solo engine's behavior). Each egg gets
  // an independent 3% roll off the same draw.
  const AKERS = { lat: 59.217, lng: 17.006, cc: "SE" };
  const GRUNDBRO = { lat: 59.3089, lng: 17.0899, cc: "SE" };
  return chosen.map((s) => {
    if (mapId !== "world") return { lat: s.lat, lng: s.lng, countryCode: s.cc };
    const r = rng();
    if (r < 0.03) return { lat: AKERS.lat, lng: AKERS.lng, countryCode: AKERS.cc };
    if (r < 0.06) return { lat: GRUNDBRO.lat, lng: GRUNDBRO.lng, countryCode: GRUNDBRO.cc };
    return { lat: s.lat, lng: s.lng, countryCode: s.cc };
  });
}

/** Authoritative distance + score for a guess (score computed server-side). */
export function computeGuessScore(
  guess: { lat: number; lng: number } | null,
  actual: { lat: number; lng: number },
  mapId: string,
): { distanceMeters: number; score: number } {
  if (!guess) return { distanceMeters: ANTIPODE_METERS, score: 0 };
  const distanceMeters = haversineMeters(guess, actual);
  return { distanceMeters, score: roundScore(distanceMeters, scaleMetersForMap(mapId)) };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A short, unambiguous room code. */
export function randomRoomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

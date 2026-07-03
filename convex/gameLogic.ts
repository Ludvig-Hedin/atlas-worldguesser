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

/** Deterministically pick the match's hidden answer locations from a seed. */
export function pickMatchLocations(mapId: string, rounds: number, seed: number): MatchLocation[] {
  const p = pool(mapId).slice();
  const rng = mulberry32(seed);
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const chosen = p.slice(0, Math.min(rounds, p.length));
  while (chosen.length < rounds && p.length > 0) {
    chosen.push(p[Math.floor(rng() * p.length)]);
  }
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

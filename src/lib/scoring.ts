import type { LatLng } from "./types";
import { MAX_ROUND_SCORE } from "./types";
import { clamp } from "./math";

const EARTH_RADIUS_METERS = 6_371_008.8;

/** Guesses within this distance are treated as a perfect round. */
export const PERFECT_THRESHOLD_METERS = 20;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Round score on a 0–5000 scale using GeoGuessr's exponential decay.
 * `scaleMeters` sets map difficulty: larger = more forgiving (world ≈ 2000km).
 * score = 5000 · e^(−distance / scale)
 */
export function roundScore(distanceMeters: number, scaleMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 0;
  if (scaleMeters <= 0) return distanceMeters < PERFECT_THRESHOLD_METERS ? MAX_ROUND_SCORE : 0;
  if (distanceMeters < PERFECT_THRESHOLD_METERS) return MAX_ROUND_SCORE;

  const raw = MAX_ROUND_SCORE * Math.exp(-distanceMeters / scaleMeters);
  return clamp(Math.round(raw), 0, MAX_ROUND_SCORE);
}

/** Sum of round scores. */
export function totalScore(scores: readonly number[]): number {
  return scores.reduce((sum, s) => sum + s, 0);
}

/** The maximum achievable match score for `rounds` rounds. */
export function maxMatchScore(rounds: number): number {
  return rounds * MAX_ROUND_SCORE;
}

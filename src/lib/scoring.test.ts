import { describe, expect, it } from "vitest";
import { haversineMeters, roundScore, maxMatchScore, PERFECT_THRESHOLD_METERS } from "./scoring";
import { MAX_ROUND_SCORE } from "./types";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters(LONDON, LONDON)).toBe(0);
  });

  it("matches the known London–Paris distance (~343 km)", () => {
    const d = haversineMeters(LONDON, PARIS);
    expect(d).toBeGreaterThan(340_000);
    expect(d).toBeLessThan(346_000);
  });

  it("is symmetric", () => {
    expect(haversineMeters(LONDON, PARIS)).toBeCloseTo(haversineMeters(PARIS, LONDON), 6);
  });
});

describe("roundScore", () => {
  const WORLD_SCALE = 2_000_000;

  it("awards a perfect score for a pinpoint guess", () => {
    expect(roundScore(0, WORLD_SCALE)).toBe(MAX_ROUND_SCORE);
    expect(roundScore(PERFECT_THRESHOLD_METERS - 1, WORLD_SCALE)).toBe(MAX_ROUND_SCORE);
  });

  it("follows exponential decay at the map scale", () => {
    // at exactly one scale-length, score = 5000 * e^-1 ≈ 1839
    expect(roundScore(WORLD_SCALE, WORLD_SCALE)).toBe(Math.round(MAX_ROUND_SCORE * Math.exp(-1)));
  });

  it("decreases monotonically with distance", () => {
    const a = roundScore(100_000, WORLD_SCALE);
    const b = roundScore(500_000, WORLD_SCALE);
    const c = roundScore(3_000_000, WORLD_SCALE);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it("stays within [0, 5000]", () => {
    for (const d of [0, 1_000, 1_000_000, 20_000_000]) {
      const s = roundScore(d, WORLD_SCALE);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(MAX_ROUND_SCORE);
    }
  });

  it("handles invalid input safely", () => {
    expect(roundScore(-5, WORLD_SCALE)).toBe(0);
    expect(roundScore(Number.NaN, WORLD_SCALE)).toBe(0);
  });
});

describe("maxMatchScore", () => {
  it("is rounds * 5000", () => {
    expect(maxMatchScore(5)).toBe(25_000);
  });
});

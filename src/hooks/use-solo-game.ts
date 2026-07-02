"use client";

import { useCallback, useMemo, useState } from "react";
import { countryAtAsync } from "@/lib/geo";
import { scaleMetersForMap } from "@/lib/maps-config";
import { haversineMeters, roundScore } from "@/lib/scoring";
import type { GameLocation, GameSettings, LatLng, RoundResult } from "@/lib/types";
import { pickLocations, sampleLocations } from "@/lib/locations";
import { hashString, seededRandom } from "@/lib/utils";

/** Farthest two points on Earth can be (antipodal), used when no guess is made. */
export const ANTIPODE_METERS = Math.PI * 6_371_008.8;

export type Phase = "guessing" | "reveal" | "finished";

export interface SoloGame {
  id: string;
  mapId: string;
  settings: GameSettings;
  seed: number;
  locations: GameLocation[];
  results: RoundResult[];
  /** 1-based index of the active round. */
  round: number;
  phase: Phase;
  roundStartAt: number;
}

interface CreateOpts {
  mapId: string;
  settings: GameSettings;
  seed?: number;
  /** Explicit location pool (custom maps); falls back to the official pool. */
  customLocations?: GameLocation[];
}

/** Hometown easter egg — a small chance any round drops here. */
const AKERS: GameLocation = { lat: 59.217, lng: 17.006, countryCode: "SE" };

function createGame({ mapId, settings, seed, customLocations }: CreateOpts): SoloGame {
  const resolvedSeed = seed ?? hashString(crypto.randomUUID());
  const rng = seededRandom(resolvedSeed);
  const picked =
    customLocations && customLocations.length > 0
      ? sampleLocations(customLocations, settings.rounds, rng)
      : pickLocations(mapId, settings.rounds, rng);
  const locations = picked.map((loc) => (rng() < 0.03 ? AKERS : loc));
  return {
    id: crypto.randomUUID(),
    mapId,
    settings,
    seed: resolvedSeed,
    locations,
    results: [],
    round: 1,
    phase: "guessing",
    roundStartAt: Date.now(),
  };
}

export interface UseSoloGame {
  game: SoloGame;
  guess: LatLng | null;
  setGuess: (g: LatLng | null) => void;
  submit: () => Promise<void>;
  next: () => void;
  restart: (opts?: Partial<CreateOpts>) => void;
  replaceCurrentLocation: (loc: GameLocation) => void;
  currentLocation: GameLocation;
  currentResult: RoundResult | null;
  totalScore: number;
  submitting: boolean;
}

/**
 * Fully client-side solo game engine. Deterministic from a seed so the same
 * game can be replayed. Scoring and country lookup happen locally.
 */
export function useSoloGame(initial: CreateOpts): UseSoloGame {
  const [game, setGame] = useState<SoloGame>(() => createGame(initial));
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentLocation = game.locations[game.round - 1];

  const submit = useCallback(async () => {
    if (game.phase !== "guessing" || submitting) return;
    setSubmitting(true);
    const actual = game.locations[game.round - 1];
    const g = guess;
    const distance = g ? haversineMeters(g, actual) : ANTIPODE_METERS;
    const score = g ? roundScore(distance, scaleMetersForMap(game.mapId)) : 0;
    const timeMs = Date.now() - game.roundStartAt;
    const guessCC = g ? await countryAtAsync(g) : null;
    const result: RoundResult = {
      round: game.round,
      actual,
      guess: g,
      distanceMeters: distance,
      score,
      timeMs,
      guessCountryCode: guessCC,
      countryCorrect: !!guessCC && guessCC === actual.countryCode,
    };
    setGame((prev) => ({ ...prev, results: [...prev.results, result], phase: "reveal" }));
    setSubmitting(false);
  }, [game, guess, submitting]);

  const next = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== "reveal") return prev;
      if (prev.round >= prev.settings.rounds) return { ...prev, phase: "finished" };
      return { ...prev, round: prev.round + 1, phase: "guessing", roundStartAt: Date.now() };
    });
    setGuess(null);
  }, []);

  const restart = useCallback(
    (opts?: Partial<CreateOpts>) => {
      setGame(
        createGame({
          mapId: initial.mapId,
          settings: initial.settings,
          customLocations: initial.customLocations,
          ...opts,
        }),
      );
      setGuess(null);
      setSubmitting(false);
    },
    [initial.mapId, initial.settings, initial.customLocations],
  );

  const replaceCurrentLocation = useCallback((loc: GameLocation) => {
    setGame((prev) => {
      if (prev.phase !== "guessing") return prev;
      const locations = prev.locations.slice();
      locations[prev.round - 1] = loc;
      return { ...prev, locations };
    });
  }, []);

  const currentResult = useMemo(
    () => game.results.find((r) => r.round === game.round) ?? null,
    [game.results, game.round],
  );

  const totalScore = useMemo(
    () => game.results.reduce((sum, r) => sum + r.score, 0),
    [game.results],
  );

  return {
    game,
    guess,
    setGuess,
    submit,
    next,
    restart,
    replaceCurrentLocation,
    currentLocation,
    currentResult,
    totalScore,
    submitting,
  };
}

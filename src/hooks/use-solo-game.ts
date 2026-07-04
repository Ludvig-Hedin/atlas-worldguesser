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

/**
 * `classic` = fixed `settings.rounds`. `survival` = endless country-streak: keep
 * going while each guess names the correct country; the first miss ends the run.
 */
export type SoloMode = "classic" | "survival";

export interface SoloGame {
  id: string;
  mapId: string;
  mode: SoloMode;
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
  mode?: SoloMode;
  /** Explicit location pool (custom maps); falls back to the official pool. */
  customLocations?: GameLocation[];
  /**
   * Treat `customLocations` as the exact, already-ordered round set and play
   * them verbatim — no resample, no easter-egg roll. Set by the
   * server-authoritative flows (Daily Challenge, cloud solo) where the SERVER
   * owns the rounds and re-derives each answer by index (locations[round-1]);
   * any client reshuffle or egg roll would desync that scoring. Custom maps
   * leave this false so each game samples a fresh subset.
   */
  fixedOrder?: boolean;
}

/** Hometown easter eggs — a small chance any round drops here. */
const AKERS: GameLocation = { lat: 59.217, lng: 17.006, countryCode: "SE" };
const GRUNDBRO: GameLocation = { lat: 59.3089, lng: 17.0899, countryCode: "SE" };

/** Survival pre-picks a deep buffer up front; a run rarely reaches this many. */
const SURVIVAL_BUFFER = 200;

function createGame({
  mapId,
  settings,
  seed,
  customLocations,
  mode = "classic",
  fixedOrder = false,
}: CreateOpts): SoloGame {
  const resolvedSeed = seed ?? hashString(crypto.randomUUID());
  const rng = seededRandom(resolvedSeed);
  const count = mode === "survival" ? SURVIVAL_BUFFER : settings.rounds;
  const custom = customLocations ?? [];
  const hasCustom = custom.length > 0;
  // fixedOrder (Daily / cloud solo): the server already resolved + ordered these
  // rounds, so play them verbatim — the server re-derives each answer by index
  // and any client reshuffle would desync scoring. Otherwise sample as before
  // (custom-map pool, or the official pool for this map).
  const picked = hasCustom
    ? fixedOrder
      ? custom.slice(0, count)
      : sampleLocations(custom, count, rng)
    : pickLocations(mapId, count, rng);
  // Hometown easter eggs — world map only (a Sweden drop inside USA/Europe/custom
  // maps breaks the region contract) AND never when locations were injected: the
  // server has already finalized those (it does its own egg roll), so re-rolling
  // here would both desync cloud scoring and double-apply on the daily set. Each
  // egg gets an independent 3% roll off the same draw.
  const locations =
    mapId === "world" && !hasCustom
      ? picked.map((loc) => {
          const r = rng();
          if (r < 0.03) return AKERS;
          if (r < 0.06) return GRUNDBRO;
          return loc;
        })
      : picked;
  return {
    id: crypto.randomUUID(),
    mapId,
    mode,
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
  /** Survival: how many rounds in a row the correct country was named. */
  survivalStreak: number;
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
    try {
      const actual = game.locations[game.round - 1];
      const g = guess;
      const distance = g ? haversineMeters(g, actual) : ANTIPODE_METERS;
      const score = g ? roundScore(distance, scaleMetersForMap(game.mapId)) : 0;
      const timeMs = Date.now() - game.roundStartAt;
      // Country lookup lazy-loads a JSON chunk; if that fails (offline, stale
      // deploy) score the round anyway — only the country bonus is lost. Retry
      // a few times: in survival a false "wrong country" from a transient blip
      // would wrongly end the run. loadCountries caches on first success, so a
      // healthy connection resolves on the first attempt.
      let guessCC: string | null = null;
      if (g) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            guessCC = await countryAtAsync(g);
            break;
          } catch {
            guessCC = null;
            // Brief backoff so a recovering connection can resolve the country
            // chunk on a later attempt (a persistent immediate failure would
            // otherwise burn all 3 tries in milliseconds → false wrong-country).
            if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
          }
        }
      }
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
      setGame((prev) =>
        prev.phase !== "guessing"
          ? prev
          : { ...prev, results: [...prev.results, result], phase: "reveal" },
      );
    } finally {
      // Always release the guard — otherwise a throw soft-locks the round.
      setSubmitting(false);
    }
  }, [game, guess, submitting]);

  const next = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== "reveal") return prev;
      if (prev.mode === "survival") {
        // Survive only if the just-revealed round named the correct country.
        // A miss (or exhausting the buffer) ends the run.
        const last = prev.results[prev.results.length - 1];
        const survived = !!last && last.countryCorrect;
        if (!survived || prev.round >= prev.locations.length) {
          return { ...prev, phase: "finished" };
        }
        return { ...prev, round: prev.round + 1, phase: "guessing", roundStartAt: Date.now() };
      }
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
          mode: initial.mode,
          fixedOrder: initial.fixedOrder,
          ...opts,
        }),
      );
      setGuess(null);
      setSubmitting(false);
    },
    [initial.mapId, initial.settings, initial.customLocations, initial.mode, initial.fixedOrder],
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

  const survivalStreak = useMemo(
    () => game.results.filter((r) => r.countryCorrect).length,
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
    survivalStreak,
    submitting,
  };
}

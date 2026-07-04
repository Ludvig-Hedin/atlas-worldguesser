"use client";

import { useCallback, useMemo, useState } from "react";
import { scaleMetersForMap } from "@/lib/maps-config";
import { haversineMeters, roundScore } from "@/lib/scoring";
import type { GameLocation, GameSettings, LatLng } from "@/lib/types";
import { pickLocations } from "@/lib/locations";
import { getRecentLocationKeys, recordSeenLocations } from "@/lib/recent-locations";
import { hashString, seededRandom } from "@/lib/utils";
import { ANTIPODE_METERS } from "./use-solo-game";

export interface LocalPlayer {
  name: string;
  color: string;
}

export interface LocalTurnResult {
  round: number;
  playerIndex: number;
  guess: LatLng | null;
  distanceMeters: number;
  score: number;
}

export type LocalPartyPhase = "handoff" | "guessing" | "roundReveal" | "finished";

export interface LocalPartyGame {
  id: string;
  mapId: string;
  settings: GameSettings;
  players: LocalPlayer[];
  locations: GameLocation[];
  /** 1-based index of the active round. */
  round: number;
  /** 0-based index into `players` for whose turn it is (or just finished). */
  turnIndex: number;
  phase: LocalPartyPhase;
  results: LocalTurnResult[];
  roundStartAt: number;
}

interface CreateOpts {
  mapId: string;
  settings: GameSettings;
  players: LocalPlayer[];
  seed?: number;
}

function createGame({ mapId, settings, players, seed }: CreateOpts): LocalPartyGame {
  const resolvedSeed = seed ?? hashString(crypto.randomUUID());
  const rng = seededRandom(resolvedSeed);
  const locations = pickLocations(mapId, settings.rounds, rng, getRecentLocationKeys(mapId));
  return {
    id: crypto.randomUUID(),
    mapId,
    settings,
    players,
    locations,
    round: 1,
    turnIndex: 0,
    phase: "handoff",
    results: [],
    roundStartAt: Date.now(),
  };
}

export interface UseLocalPartyGame {
  game: LocalPartyGame;
  guess: LatLng | null;
  setGuess: (g: LatLng | null) => void;
  /** Leaves the "pass the device" screen and starts the current player's turn timer. */
  beginTurn: () => void;
  submit: () => void;
  /** Leaves the round-reveal screen — advances to the next round, or finishes the match. */
  continueToNextRound: () => void;
  /** Same players/map/settings, fresh locations. */
  restart: () => void;
  currentLocation: GameLocation;
  currentPlayer: LocalPlayer;
  /** Every completed turn's result for the round currently on screen. */
  currentRoundResults: LocalTurnResult[];
  /** Running total per player, in `players` order. */
  totals: number[];
}

/**
 * Fully client-side, turn-based local-multiplayer engine: one shared panorama
 * per round; each local player takes an independent turn against it before the
 * round reveals to everyone at once. No accounts, no network, no persistence —
 * mirrors useSoloGame's location-picking so the two never drift, but replaces
 * the single-player round loop with a per-round turn queue.
 */
export function useLocalPartyGame(initial: CreateOpts): UseLocalPartyGame {
  const [game, setGame] = useState<LocalPartyGame>(() => createGame(initial));
  const [guess, setGuess] = useState<LatLng | null>(null);

  const currentLocation = game.locations[game.round - 1];
  const currentPlayer = game.players[game.turnIndex];

  const beginTurn = useCallback(() => {
    setGame((prev) =>
      prev.phase !== "handoff" ? prev : { ...prev, phase: "guessing", roundStartAt: Date.now() },
    );
  }, []);

  const submit = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== "guessing") return prev;
      const actual = prev.locations[prev.round - 1];
      const distance = guess ? haversineMeters(guess, actual) : ANTIPODE_METERS;
      const score = guess ? roundScore(distance, scaleMetersForMap(prev.mapId)) : 0;
      const result: LocalTurnResult = {
        round: prev.round,
        playerIndex: prev.turnIndex,
        guess,
        distanceMeters: distance,
        score,
      };
      const results = [...prev.results, result];
      const lastPlayer = prev.turnIndex >= prev.players.length - 1;
      return lastPlayer
        ? { ...prev, results, phase: "roundReveal" }
        : { ...prev, results, turnIndex: prev.turnIndex + 1, phase: "handoff" };
    });
    setGuess(null);
  }, [guess]);

  const continueToNextRound = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== "roundReveal") return prev;
      if (prev.round >= prev.settings.rounds) {
        recordSeenLocations(prev.mapId, prev.locations);
        return { ...prev, phase: "finished" };
      }
      return {
        ...prev,
        round: prev.round + 1,
        turnIndex: 0,
        phase: "handoff",
        roundStartAt: Date.now(),
      };
    });
  }, []);

  const restart = useCallback(() => {
    setGame(createGame({ mapId: initial.mapId, settings: initial.settings, players: initial.players }));
    setGuess(null);
  }, [initial.mapId, initial.settings, initial.players]);

  const totals = useMemo(() => {
    const sums = game.players.map(() => 0);
    for (const r of game.results) sums[r.playerIndex] += r.score;
    return sums;
  }, [game.players, game.results]);

  const currentRoundResults = useMemo(
    () => game.results.filter((r) => r.round === game.round),
    [game.results, game.round],
  );

  return {
    game,
    guess,
    setGuess,
    beginTurn,
    submit,
    continueToNextRound,
    restart,
    currentLocation,
    currentPlayer,
    currentRoundResults,
    totals,
  };
}

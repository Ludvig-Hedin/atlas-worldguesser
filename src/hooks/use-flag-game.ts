"use client";

import { useCallback, useMemo, useState } from "react";
import { hashString } from "@/lib/utils";
import { pickFlags } from "@/lib/flags/pool";
import { FLAG_MAX_WRONG, flagRoundScore } from "@/lib/flags/scoring";
import type { FlagRegionId } from "@/lib/flags/regions";
import type { FlagCellStatus } from "@/components/game/flag-map";

export interface FlagRoundResult {
  iso: string;
  wrongAttempts: number;
  score: number;
  solved: boolean;
}

export type FlagPhase = "guessing" | "revealed" | "finished";

export interface FlagGameState {
  regionId: FlagRegionId;
  flags: string[];
  index: number;
  phase: FlagPhase;
  /** Wrong clicks on the current flag. */
  wrongThisFlag: number;
  /** Wrong ISO codes clicked on the current flag, in order (drives the trail). */
  wrongCodes: string[];
  results: FlagRoundResult[];
}

interface FlagGameArgs {
  regionId: FlagRegionId;
  /** Pre-resolved country pool (loaded async by the caller). */
  pool: string[];
  length: number;
}

function createState({ regionId, pool, length }: FlagGameArgs): FlagGameState {
  const seed = hashString(crypto.randomUUID());
  return {
    regionId,
    flags: pickFlags(pool, length, seed),
    index: 0,
    phase: "guessing",
    wrongThisFlag: 0,
    wrongCodes: [],
    results: [],
  };
}

/** Map the current state to per-country paint statuses for the map. */
function buildStatus(state: FlagGameState): Record<string, FlagCellStatus> {
  const status: Record<string, FlagCellStatus> = {};
  state.wrongCodes.forEach((iso, i) => {
    status[iso] = i === 0 ? "wrong1" : i === 1 ? "wrong2" : "wrong3";
  });
  if (state.phase !== "guessing") {
    const current = state.flags[state.index];
    const last = state.results[state.results.length - 1];
    if (current) status[current] = last?.solved ? "correct" : "revealed";
  }
  return status;
}

export interface FlagGame {
  state: FlagGameState;
  currentIso: string | undefined;
  totalScore: number;
  status: Record<string, FlagCellStatus>;
  length: number;
  /** Register a clicked country; no-op unless currently guessing. */
  guess: (iso: string) => void;
  /** Advance to the next flag / finish; no-op unless a reveal is showing. */
  next: () => void;
  restart: () => void;
}

export function useFlagGame(args: FlagGameArgs): FlagGame {
  const [state, setState] = useState<FlagGameState>(() => createState(args));

  const guess = useCallback((iso: string) => {
    setState((s) => {
      if (s.phase !== "guessing") return s;
      const current = s.flags[s.index];
      if (iso === current) {
        const result: FlagRoundResult = {
          iso: current,
          wrongAttempts: s.wrongThisFlag,
          score: flagRoundScore(s.wrongThisFlag),
          solved: true,
        };
        return { ...s, phase: "revealed", results: [...s.results, result] };
      }
      // Wrong click. Ignore a repeat of a country already marked wrong.
      if (s.wrongCodes.includes(iso)) return s;
      const wrong = s.wrongThisFlag + 1;
      const wrongCodes = [...s.wrongCodes, iso];
      if (wrong >= FLAG_MAX_WRONG) {
        const result: FlagRoundResult = {
          iso: current,
          wrongAttempts: FLAG_MAX_WRONG,
          score: 0,
          solved: false,
        };
        return { ...s, phase: "revealed", wrongThisFlag: wrong, wrongCodes, results: [...s.results, result] };
      }
      return { ...s, wrongThisFlag: wrong, wrongCodes };
    });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (s.phase !== "revealed") return s;
      if (s.index + 1 >= s.flags.length) return { ...s, phase: "finished" };
      return { ...s, index: s.index + 1, phase: "guessing", wrongThisFlag: 0, wrongCodes: [] };
    });
  }, []);

  const restart = useCallback(() => {
    setState(createState(args));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.regionId, args.length, args.pool]);

  const totalScore = useMemo(() => state.results.reduce((sum, r) => sum + r.score, 0), [state.results]);
  const status = useMemo(() => buildStatus(state), [state]);

  return {
    state,
    currentIso: state.flags[state.index],
    totalScore,
    status,
    length: state.flags.length,
    guess,
    next,
    restart,
  };
}

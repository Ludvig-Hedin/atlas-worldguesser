"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyFlagResult,
  applyGame,
  emptyProfile,
  loadProfile,
  saveProfile,
  type ApplyResult,
  type FlagApplyResult,
  type GameSummary,
  type LocalProfile,
} from "@/lib/local-profile";

export interface UseLocalProfile {
  profile: LocalProfile;
  ready: boolean;
  record: (game: GameSummary) => ApplyResult;
  recordFlag: (input: { region: string; score: number; xpGained: number }) => FlagApplyResult;
  setUsername: (username: string) => void;
  reset: () => void;
}

/** Guest profile stored in localStorage: stats, streaks, achievements, history. */
export function useLocalProfile(): UseLocalProfile {
  const [profile, setProfile] = useState<LocalProfile>(emptyProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  const record = useCallback((game: GameSummary): ApplyResult => {
    // Fold onto the freshest persisted state to avoid stale closures.
    const result = applyGame(loadProfile(), game);
    saveProfile(result.profile);
    setProfile(result.profile);
    return result;
  }, []);

  const recordFlag = useCallback((input: { region: string; score: number; xpGained: number }): FlagApplyResult => {
    const result = applyFlagResult(loadProfile(), input);
    saveProfile(result.profile);
    setProfile(result.profile);
    return result;
  }, []);

  const setUsername = useCallback((username: string) => {
    // Merge onto the freshest persisted state (like record) so renaming can't
    // clobber stats written by another hook instance or tab since mount.
    const next = { ...loadProfile(), username };
    saveProfile(next);
    setProfile(next);
  }, []);

  const reset = useCallback(() => {
    const fresh = emptyProfile();
    saveProfile(fresh);
    setProfile(fresh);
  }, []);

  return { profile, ready, record, recordFlag, setUsername, reset };
}

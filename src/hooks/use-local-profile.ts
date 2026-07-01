"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyGame,
  emptyProfile,
  loadProfile,
  saveProfile,
  type ApplyResult,
  type GameSummary,
  type LocalProfile,
} from "@/lib/local-profile";

export interface UseLocalProfile {
  profile: LocalProfile;
  ready: boolean;
  record: (game: GameSummary) => ApplyResult;
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

  const setUsername = useCallback((username: string) => {
    setProfile((prev) => {
      const next = { ...prev, username };
      saveProfile(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const fresh = emptyProfile();
    saveProfile(fresh);
    setProfile(fresh);
  }, []);

  return { profile, ready, record, setUsername, reset };
}

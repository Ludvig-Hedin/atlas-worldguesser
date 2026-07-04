"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { SoloGame } from "@/hooks/use-solo-game";

const MAX_ATTEMPTS = 3;

/**
 * When a signed-in user finishes a solo game, mirror it to their cloud profile.
 * Rendered only where Convex is configured; a no-op for guests. Retries with
 * backoff on failure so a dropped connection at the exact moment a game ends
 * doesn't silently lose the player's result.
 */
export function SoloCloudSync({ game, customMapId }: { game: SoloGame; customMapId?: Id<"maps"> }) {
  const { isAuthenticated } = useConvexAuth();
  const record = useMutation(api.users.recordSoloResult);
  const done = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || done.current) return;
    // Claim synchronously (before the mutation resolves) so a re-entrant
    // effect run — React StrictMode's mount/cleanup/remount, or `record`'s
    // identity changing while a call is in flight — can't double-submit the
    // same game. The backend has no idempotency check, so a duplicate call
    // would double-count XP/stats and insert a second history row.
    done.current = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    record({
      mapId: game.mapId,
      customMapId,
      settings: game.settings,
      results: game.results.map((r) => ({
        round: r.round,
        actual: { lat: r.actual.lat, lng: r.actual.lng, countryCode: r.actual.countryCode },
        guess: r.guess,
        distanceMeters: r.distanceMeters,
        score: r.score,
        guessCountryCode: r.guessCountryCode,
        countryCorrect: r.countryCorrect,
      })),
    }).catch(() => {
      // No `cancelled` gate: `done.current` already guarantees only one
      // invocation ever owns this submission, and in dev StrictMode tears
      // down (and thus "cancels") that very invocation synchronously right
      // after mount — before this catch can run — so gating on it here would
      // wrongly suppress this closure's own retry/toast.
      // attempt 0 is the initial call above, so this only gates retries —
      // cap total invocations (initial + retries) at MAX_ATTEMPTS.
      if (attempt < MAX_ATTEMPTS - 1) {
        done.current = false; // release the claim so the retry (new `attempt`) can run
        retryTimer = setTimeout(() => setAttempt((a) => a + 1), 2000 * (attempt + 1));
      } else {
        toast.error("Couldn't save this game to your profile. Check your connection.");
      }
    });

    // Only cancels an already-scheduled retry timer on a real unmount/dep
    // change — doesn't gate the catch handler above (see comment there).
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, record, game, attempt, customMapId]);

  return null;
}

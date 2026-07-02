"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { SoloGame } from "@/hooks/use-solo-game";

/**
 * When a signed-in user finishes a solo game, mirror it to their cloud profile.
 * Rendered only where Convex is configured; a no-op for guests.
 */
export function SoloCloudSync({ game }: { game: SoloGame }) {
  const { isAuthenticated } = useConvexAuth();
  const record = useMutation(api.users.recordSoloResult);
  const done = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || done.current) return;
    done.current = true;
    record({
      mapId: game.mapId,
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
    }).catch(() => {});
  }, [isAuthenticated, record, game]);

  return null;
}

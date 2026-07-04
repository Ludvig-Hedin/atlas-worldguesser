"use client";

import { useQuery } from "convex/react";
import { Film } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ReplayView } from "./replay-view";
import { useT } from "@/hooks/use-t";
import type { RoundResult } from "@/lib/types";

export function ReplayClient({ gameId }: { gameId: string }) {
  const t = useT();
  const data = useQuery(api.games.getReplay, { gameId: gameId as Id<"games"> });

  if (data === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Film className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("replay.notFound")}</h1>
      </div>
    );
  }

  const results: RoundResult[] = data.replay.map((r) => ({
    round: r.round,
    actual: { lat: r.actual.lat, lng: r.actual.lng, countryCode: r.actual.countryCode },
    guess: r.guess,
    distanceMeters: r.distanceMeters,
    score: r.score,
    timeMs: 0,
    guessCountryCode: r.guessCountryCode,
    countryCorrect: r.countryCorrect,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <ReplayView mapId={data.mapId} results={results} owner={data.owner ?? undefined} />
    </div>
  );
}

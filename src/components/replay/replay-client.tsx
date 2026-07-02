"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Film } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MatchMap } from "@/components/game/match-map";
import { GuessMap } from "@/components/game/guess-map";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { countryName, flagEmoji } from "@/lib/countries-meta";
import { formatDistance, formatNumber } from "@/lib/format";
import { getMapConfig } from "@/lib/maps-config";
import { MAX_ROUND_SCORE, type RoundResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReplayClient({ gameId }: { gameId: string }) {
  const data = useQuery(api.games.getReplay, { gameId: gameId as Id<"games"> });
  const [selected, setSelected] = useState<number | null>(null);

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
        <h1 className="text-xl font-semibold">Replay not found</h1>
      </div>
    );
  }

  const map = getMapConfig(data.mapId);
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
  const active = selected != null ? results.find((r) => r.round === selected) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{map.emoji}</span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{map.name} replay</h1>
            {data.owner && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IdentityAvatar name={data.owner.username} src={data.owner.avatarUrl} className="size-4" />
                {data.owner.username}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular text-primary-muted">{formatNumber(data.totalScore)}</p>
          <p className="text-xs text-muted-foreground">/ {formatNumber(data.maxScore)}</p>
        </div>
      </header>

      {/* Round selector */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            selected == null ? "bg-white/10 text-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground",
          )}
        >
          Overview
        </button>
        {results.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => setSelected(r.round)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selected === r.round ? "bg-white/10 text-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground",
            )}
          >
            R{r.round}
          </button>
        ))}
      </div>

      <div className="h-72 overflow-hidden rounded-2xl border border-border sm:h-96">
        {active ? (
          <GuessMap
            key={active.round}
            guess={active.guess}
            actual={active.actual}
            reveal
            interactive={false}
            initialView={map.view}
          />
        ) : (
          <MatchMap results={results} initialView={map.view} />
        )}
      </div>

      {active && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              {flagEmoji(active.actual.countryCode)} {countryName(active.actual.countryCode)}
            </span>
            <span className="font-semibold tabular text-primary-muted">{formatNumber(active.score)}</span>
          </div>
          <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
            {active.guess ? `${formatDistance(active.distanceMeters)} away` : "No guess"}
          </p>
          <Progress value={active.score / MAX_ROUND_SCORE} />
        </div>
      )}

      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {results.map((r) => (
          <button
            key={r.round}
            type="button"
            onClick={() => setSelected(r.round)}
            className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="w-5 text-xs font-semibold tabular text-muted-foreground">{r.round}</span>
            <span className="text-lg">{flagEmoji(r.actual.countryCode)}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{countryName(r.actual.countryCode)}</span>
            <span className="text-xs text-muted-foreground">
              {r.guess ? formatDistance(r.distanceMeters) : "No guess"}
            </span>
            <span className="w-14 text-right text-sm font-semibold tabular text-primary-muted">
              {formatNumber(r.score)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

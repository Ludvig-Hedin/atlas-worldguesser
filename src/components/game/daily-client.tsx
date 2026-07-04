"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CalendarDays, Crown, Play } from "lucide-react";
import { api } from "@convex/_generated/api";
import { AtlasMark } from "@/components/atlas-mark";
import { SoloGame } from "./solo-game";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoundResult } from "@/lib/types";

/**
 * Daily Challenge: play the server-fixed set of world locations once a day, then
 * see the global board. Plays via SoloGame with the day's locations injected as
 * customLocations. mapId is "daily" (not "world") so the engine's client-side
 * easter eggs can't re-roll a player onto a different spot — that would make the
 * shared daily unfair. getMapConfig falls back to world, so scoring scale
 * (and the server's DAILY_MAP="world") stay consistent.
 */
export function DailyClient() {
  const t = useT();
  const today = useQuery(api.dailyChallenge.today);
  const board = useQuery(api.dailyChallenge.leaderboard, {});
  const submit = useMutation(api.dailyChallenge.submit);
  const { isAuthenticated } = useConvexAuth();
  const [playing, setPlaying] = useState(false);
  // Submit at most once per session; "Play again" on the finish screen must not
  // re-submit (server would reject it and it would burn a rate-limit token).
  const submittedRef = useRef(false);

  const handleComplete = (results: RoundResult[]) => {
    if (!isAuthenticated || !today || submittedRef.current) return;
    submittedRef.current = true;
    void submit({
      day: today.day,
      // The server re-derives `actual` from its own day-seeded locations and
      // recomputes distance/score/countryCorrect — only the guess and the
      // named country are ever sent.
      results: results.map((r) => ({
        round: r.round,
        guess: r.guess,
        guessCountryCode: r.guessCountryCode,
      })),
    })
      .then((res) => {
        toast.success(
          t("daily.submitSuccess", { score: formatNumber(res.score), correct: res.correctCount }),
        );
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : t("daily.submitErrorFallback");
        // Terminal errors (already played / expired) stay locked; a transient
        // failure re-opens so a later attempt can still land the score.
        if (!/already played|expired/i.test(msg)) submittedRef.current = false;
        toast.error(msg);
      });
  };

  if (playing && today) {
    return (
      <SoloGame
        mapId="daily"
        settings={today.settings}
        customLocations={today.locations}
        fixedOrder
        cloudSync={false}
        onComplete={handleComplete}
        onExit={() => setPlaying(false)}
      />
    );
  }

  const played = today?.played ?? false;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <AtlasMark className="size-5 text-primary-muted" />
          Atlas
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/play">{t("daily.solo")}</Link>
        </Button>
      </header>

      <main className="flex flex-1 justify-center px-4 py-6">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          <div className="text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3.5 text-primary-muted" />
              {t("daily.badge")}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("daily.heading")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("daily.subheading")}</p>
          </div>

          {today === undefined ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : played ? (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center text-sm">
              {t("daily.playedBanner")}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button size="lg" className="w-full sm:w-auto sm:px-12" onClick={() => setPlaying(true)}>
                <Play className="size-4" />
                {t("daily.playButton")}
              </Button>
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground">{t("daily.signInNudge")}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-medium text-muted-foreground">{t("daily.leaderboardTitle")}</span>
              {board?.mine && (
                <span className="text-xs text-muted-foreground tabular">
                  {board.mine.rank > 0
                    ? t("daily.youScoreRank", { score: formatNumber(board.mine.score), rank: board.mine.rank })
                    : t("daily.youScore", { score: formatNumber(board.mine.score) })}
                </span>
              )}
            </div>

            {board === undefined ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-2xl" />
                ))}
              </div>
            ) : board.entries.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
                {t("daily.noScoresYet")}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {board.entries.map((e) => (
                  <div
                    key={e.userId}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <span
                      className={cn(
                        "w-7 text-center text-sm font-semibold tabular",
                        e.rank <= 3 ? "text-gold" : "text-muted-foreground",
                      )}
                    >
                      {e.rank}
                    </span>
                    <IdentityAvatar name={e.username} src={e.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium" title={e.username}>
                          {e.username}
                        </span>
                        {e.rank === 1 && <Crown className="size-3.5 text-gold" />}
                      </div>
                      <p className="text-xs text-muted-foreground tabular">
                        {t("daily.countriesOf5", { count: e.correctCount })}
                      </p>
                    </div>
                    <Badge variant="muted" className="tabular">
                      {formatNumber(e.score)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

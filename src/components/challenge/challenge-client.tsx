"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Swords } from "lucide-react";
import { api } from "@convex/_generated/api";
import { AtlasMark } from "@/components/atlas-mark";
import { SoloGame } from "@/components/game/solo-game";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoundResult } from "@/lib/types";

/**
 * Async streak-challenge: play a friend's exact Survival-mode round sequence
 * (server-owned mapId+rounds+seed, see convex/challenges.ts) and compare
 * streaks. Structurally mirrors DailyClient (skeleton / not-found / loaded,
 * `playing` swaps to a fullscreen SoloGame) but for a one-off shared link
 * instead of a daily rotating board.
 */
export function ChallengeClient({ challengeId }: { challengeId: string }) {
  const t = useT();
  const data = useQuery(api.challenges.get, { challengeId });
  const submitAttempt = useMutation(api.challenges.submitAttempt);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const [playing, setPlaying] = useState(false);
  // Computed client-side immediately on finish so guests (who can't save via
  // submitAttempt) still see the comparison right away.
  const [localResult, setLocalResult] = useState<{ streak: number; score: number } | null>(null);
  // Submit at most once per session; re-entering "New Game" must not re-submit.
  const submittedRef = useRef(false);

  const handleComplete = (results: RoundResult[]) => {
    setLocalResult({
      streak: results.filter((r) => r.countryCorrect).length,
      score: results.reduce((sum, r) => sum + r.score, 0),
    });
    // TODO(bug-hunt): same stale-isAuthenticated race as DailyClient's
    // handleComplete (see that file) — a signed-in user who finishes fast on
    // a slow connection can have this one-shot callback silently skip
    // submitAttempt with no retry/toast. Fix: submit from a useEffect keyed
    // on [isAuthenticated, isLoading] instead of this direct check.
    if (!isAuthenticated || !data || submittedRef.current) return;
    submittedRef.current = true;
    void submitAttempt({
      challengeId: data._id,
      results: results.map((r) => ({
        round: r.round,
        guess: r.guess,
        guessCountryCode: r.guessCountryCode,
      })),
    })
      .then((res) => {
        toast.success(t("challenge.attemptSaved", { streak: res.streak, score: formatNumber(res.score) }));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : t("challenge.attemptErrorFallback");
        // Terminal error (already attempted) stays locked; a transient failure
        // re-opens so a later attempt can still land the save.
        if (!/already attempted/i.test(msg)) submittedRef.current = false;
        toast.error(msg);
      });
  };

  if (playing && data) {
    return (
      <SoloGame
        mapId={data.mapId}
        settings={data.settings}
        mode="survival"
        customLocations={data.locations}
        fixedOrder
        cloudSync={false}
        onComplete={handleComplete}
        onExit={() => setPlaying(false)}
      />
    );
  }

  const creatorName = data?.creator?.username ?? t("challenge.unknownPlayer");
  // Prefer the freshly-saved server attempt once the live query catches up;
  // fall back to the locally-computed result right after finishing (covers
  // guests, and the brief window before submitAttempt's write is visible).
  const myResult = data?.myAttempt ?? localResult;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <AtlasMark className="size-5 text-primary-muted" />
          Atlas
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/play">{t("challenge.solo")}</Link>
        </Button>
      </header>

      <main className="flex flex-1 justify-center px-4 py-6">
        <div className="flex w-full max-w-md flex-col gap-6">
          {data === undefined ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-2/3 rounded-lg" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : data === null ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Swords className="size-8 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("challenge.notFound")}</h1>
              <Button asChild>
                <Link href="/play">{t("challenge.solo")}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Swords className="size-3.5 text-primary-muted" />
                  {t("challenge.badge")}
                </div>
                <div className="mb-1 flex items-center justify-center gap-2">
                  <IdentityAvatar
                    name={creatorName}
                    src={data.creator?.avatarUrl}
                    buildingId={data.creator?.avatarBuildingId}
                    color={data.creator?.avatarColor}
                    className="size-6"
                  />
                  <h1 className="text-lg font-semibold">{creatorName}</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("challenge.subtitle", { count: data.creatorStreak })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular">
                  {t("challenge.attemptsSoFar", { count: data.attemptCount })}
                </p>
              </div>

              {myResult ? (
                <ChallengeComparison
                  creatorName={creatorName}
                  creatorStreak={data.creatorStreak}
                  creatorScore={data.creatorScore}
                  myStreak={myResult.streak}
                  myScore={myResult.score}
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Button size="lg" className="w-full sm:w-auto sm:px-12" onClick={() => setPlaying(true)}>
                    <Swords className="size-4" />
                    {t("challenge.playButton")}
                  </Button>
                  {!authLoading && !isAuthenticated && (
                    <p className="text-xs text-muted-foreground">{t("challenge.signInNudge")}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ChallengeComparison({
  creatorName,
  creatorStreak,
  creatorScore,
  myStreak,
  myScore,
}: {
  creatorName: string;
  creatorStreak: number;
  creatorScore: number;
  myStreak: number;
  myScore: number;
}) {
  const t = useT();
  const won = myStreak > creatorStreak || (myStreak === creatorStreak && myScore > creatorScore);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "rounded-2xl border p-4 text-center text-sm font-medium",
          won ? "border-primary/40 bg-primary/10" : "border-border bg-card",
        )}
      >
        {won ? t("challenge.youWon") : t("challenge.youLost", { name: creatorName })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">{t("challenge.you")}</p>
          <p className="text-2xl font-semibold tabular">{myStreak}</p>
          <p className="text-xs text-muted-foreground tabular">{formatNumber(myScore)} pts</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="truncate text-xs text-muted-foreground" title={creatorName}>
            {creatorName}
          </p>
          <p className="text-2xl font-semibold tabular">{creatorStreak}</p>
          <p className="text-xs text-muted-foreground tabular">{formatNumber(creatorScore)} pts</p>
        </div>
      </div>
    </div>
  );
}

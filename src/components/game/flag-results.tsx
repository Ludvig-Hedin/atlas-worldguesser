"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Home, RotateCcw, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/game/animated-number";
import { FlagCloudSync } from "@/components/game/flag-cloud-sync";
import { FlagLeaderboard } from "@/components/game/flag-leaderboard";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { countryName } from "@/lib/countries-meta";
import { FLAG_MAX_SCORE, flagXpForRun } from "@/lib/flags/scoring";
import { getFlagRegion, type FlagGameMode, type FlagRegionId } from "@/lib/flags/regions";
import { levelProgress } from "@/lib/xp";
import type { FlagApplyResult } from "@/lib/local-profile";
import type { FlagRoundResult } from "@/hooks/use-flag-game";

interface FlagResultsProps {
  regionId: FlagRegionId;
  mode: FlagGameMode;
  results: FlagRoundResult[];
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function FlagResults({ regionId, mode, results, onPlayAgain, onNewGame }: FlagResultsProps) {
  const t = useT();
  const { recordFlag, profile } = useLocalProfile();
  const region = getFlagRegion(regionId);

  const perFlagWrong = useMemo(() => results.map((r) => r.wrongAttempts), [results]);
  const totalScore = useMemo(() => results.reduce((sum, r) => sum + r.score, 0), [results]);
  const maxScore = results.length * FLAG_MAX_SCORE;
  const correctCount = results.filter((r) => r.solved).length;
  const xpGained = useMemo(() => flagXpForRun(perFlagWrong), [perFlagWrong]);

  // Fold into the guest profile exactly once (StrictMode-safe).
  const recordedRef = useRef(false);
  const [applied, setApplied] = useState<FlagApplyResult | null>(null);
  useEffect(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    setApplied(recordFlag({ region: regionId, mode, score: totalScore, xpGained }));
  }, [recordFlag, regionId, mode, totalScore, xpGained]);

  const xp = applied?.profile.stats.xp ?? profile.stats.xp;
  const lvl = levelProgress(xp);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center px-4 py-8">
      {features.auth && <FlagCloudSync region={regionId} mode={mode} perFlagWrong={perFlagWrong} />}

      <div className="flex w-full max-w-lg flex-col gap-5">
        <div className="text-center">
          <Badge variant="primary" className="mb-3">
            {t(region.nameKey)}
          </Badge>
          <div className="flex items-end justify-center gap-1.5">
            <AnimatedNumber value={totalScore} format={formatNumber} className="text-4xl font-semibold tracking-tight" />
            <span className="pb-1 text-lg text-muted-foreground">/ {formatNumber(maxScore)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("flags.resultSummary", { correct: correctCount, total: results.length, xp: formatNumber(xpGained) })}
          </p>
        </div>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t("flags.level", { level: lvl.level })}</span>
            <span className="text-xs text-muted-foreground tabular">
              {formatNumber(lvl.into)} / {formatNumber(lvl.span)} XP
            </span>
          </div>
          <Progress value={lvl.fraction} />
        </Card>

        <div className="flex flex-col gap-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular">{i + 1}</span>
              <img
                src={`/flags/${r.iso.toLowerCase()}.svg`}
                alt=""
                className="h-6 w-9 shrink-0 rounded-[3px] object-cover ring-1 ring-border"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{countryName(r.iso)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.solved ? t("flags.solved") : t("flags.missed")}
                </p>
              </div>
              <Badge variant={r.solved ? "primary" : "muted"} className="tabular">
                {formatNumber(r.score)}
              </Badge>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={onPlayAgain}>
            <RotateCcw className="size-4" />
            {t("flags.playAgain")}
          </Button>
          <Button size="lg" variant="secondary" onClick={onNewGame}>
            <Settings2 className="size-4" />
            {t("flags.newGame")}
          </Button>
        </div>
        <Button variant="ghost" size="sm" asChild className="mx-auto">
          <Link href="/">
            <Home className="size-4" />
            {t("match.home")}
          </Link>
        </Button>

        {features.auth && <FlagLeaderboard region={regionId} mode={mode} />}
      </div>
    </div>
  );
}

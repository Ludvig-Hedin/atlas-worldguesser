"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Home, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { MatchMap } from "./match-map";
import { AnimatedNumber } from "./animated-number";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENT_MAP } from "@/lib/achievements";
import { countryName, flagEmoji } from "@/lib/countries-meta";
import { formatDistance, formatNumber } from "@/lib/format";
import { getMapConfig } from "@/lib/maps-config";
import { maxMatchScore } from "@/lib/scoring";
import { MAX_ROUND_SCORE } from "@/lib/types";
import { levelProgress } from "@/lib/xp";
import type { ApplyResult } from "@/lib/local-profile";
import type { SoloGame } from "@/hooks/use-solo-game";

interface MatchResultsProps {
  game: SoloGame;
  applied: ApplyResult;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function MatchResults({ game, applied, onPlayAgain, onNewGame }: MatchResultsProps) {
  const map = getMapConfig(game.mapId);
  const max = maxMatchScore(game.settings.rounds);
  const pct = Math.round((applied.totalScore / max) * 100);
  const level = levelProgress(applied.profile.stats.xp);

  return (
    <div className="min-h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <Badge variant={applied.won ? "primary" : "muted"}>
            {applied.won ? "Great run" : "Match complete"} · {map.emoji} {map.name}
          </Badge>
          <div className="flex items-end justify-center gap-2">
            <AnimatedNumber
              value={applied.totalScore}
              format={formatNumber}
              durationMs={1100}
              className="text-5xl font-bold tabular tracking-tight sm:text-6xl"
            />
            <span className="pb-1.5 text-lg font-medium text-muted-foreground">/ {formatNumber(max)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {pct}% · +{formatNumber(applied.xpGained)} XP
          </p>
        </motion.div>

        {applied.newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {applied.newAchievements.map((id) => {
              const a = ACHIEVEMENT_MAP[id];
              if (!a) return null;
              return (
                <Badge key={id} variant="gold" className="gap-1.5 py-1">
                  <Sparkles className="size-3" />
                  {a.icon} {a.name}
                </Badge>
              );
            })}
          </motion.div>
        )}

        <div className="h-56 overflow-hidden rounded-2xl border border-border sm:h-72">
          <MatchMap results={game.results} initialView={map.view} />
        </div>

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {game.results.map((r) => (
            <div key={r.round} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/6 text-xs font-semibold tabular text-muted-foreground">
                {r.round}
              </span>
              <span className="text-xl" aria-hidden>
                {flagEmoji(r.actual.countryCode)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{countryName(r.actual.countryCode)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.guess ? formatDistance(r.distanceMeters) : "No guess"}
                </p>
              </div>
              <div className="w-24 shrink-0">
                <Progress value={r.score / MAX_ROUND_SCORE} className="h-1" />
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-semibold tabular text-primary-muted">
                {formatNumber(r.score)}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Level {level.level}</span>
            <span className="text-muted-foreground tabular">
              {formatNumber(level.into)} / {formatNumber(level.span)} XP
            </span>
          </div>
          <Progress value={level.fraction} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={onPlayAgain}>
            <RotateCcw className="size-4" />
            Play again
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={onNewGame}>
            <Settings2 className="size-4" />
            New game
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/">
              <Home className="size-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

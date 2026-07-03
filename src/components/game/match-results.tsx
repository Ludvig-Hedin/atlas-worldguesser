"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { Home, RotateCcw, Settings2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { MatchMap } from "./match-map";
import { AchievementIcon } from "@/components/achievement-icon";
import { AnimatedNumber } from "./animated-number";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENT_MAP } from "@/lib/achievements";
import { BUILDINGS } from "@/lib/buildings";
import { MapGlyph, CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";
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
  const t = useT();
  const map = getMapConfig(game.mapId);
  const isSurvival = game.mode === "survival";
  // Survival plays a variable number of rounds; base the "max" on rounds
  // actually played, not the classic settings.rounds.
  const survived = game.results.filter((r) => r.countryCorrect).length;
  const max = maxMatchScore(isSurvival ? game.results.length : game.settings.rounds);
  const pct = max > 0 ? Math.round((applied.totalScore / max) * 100) : 0;
  const level = levelProgress(applied.profile.stats.xp);

  return (
    <div className="min-h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <Badge variant={isSurvival ? "gold" : applied.won ? "primary" : "muted"} className="gap-1.5">
            <MapGlyph mapId={game.mapId} className="size-3" />
            {isSurvival
              ? t("match.survivalBadge", { count: survived })
              : `${applied.won ? t("match.greatRun") : t("match.matchComplete")} · ${map.name}`}
          </Badge>
          <div className="flex items-end justify-center gap-2">
            <AnimatedNumber
              value={applied.totalScore}
              format={formatNumber}
              durationMs={1100}
              className="text-5xl font-semibold tabular tracking-tight sm:text-6xl"
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
                  <AchievementIcon name={a.icon} className="size-3" />
                  {a.name}
                </Badge>
              );
            })}
          </motion.div>
        )}

        {applied.newBuildings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {applied.newBuildings.map((id) => {
              const b = BUILDINGS[id];
              if (!b) return null;
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-1"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay">
                    <img src={b.image} alt="" className="size-full object-contain p-0.5" />
                  </span>
                  <span className="text-xs font-medium">{t("match.newBuilding", { name: b.name })}</span>
                  {features.auth && <BuildingClaimAction buildingId={id} />}
                </div>
              );
            })}
          </motion.div>
        )}

        <div className="h-56 overflow-hidden rounded-2xl border border-border sm:h-72">
          <MatchMap results={game.results} initialView={map.view} />
        </div>

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-1">
          {game.results.map((r) => (
            <div key={r.round} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-overlay text-xs font-semibold tabular text-muted-foreground">
                {r.round}
              </span>
              <CountryGlyph className="size-4" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{countryName(r.actual.countryCode)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.guess ? formatDistance(r.distanceMeters) : t("mp.noGuess")}
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

        <div className="rounded-2xl border border-border bg-card p-4 shadow-1">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{t("match.level", { level: level.level })}</span>
            <span className="text-muted-foreground tabular">
              {formatNumber(level.into)} / {formatNumber(level.span)} XP
            </span>
          </div>
          <Progress value={level.fraction} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={onPlayAgain}>
            <RotateCcw className="size-4" />
            {t("match.playAgain")}
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={onNewGame}>
            <Settings2 className="size-4" />
            {t("match.newGame")}
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/">
              <Home className="size-4" />
              {t("match.home")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Quick action on a newly-unlocked building badge. Only ever mounted when
 * `features.auth` is true (see the `{features.auth && ...}` guard above) —
 * that's the only provider-tree branch where Convex/Clerk context actually
 * exists, so it's safe to call these hooks unconditionally here.
 */
function BuildingClaimAction({ buildingId }: { buildingId: string }) {
  const t = useT();
  const { isAuthenticated } = useConvexAuth();
  const setAvatar = useMutation(api.users.setAvatar);

  if (isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => void setAvatar({ buildingId })}
        className="text-xs font-medium text-primary-muted underline-offset-2 hover:underline"
      >
        {t("match.setAsAvatar")}
      </button>
    );
  }
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="text-xs font-medium text-primary-muted underline-offset-2 hover:underline"
      >
        {t("match.signInToClaim")}
      </button>
    </SignInButton>
  );
}

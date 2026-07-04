"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { Check, Home, RotateCcw, Settings2, Swords } from "lucide-react";
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
import { getMapConfig, mapNameKey } from "@/lib/maps-config";
import { maxMatchScore } from "@/lib/scoring";
import { MAX_ROUND_SCORE } from "@/lib/types";
import { levelProgress } from "@/lib/xp";
import type { ApplyResult } from "@/lib/local-profile";
import type { SoloGame } from "@/hooks/use-solo-game";
import type { GameSettings } from "@/lib/types";

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
  const mapStreak = applied.profile.streaks.countryByMap[game.mapId] ?? { current: 0, best: 0 };

  // One-time level-up celebration. Driven by the locally-computed `applied`
  // fold (local-profile.applyGame), so it fires instantly and identically for
  // guests and signed-in users — no server round-trip. The ref guard keeps it
  // to exactly once per mount (React strict-mode double-invokes effects in dev).
  // Follow-up (out of scope): a level-based achievement would need `level`
  // threaded into AchievementContext, which doesn't yet expose xp in a
  // level-friendly form.
  const celebrated = useRef(false);
  useEffect(() => {
    if (applied.leveledUp && !celebrated.current) {
      celebrated.current = true;
      toast.success(t("match.levelUp", { level: level.level }));
    }
  }, [applied.leveledUp, level.level, t]);

  // One-time "streak saved" notice when a banked freeze auto-bridged a skipped
  // day. Same locally-computed `applied` fold + ref-guard pattern as the level-up
  // toast above, so it surfaces the otherwise-silent auto-apply identically for
  // guests and signed-in users. `freezesAvailable` is the post-fold remaining count.
  const freezeNoticed = useRef(false);
  useEffect(() => {
    if (applied.streakFreezeUsed && !freezeNoticed.current) {
      freezeNoticed.current = true;
      toast.success(
        t("match.streakFrozen", { count: applied.profile.streaks.freezesAvailable ?? 0 }),
      );
    }
  }, [applied.streakFreezeUsed, applied.profile.streaks.freezesAvailable, t]);

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
              : `${applied.won ? t("match.greatRun") : t("match.matchComplete")} · ${t(mapNameKey(map.id))}`}
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

        {isSurvival && features.auth && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center"
          >
            <ChallengeShareAction
              mapId={game.mapId}
              settings={game.settings}
              streak={survived}
              score={applied.totalScore}
            />
          </motion.div>
        )}

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
            className={`grid gap-3 ${applied.newBuildings.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {applied.newBuildings.map((id) => {
              const b = BUILDINGS[id];
              if (!b) return null;
              return (
                <div
                  key={id}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-1"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay">
                    <img src={b.image} alt="" className="size-full object-contain p-2" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("match.newBuildingLabel")}
                    </p>
                    <p className="text-sm font-semibold">{b.name}</p>
                  </div>
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
          <p className="mb-3 text-sm font-medium">
            {t("match.countryStreak", { map: t(mapNameKey(map.id)) })}
          </p>
          <div className="flex gap-6">
            <div>
              <p className="text-xl font-semibold tabular">{formatNumber(mapStreak.current)}</p>
              <p className="text-xs text-muted-foreground">{t("match.countryStreakCurrent")}</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular">{formatNumber(mapStreak.best)}</p>
              <p className="text-xs text-muted-foreground">{t("match.countryStreakBest")}</p>
            </div>
          </div>
        </div>

        <motion.div
          className="rounded-2xl border border-border bg-card p-4 shadow-1"
          animate={applied.leveledUp ? { scale: [1, 1.03, 1] } : undefined}
          transition={{ duration: 0.6, delay: 0.35, times: [0, 0.45, 1] }}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{t("match.level", { level: level.level })}</span>
            <span className="text-muted-foreground tabular">
              {formatNumber(level.into)} / {formatNumber(level.span)} XP
            </span>
          </div>
          <Progress value={level.fraction} />
        </motion.div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={onPlayAgain}>
            <RotateCcw className="size-4" />
            {t("match.playAgain")}
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={onNewGame}>
            <Settings2 className="size-4" />
            {t("match.newGame")}
          </Button>
          <Button size="lg" variant="ghost" className="flex-1" asChild>
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
 * Mint an async streak-challenge link for a just-finished Survival run and
 * copy it to the clipboard. Only ever mounted when `features.auth` is true
 * (see the `{isSurvival && features.auth && ...}` guard above) — same
 * Convex/Clerk-context precondition as BuildingClaimAction below.
 */
function ChallengeShareAction({
  mapId,
  settings,
  streak,
  score,
}: {
  mapId: string;
  settings: GameSettings;
  streak: number;
  score: number;
}) {
  const t = useT();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const create = useMutation(api.challenges.create);
  const [copied, setCopied] = useState(false);

  // Convex auth resolves the Clerk JWT asynchronously; isAuthenticated is
  // false during that window even for a signed-in user. Render nothing
  // until it settles instead of flashing the sign-in CTA.
  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <SignInButton mode="modal">
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Swords className="size-3.5" />
          {t("match.challengeSignIn")}
        </Button>
      </SignInButton>
    );
  }

  const handleClick = async () => {
    try {
      const challengeId = await create({
        mapId,
        settings,
        creatorStreak: streak,
        creatorScore: score,
      });
      await navigator.clipboard
        .writeText(`${window.location.origin}/challenge/${challengeId}`)
        .catch(() => {});
      setCopied(true);
      toast.success(t("match.challengeCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("match.challengeErrorFallback"));
    }
  };

  return (
    <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void handleClick()}>
      {copied ? <Check className="size-3.5" /> : <Swords className="size-3.5" />}
      {t("match.challengeFriend")}
    </Button>
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
  const { isAuthenticated, isLoading } = useConvexAuth();
  const setAvatar = useMutation(api.users.setAvatar);

  // Same isLoading gate as ChallengeShareAction above — avoids showing
  // "sign in to claim" to an already-authenticated user while the Clerk
  // JWT is still resolving.
  if (isLoading) return null;

  if (isAuthenticated) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => void setAvatar({ buildingId })}
      >
        {t("match.setAsAvatar")}
      </Button>
    );
  }
  return (
    <SignInButton mode="modal">
      <Button type="button" variant="secondary" size="sm" className="w-full">
        {t("match.signInToClaim")}
      </Button>
    </SignInButton>
  );
}

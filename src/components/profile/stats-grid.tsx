import { Award, Flame, Gamepad2, Globe2, Medal, Ruler, Target, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistance, formatNumber, formatPercent } from "@/lib/format";
import { levelProgress } from "@/lib/xp";
import { tierForRating, type RatingTier } from "@/lib/rating";
import { useT } from "@/hooks/use-t";
import type { PlayerStats } from "@/lib/types";

interface StatsGridProps {
  stats: Omit<PlayerStats, "xp">;
  xp: number;
  dailyStreak?: number;
  /** Ranked rating (ELO-lite). Omit for local guest profiles that never play rated. */
  rating?: number;
  /** Rated games played — 0 means "in placement / unranked". */
  ratingGamesPlayed?: number;
  /** Best country-correct streak across every map. */
  bestCountryStreak?: number;
}

/** Subtle per-tier accent for the medal icon. Restrained, mostly monochrome. */
const TIER_ACCENT: Record<RatingTier["key"], string> = {
  bronze: "text-amber-600",
  silver: "text-slate-400",
  gold: "text-gold",
  platinum: "text-sky-300",
  diamond: "text-cyan-400",
};

export function StatsGrid({ stats, xp, dailyStreak, rating, ratingGamesPlayed, bestCountryStreak }: StatsGridProps) {
  const t = useT();
  const level = levelProgress(xp);
  const avgDistance = stats.roundsPlayed > 0 ? stats.totalDistanceMeters / stats.roundsPlayed : 0;
  const showRating = rating != null;
  const ranked = showRating && (ratingGamesPlayed ?? 0) > 0;
  const tier = showRating ? tierForRating(rating) : null;

  const cards = [
    { icon: Gamepad2, label: "Games", value: formatNumber(stats.gamesPlayed) },
    {
      icon: Trophy,
      label: "Wins",
      value: formatNumber(stats.wins),
      sub: formatPercent(stats.wins, stats.gamesPlayed),
    },
    { icon: Target, label: "Best score", value: formatNumber(stats.bestScore) },
    { icon: Ruler, label: "Avg distance", value: stats.roundsPlayed ? formatDistance(avgDistance) : "—" },
    {
      icon: Globe2,
      label: "Country accuracy",
      value: formatPercent(stats.countryCorrect, stats.countryTotal),
    },
    { icon: Flame, label: "Daily streak", value: dailyStreak != null ? `${dailyStreak}d` : "—" },
    ...(bestCountryStreak != null
      ? [{ icon: Award, label: "Best country streak", value: formatNumber(bestCountryStreak) }]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className="col-span-2 rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium">Level {level.level}</span>
          <span className="text-xs text-muted-foreground tabular">
            {formatNumber(xp)} XP · {formatNumber(level.xpToNext)} to next
          </span>
        </div>
        <Progress value={level.fraction} />
      </div>

      {showRating && tier && (
        <div className="flex flex-col justify-center rounded-2xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <Medal className={`size-4 ${ranked ? TIER_ACCENT[tier.key] : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">
              {ranked ? tier.label : t("rating.unranked")}
            </span>
          </div>
          <p className="text-xl font-semibold tabular">{ranked ? formatNumber(rating) : "—"}</p>
          <p className="text-xs text-muted-foreground">
            {ranked ? t("rating.title") : t("rating.placement")}
          </p>
        </div>
      )}

      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
          <c.icon className="size-4 text-muted-foreground" />
          <p className="mt-2 text-xl font-semibold tabular">{c.value}</p>
          <p className="text-xs text-muted-foreground">
            {c.label}
            {c.sub ? ` · ${c.sub}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

import { Flame, Gamepad2, Globe2, Ruler, Target, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistance, formatNumber, formatPercent } from "@/lib/format";
import { levelProgress } from "@/lib/xp";
import type { PlayerStats } from "@/lib/types";

interface StatsGridProps {
  stats: Omit<PlayerStats, "xp">;
  xp: number;
  dailyStreak?: number;
}

export function StatsGrid({ stats, xp, dailyStreak }: StatsGridProps) {
  const level = levelProgress(xp);
  const avgDistance = stats.roundsPlayed > 0 ? stats.totalDistanceMeters / stats.roundsPlayed : 0;

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
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium">Level {level.level}</span>
          <span className="text-xs text-muted-foreground tabular">
            {formatNumber(xp)} XP · {formatNumber(level.xpToNext)} to next
          </span>
        </div>
        <Progress value={level.fraction} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
    </div>
  );
}

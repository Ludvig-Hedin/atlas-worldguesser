"use client";

import { useQuery } from "convex/react";
import { Crown } from "lucide-react";
import { api } from "@convex/_generated/api";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FlagGameMode, FlagRegionId } from "@/lib/flags/regions";

/** Region+mode best-score board. Rendered only where Convex is configured. */
export function FlagLeaderboard({ region, mode }: { region: FlagRegionId; mode: FlagGameMode }) {
  const t = useT();
  const board = useQuery(api.flags.leaderboard, { region, mode });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-muted-foreground">{t("flags.leaderboardTitle")}</span>
        {board?.mine && (
          <span className="text-xs text-muted-foreground tabular">
            {board.mine.rank > 0
              ? t("flags.youScoreRank", {
                  score: formatNumber(board.mine.bestScore),
                  rank: board.mine.rank,
                })
              : t("flags.youScore", { score: formatNumber(board.mine.bestScore) })}
          </span>
        )}
      </div>

      {board === undefined ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : board.entries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {t("flags.noScoresYet")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {board.entries.map((e) => (
            <div key={e.userId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span
                className={cn(
                  "w-7 text-center text-sm font-semibold tabular",
                  e.rank <= 3 ? "text-gold" : "text-muted-foreground",
                )}
              >
                {e.rank}
              </span>
              <IdentityAvatar
                name={e.username}
                src={e.avatarUrl}
                buildingId={e.avatarBuildingId}
                color={e.avatarColor}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium" title={e.username}>
                    {e.username}
                  </span>
                  {e.rank === 1 && <Crown className="size-3.5 text-gold" />}
                </div>
                <p className="text-xs text-muted-foreground tabular">
                  {t("flags.correctOf", { count: e.correctCount, total: e.flagCount })}
                </p>
              </div>
              <Badge variant="muted" className="tabular">
                {formatNumber(e.bestScore)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Crown } from "lucide-react";
import { api } from "@convex/_generated/api";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function LeaderboardClient() {
  const rows = useQuery(api.leaderboard.top, { limit: 50 });
  const me = useQuery(api.users.getMe);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Top explorers by XP</p>
      </div>

      {rows === undefined ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No ranked players yet. Be the first.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const isMe = me?._id === r._id;
            return (
              <Link
                key={r._id}
                href={`/profile/${r.username}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-white/[0.03]",
                  isMe ? "border-primary/40 bg-primary/10" : "border-border bg-card",
                )}
              >
                <span
                  className={cn(
                    "w-7 text-center text-sm font-semibold tabular",
                    r.rank <= 3 ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {r.rank}
                </span>
                <IdentityAvatar name={r.username} src={r.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{r.username}</span>
                    {r.rank === 1 && <Crown className="size-3.5 text-gold" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Level {r.level} · {formatNumber(r.gamesPlayed)} games
                  </p>
                </div>
                <Badge variant="muted" className="tabular">{formatNumber(r.xp)} XP</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

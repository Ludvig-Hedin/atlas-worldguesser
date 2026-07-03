"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Crown } from "lucide-react";
import { api } from "@convex/_generated/api";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/use-t";

type Scope = "global" | "friends";

interface RowData {
  rank: number;
  username: string;
  avatarUrl?: string;
  xp: number;
  level: number;
  gamesPlayed: number;
}

function LeaderRow({ r, isMe }: { r: RowData; isMe: boolean }) {
  const t = useT();
  return (
    <Link
      href={`/profile/${r.username}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-elevated",
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
          <span className="truncate font-medium" title={r.username}>{r.username}</span>
          {r.rank === 1 && <Crown className="size-3.5 text-gold" />}
          {isMe && <span className="text-[11px] font-medium text-primary-muted">{t("leaderboard.you")}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("leaderboard.levelGames", { level: r.level, games: formatNumber(r.gamesPlayed) })}
        </p>
      </div>
      <Badge variant="muted" className="tabular">{formatNumber(r.xp)} XP</Badge>
    </Link>
  );
}

export function LeaderboardClient() {
  const t = useT();
  const [scope, setScope] = useState<Scope>("global");
  const globalRows = useQuery(api.leaderboard.top, { limit: 50 });
  const friendRows = useQuery(api.leaderboard.friends, scope === "friends" ? {} : "skip");
  const myRank = useQuery(api.leaderboard.myRank);

  const rows = scope === "global" ? globalRows : friendRows;
  const loading = rows === undefined;
  const signedIn = myRank !== null && myRank !== undefined;

  // Pin the signed-in player's global row when they're outside the visible top list.
  const showPin =
    scope === "global" &&
    !!myRank &&
    Array.isArray(globalRows) &&
    !globalRows.some((r) => r._id === myRank._id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("leaderboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("leaderboard.rankedByXp")}</p>
      </div>

      <Segmented
        options={[
          { value: "global", label: t("leaderboard.global") },
          { value: "friends", label: t("leaderboard.friends") },
        ]}
        value={scope}
        onChange={setScope}
        size="sm"
        ariaLabel={t("leaderboard.scopeAria")}
      />

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {scope === "friends"
            ? signedIn
              ? t("leaderboard.noFriendsRanked")
              : t("leaderboard.friendsSignedOut")
            : t("leaderboard.noPlayersRanked")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <LeaderRow key={r._id} r={r} isMe={!!myRank && myRank._id === r._id} />
          ))}
        </div>
      )}

      {showPin && myRank && (
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
            {t("leaderboard.yourRank")}
          </span>
          <LeaderRow r={myRank} isMe />
        </div>
      )}
    </div>
  );
}

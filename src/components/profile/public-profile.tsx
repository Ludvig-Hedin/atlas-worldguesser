"use client";

import { useQuery } from "convex/react";
import { Globe2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import { StatsGrid } from "./stats-grid";
import { AchievementGrid } from "./achievement-grid";
import { RecentGames, type RecentItem } from "./recent-games";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/format";

export function PublicProfile({ username }: { username: string }) {
  const data = useQuery(api.users.profileByUsername, { username });

  if (data === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Skeleton className="mb-6 h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Globe2 className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Player not found</h1>
        <p className="text-sm text-muted-foreground">No one plays under &ldquo;{username}&rdquo;.</p>
      </div>
    );
  }

  const { profile, achievements, recent } = data;
  const recentItems: RecentItem[] = recent.map((g) => ({
    key: g._id,
    mapId: g.mapId,
    mode: g.mode,
    totalScore: g.totalScore,
    maxScore: g.maxScore,
    won: g.won,
    at: g.createdAt,
    replayId: g._id,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center gap-4">
        <IdentityAvatar name={profile.username} src={profile.avatarUrl} className="size-16 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.username}</h1>
          <p className="text-sm text-muted-foreground">Level {profile.level} · joined {timeAgo(profile.createdAt)}</p>
        </div>
      </header>

      <StatsGrid stats={profile.stats} xp={profile.xp} dailyStreak={profile.streaks.daily} />
      <AchievementGrid
        owned={achievements.map((a) => a.id)}
        stats={profile.stats}
        streaks={profile.streaks}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent games</h2>
        <RecentGames games={recentItems} />
      </section>
    </div>
  );
}

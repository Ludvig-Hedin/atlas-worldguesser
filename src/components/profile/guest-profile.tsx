"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { StatsGrid } from "./stats-grid";
import { AchievementGrid } from "./achievement-grid";
import { RecentGames, type RecentItem } from "./recent-games";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function GuestProfile() {
  const { profile, ready, setUsername } = useLocalProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const recent: RecentItem[] = profile.recent.map((g) => ({
    key: g.id,
    mapId: g.mapId,
    mode: "solo",
    totalScore: g.totalScore,
    maxScore: g.rounds * 5000,
    won: g.won,
    at: g.playedAt,
  }));

  const saveName = () => {
    const name = draft.trim();
    if (name) setUsername(name);
    setEditing(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center gap-4">
        <IdentityAvatar name={profile.username} className="size-16 text-lg" />
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                maxLength={20}
                className="h-9 rounded-lg border border-border bg-input px-3 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="icon-sm" onClick={saveName} aria-label="Save name">
                <Check className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.username}</h1>
              <button
                type="button"
                onClick={() => {
                  setDraft(profile.username);
                  setEditing(true);
                }}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Edit name"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Stats saved on this device</p>
        </div>
      </header>

      <StatsGrid stats={profile.stats} xp={profile.stats.xp} dailyStreak={profile.streaks.daily} />
      <AchievementGrid
        owned={profile.achievements}
        stats={profile.stats}
        streaks={profile.streaks}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent games</h2>
        <RecentGames games={recent} />
      </section>
    </div>
  );
}

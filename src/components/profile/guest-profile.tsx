"use client";

import { useState, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check, Pencil } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { StatsGrid } from "./stats-grid";
import { AchievementGrid } from "./achievement-grid";
import { AvatarPicker } from "./avatar-picker";
import { RecentGames, type RecentItem } from "./recent-games";
import { IdentityAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReplayView } from "@/components/replay/replay-view";
import { bestCountryStreakOf } from "@/lib/progression";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";
import { BUILDING_LIST } from "@/lib/buildings";
import { countryName } from "@/lib/countries-meta";

/** Cloud-backed self-view for a signed-in user, mirroring the guest layout below. */
function CloudProfile() {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const setUsername = useMutation(api.users.setUsername);

  const me = useQuery(api.users.getMe, {});
  const cloud = useQuery(
    api.users.profileByUsername,
    me?.username ? { username: me.username } : "skip",
  );

  if (me === undefined || (me && cloud === undefined)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!me || !cloud) return null; // provisioning still in flight (ensure-user)

  const { profile, achievements, recent } = cloud;
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

  const saveName = () => {
    const name = draft.trim();
    if (name) void setUsername({ username: name });
    setEditing(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center gap-4">
        <IdentityAvatar
          name={profile.username}
          src={profile.avatarUrl}
          buildingId={profile.avatarBuildingId}
          color={profile.avatarColor}
          className="size-16 text-lg"
        />
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
              <Button size="icon-sm" onClick={saveName} aria-label={t("profile.saveName")}>
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
                aria-label={t("profile.editName")}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <StatsGrid
        stats={profile.stats}
        xp={profile.xp}
        dailyStreak={profile.streaks.daily}
        rating={profile.rating}
        ratingGamesPlayed={profile.ratingGamesPlayed}
        bestCountryStreak={bestCountryStreakOf(profile.streaks.countryByMap)}
      />
      <AvatarPicker
        avatarBuildingId={profile.avatarBuildingId}
        avatarColor={profile.avatarColor}
        unlockedBuildings={profile.unlockedBuildings}
      />
      <AchievementGrid
        owned={achievements.map((a) => a.id)}
        stats={profile.stats}
        streaks={profile.streaks}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("profile.recentGames")}</h2>
        <RecentGames games={recentItems} />
      </section>
    </div>
  );
}

/**
 * `useConvexAuth()` throws if no Convex/Clerk provider is mounted, which is
 * the case in a fully key-less deployment (solo play still works with zero
 * config — see AppProviders). Only ever mount this where `features.auth` is
 * true, so the hook call itself stays unconditional-but-safe.
 */
function AuthGate({ children }: { children: (isAuthenticated: boolean) => ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  return <>{children(isAuthenticated)}</>;
}

export function GuestProfile() {
  if (features.auth) {
    return <AuthGate>{(isAuthenticated) => (isAuthenticated ? <CloudProfile /> : <LocalProfileView />)}</AuthGate>;
  }
  return <LocalProfileView />;
}

function LocalProfileView() {
  const { profile, ready, setUsername } = useLocalProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [openReplayId, setOpenReplayId] = useState<string | null>(null);
  const t = useT();

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
    // Only the most recent MAX_LOCAL_REPLAYS games have full round-by-round
    // data (see local-profile.ts) — older summaries stay non-clickable,
    // exactly like today's guest behavior.
    onOpenReplay: profile.localReplays[g.id] ? () => setOpenReplayId(g.id) : undefined,
  }));
  const openReplay = openReplayId ? profile.localReplays[openReplayId] : undefined;
  const openReplayMapId = openReplayId ? profile.recent.find((g) => g.id === openReplayId)?.mapId : undefined;

  const saveName = () => {
    const name = draft.trim();
    if (name) setUsername(name);
    setEditing(false);
  };

  const unlockedSet = new Set(profile.unlockedBuildings);

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
              <Button size="icon-sm" onClick={saveName} aria-label={t("profile.saveName")}>
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
                aria-label={t("profile.editName")}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t("profile.statsOnDevice")}</p>
        </div>
      </header>

      <StatsGrid
        stats={profile.stats}
        xp={profile.stats.xp}
        dailyStreak={profile.streaks.daily}
        bestCountryStreak={bestCountryStreakOf(profile.streaks.countryByMap)}
      />

      {profile.unlockedBuildings.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("profile.avatarTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("profile.avatarGuestHint")}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {BUILDING_LIST.filter((b) => unlockedSet.has(b.id)).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay">
                  <img src={b.image} alt="" className="size-full object-contain p-1" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{countryName(b.id)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AchievementGrid
        owned={profile.achievements}
        stats={profile.stats}
        streaks={profile.streaks}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("profile.recentGames")}</h2>
        <RecentGames games={recent} />
      </section>

      <Dialog open={!!openReplayId} onOpenChange={(open) => !open && setOpenReplayId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {openReplay && openReplayMapId && <ReplayView mapId={openReplayMapId} results={openReplay} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

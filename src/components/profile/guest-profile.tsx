"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Loader2, Pencil } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { StatsGrid } from "./stats-grid";
import { AchievementGrid } from "./achievement-grid";
import { AvatarPicker } from "./avatar-picker";
import { UnlockedBuildingsGrid } from "./unlocked-buildings-grid";
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

/** Grid caps to this many tiles before showing a "view all" link — fits within 3-4 rows at both grid-cols-2 (mobile) and sm:grid-cols-3 breakpoints. */
const AVATAR_PREVIEW_LIMIT = 8;

/** Cloud-backed self-view for a signed-in user, mirroring the guest layout below. */
function CloudProfile() {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
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

  const saveName = async () => {
    const name = draft.trim();
    if (!name) {
      setEditing(false);
      return;
    }
    setSavingName(true);
    try {
      await setUsername({ username: name });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.couldNotSaveName"));
    } finally {
      setSavingName(false);
    }
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
                disabled={savingName}
                className="h-9 rounded-lg border border-border bg-input px-3 text-lg font-semibold outline-none transition-colors hover:border-border-strong focus-visible:border-ring disabled:opacity-60"
              />
              <Button
                size="icon-sm"
                onClick={saveName}
                disabled={savingName}
                aria-label={t("profile.saveName")}
              >
                {savingName ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
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
        limit={AVATAR_PREVIEW_LIMIT}
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
  // TODO(bug-hunt): no isLoading check — while Convex is still resolving the
  // Clerk JWT, isAuthenticated reads false, so GuestProfile briefly renders
  // <LocalProfileView /> (wrong stats/data) for an actually-signed-in user
  // before flipping to <CloudProfile />. Fix: render a loading skeleton while
  // isLoading instead of choosing a real view.
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
  const unlockedBuildingDefs = BUILDING_LIST.filter((b) => unlockedSet.has(b.id));

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
                className="h-9 rounded-lg border border-border bg-input px-3 text-lg font-semibold outline-none transition-colors hover:border-border-strong focus-visible:border-ring"
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

      {unlockedBuildingDefs.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("profile.avatarTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("profile.avatarGuestHint")}</p>
          <UnlockedBuildingsGrid buildings={unlockedBuildingDefs.slice(0, AVATAR_PREVIEW_LIMIT)} />
          {unlockedBuildingDefs.length > AVATAR_PREVIEW_LIMIT && (
            <Button variant="outline" size="sm" asChild className="self-start">
              <Link href="/profile/avatars">{t("profile.viewAllAvatars")}</Link>
            </Button>
          )}
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

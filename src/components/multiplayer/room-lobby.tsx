"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, LogOut, Play, UserPlus } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { Scoreboard } from "./scoreboard";
import { TeamScoreboard } from "./team-scoreboard";
import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { RulesSelect } from "@/components/game/rules-select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IdentityAvatar } from "@/components/ui/avatar";
import { MapGlyph } from "@/components/map-glyph";
import { useGuestId } from "@/components/guest/guest-session-provider";
import { useT } from "@/hooks/use-t";
import { OFFICIAL_MAPS, ROUND_OPTIONS, TIME_OPTIONS, getMapConfig, mapNameKey, movementLabelKey } from "@/lib/maps-config";
import type { Movement } from "@/lib/types";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TIME_LABEL_KEYS: Record<number, TKey> = {
  0: "setup.timeNone",
  30: "setup.time30",
  60: "setup.time60",
  120: "setup.time120",
};

export function RoomLobby({ room }: { room: RoomState }) {
  const t = useT();
  const updateSettings = useMutation(api.rooms.updateSettings);
  const setReady = useMutation(api.rooms.setReady);
  const setTeamMode = useMutation(api.rooms.setTeamMode);
  const setTeam = useMutation(api.rooms.setTeam);
  const setElimination = useMutation(api.rooms.setElimination);
  const start = useMutation(api.rooms.start);
  const leave = useMutation(api.rooms.leave);
  const inviteFriend = useMutation(api.rooms.inviteFriend);
  const friendsData = useQuery(api.friends.list);
  // null for signed-in users (Clerk wins server-side); the guest's ephemeral id
  // otherwise. Threaded into every room mutation so guests can act in the lobby.
  const guestId = useGuestId();
  const [starting, setStarting] = useState(false);

  const me = room.standings.find((s) => s.userId === room.myUserId);
  const readyCount = room.standings.filter((s) => s.ready).length;

  const memberIds = new Set(room.standings.map((s) => s.userId));
  const onlineInvitableFriends = (friendsData?.friends ?? []).filter(
    (f) => f.online && !memberIds.has(f._id),
  );

  const invite = (friendId: RoomState["standings"][number]["userId"], name: string) =>
    inviteFriend({ roomCode: room.code, friendId })
      .then(() => toast.success(t("lobby.invitedToast", { name })))
      .catch((e) => toast.error(e instanceof Error ? e.message : t("lobby.couldNotInvite")));

  const teamMode = room.teamMode;
  const elimination = room.elimination;
  const myTeam = me?.team ?? null;
  const teamCounts = {
    A: room.standings.filter((s) => s.team === "A").length,
    B: room.standings.filter((s) => s.team === "B").length,
  };
  const bothTeamsFilled = teamCounts.A > 0 && teamCounts.B > 0;

  const patch = (mapId: string, settings: RoomState["settings"]) =>
    updateSettings({ roomId: room._id, mapId, settings, guestId: guestId ?? undefined }).catch((e) =>
      toast.error(e instanceof Error ? e.message : t("lobby.couldNotUpdate")),
    );

  const copyInvite = async () => {
    const url = `${window.location.origin}/room/${room.code}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success(t("lobby.inviteCopied"));
  };

  const doStart = async () => {
    setStarting(true);
    try {
      await start({ roomId: room._id, guestId: guestId ?? undefined });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("lobby.couldNotStart"));
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-5xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("lobby.roomCode")}</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tracking-[0.2em]">{room.code}</span>
              <Button size="icon-sm" variant="secondary" onClick={copyInvite} aria-label={t("lobby.copyInviteAria")}>
                <Copy className="size-3.5" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="icon-sm" variant="secondary" aria-label={t("lobby.inviteFriends")}>
                    <UserPlus className="size-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t("lobby.inviteFriends")}</DialogTitle>
                    <DialogDescription>{t("lobby.inviteFriendsDescription")}</DialogDescription>
                  </DialogHeader>
                  {onlineInvitableFriends.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("lobby.noOnlineFriends")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {onlineInvitableFriends.map((f) => (
                        <div key={f._id} className="flex items-center gap-2.5 rounded-xl bg-overlay px-2.5 py-2">
                          <IdentityAvatar
                            name={f.username}
                            src={f.avatarUrl}
                            buildingId={f.avatarBuildingId}
                            color={f.avatarColor}
                            className="size-7"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={f.username}>
                            {f.username}
                          </span>
                          <Button size="sm" variant="secondary" onClick={() => invite(f._id, f.username)}>
                            <UserPlus className="size-4" /> {t("lobby.invite")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => leave({ roomId: room._id, guestId: guestId ?? undefined }).catch(() => {})} asChild>
            <Link href="/">
              <LogOut className="size-4" />
              {t("mp.leave")}
            </Link>
          </Button>
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
          {room.amHost ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t("lobby.map")}</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {OFFICIAL_MAPS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => patch(m.id, room.settings)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border p-2.5 text-center transition-colors",
                        m.id === room.mapId ? "border-primary/50 bg-primary/10" : "border-border hover:bg-elevated",
                      )}
                    >
                      <MapGlyph mapId={m.id} className="size-5 text-primary-muted" />
                      <span className="text-xs font-medium">{t(mapNameKey(m.id))}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t("setup.rules")}</label>
                <RulesSelect
                  value={room.settings.movement}
                  onChange={(movement: Movement) => patch(room.mapId, { ...room.settings, movement })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("setup.rounds")}</label>
                  <Segmented
                    size="sm"
                    value={room.settings.rounds}
                    onChange={(rounds: number) => patch(room.mapId, { ...room.settings, rounds })}
                    options={ROUND_OPTIONS.map((r) => ({ value: r, label: String(r) }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">{t("lobby.timer")}</label>
                  <Segmented
                    size="sm"
                    value={room.settings.timeLimitSec}
                    onChange={(timeLimitSec: number) => patch(room.mapId, { ...room.settings, timeLimitSec })}
                    options={TIME_OPTIONS.map((opt) => ({ value: opt, label: t(TIME_LABEL_KEYS[opt]) }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t("team.format")}</label>
                <Segmented
                  size="sm"
                  value={teamMode ? "teams" : "ffa"}
                  onChange={(v: string) =>
                    setTeamMode({ roomId: room._id, teamMode: v === "teams", guestId: guestId ?? undefined }).catch((e) =>
                      toast.error(e instanceof Error ? e.message : t("team.couldNotChangeFormat")),
                    )
                  }
                  options={[
                    { value: "ffa", label: t("team.ffa") },
                    { value: "teams", label: t("team.teams") },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">{t("battle.label")}</label>
                <Segmented
                  size="sm"
                  value={elimination ? "on" : "off"}
                  onChange={(v: string) =>
                    setElimination({
                      roomId: room._id,
                      elimination: v === "on",
                      guestId: guestId ?? undefined,
                    }).catch((e) =>
                      toast.error(e instanceof Error ? e.message : t("battle.couldNotChangeFormat")),
                    )
                  }
                  options={[
                    { value: "off", label: t("battle.off") },
                    { value: "on", label: t("battle.on") },
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t("lobby.hostControlsNote")}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="muted" className="gap-1"><MapGlyph mapId={room.mapId} className="size-3" /> {t(mapNameKey(getMapConfig(room.mapId).id))}</Badge>
                <Badge variant="muted">{t(movementLabelKey(room.settings.movement))}</Badge>
                <Badge variant="muted">{t("lobby.roundsSuffix", { n: room.settings.rounds })}</Badge>
                <Badge variant="muted">
                  {t("lobby.timerSuffix", {
                    label: t(TIME_LABEL_KEYS[room.settings.timeLimitSec] ?? "setup.timeNone"),
                  })}
                </Badge>
                <Badge variant="muted">{teamMode ? t("team.teams") : t("team.ffa")}</Badge>
                {elimination && <Badge variant="muted">{t("battle.on")}</Badge>}
              </div>
            </div>
          )}
        </div>

        {teamMode && (
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-muted-foreground">{t("team.yourTeam")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() =>
                    setTeam({ roomId: room._id, team, guestId: guestId ?? undefined }).catch((e) =>
                      toast.error(e instanceof Error ? e.message : t("team.couldNotSwitch")),
                    )
                  }
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                    myTeam === team
                      ? "border-primary/50 bg-primary/10 text-primary-muted"
                      : "border-border hover:bg-elevated",
                  )}
                >
                  {team === "A" ? t("team.teamA") : t("team.teamB")}
                  <span className="text-xs text-muted-foreground">({teamCounts[team]})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={me?.ready ? "secondary" : "primary"}
                  size="lg"
                  className="flex-1"
                  onClick={() => setReady({ roomId: room._id, ready: !me?.ready, guestId: guestId ?? undefined }).catch(() => {})}
                >
                  <Check className="size-4" />
                  {me?.ready ? t("mp.ready") : t("lobby.imReady")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("lobby.readyTooltip")}</TooltipContent>
            </Tooltip>
            {room.amHost && (
              <Button
                size="lg"
                className="flex-1"
                onClick={doStart}
                disabled={starting || room.standings.length < 1 || (teamMode && !bothTeamsFilled)}
              >
                <Play className="size-4" />
                {t("lobby.startMatch")}
              </Button>
            )}
          </div>
          {room.amHost && teamMode && !bothTeamsFilled && (
            <p className="text-xs text-muted-foreground">{t("team.bothTeamsNeeded")}</p>
          )}
          {!room.amHost && (
            <p className="text-xs text-muted-foreground">{t("lobby.waitingForHostToStart")}</p>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("lobby.players")}</h3>
            <span className="text-xs text-muted-foreground">
              {t("lobby.readyCount", { ready: readyCount, total: room.standings.length })}
            </span>
          </div>
          {teamMode ? (
            <TeamScoreboard
              standings={room.standings}
              myUserId={room.myUserId}
              phase="lobby"
              teamTotals={room.teamTotals}
            />
          ) : (
            <Scoreboard standings={room.standings} myUserId={room.myUserId} phase="lobby" />
          )}
        </div>
        <div className="flex h-72 flex-col rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">{t("lobby.chat")}</h3>
          <ChatPanel roomId={room._id} myUserId={room.myUserId} className="flex-1" />
        </div>
      </aside>
    </div>
  );
}

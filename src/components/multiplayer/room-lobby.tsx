"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, LogOut, Play } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { Scoreboard } from "./scoreboard";
import { ChatPanel } from "./chat-panel";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Badge } from "@/components/ui/badge";
import { OFFICIAL_MAPS, MOVEMENTS, ROUND_OPTIONS, TIME_OPTIONS, getMapConfig } from "@/lib/maps-config";
import type { Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIME_LABELS: Record<number, string> = { 0: "None", 30: "30s", 60: "1m", 120: "2m" };

export function RoomLobby({ room }: { room: RoomState }) {
  const updateSettings = useMutation(api.rooms.updateSettings);
  const setReady = useMutation(api.rooms.setReady);
  const start = useMutation(api.rooms.start);
  const leave = useMutation(api.rooms.leave);
  const [starting, setStarting] = useState(false);

  const me = room.standings.find((s) => s.userId === room.myUserId);
  const readyCount = room.standings.filter((s) => s.ready).length;
  const map = getMapConfig(room.mapId);

  const patch = (mapId: string, settings: RoomState["settings"]) =>
    updateSettings({ roomId: room._id, mapId, settings }).catch((e) => toast.error(e.message));

  const copyInvite = async () => {
    const url = `${window.location.origin}/room/${room.code}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Invite link copied");
  };

  const doStart = async () => {
    setStarting(true);
    try {
      await start({ roomId: room._id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[100dvh] w-full max-w-5xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room code</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tracking-[0.2em]">{room.code}</span>
              <Button size="icon-sm" variant="secondary" onClick={copyInvite} aria-label="Copy invite link">
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => leave({ roomId: room._id })} asChild>
            <Link href="/">
              <LogOut className="size-4" />
              Leave
            </Link>
          </Button>
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
          {room.amHost ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Map</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {OFFICIAL_MAPS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => patch(m.id, room.settings)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border p-2.5 text-center transition-colors",
                        m.id === room.mapId ? "border-primary/50 bg-primary/10" : "border-border hover:bg-white/[0.03]",
                      )}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-xs font-medium">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Movement</label>
                <Segmented
                  value={room.settings.movement}
                  onChange={(movement: Movement) => patch(room.mapId, { ...room.settings, movement })}
                  options={MOVEMENTS.map((m) => ({ value: m.id, label: m.label, hint: m.description }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Rounds</label>
                  <Segmented
                    size="sm"
                    value={room.settings.rounds}
                    onChange={(rounds: number) => patch(room.mapId, { ...room.settings, rounds })}
                    options={ROUND_OPTIONS.map((r) => ({ value: r, label: String(r) }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Timer</label>
                  <Segmented
                    size="sm"
                    value={room.settings.timeLimitSec}
                    onChange={(timeLimitSec: number) => patch(room.mapId, { ...room.settings, timeLimitSec })}
                    options={TIME_OPTIONS.map((t) => ({ value: t, label: TIME_LABELS[t] }))}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="muted">{map.emoji} {map.name}</Badge>
              <Badge variant="muted">{MOVEMENTS.find((m) => m.id === room.settings.movement)?.label}</Badge>
              <Badge variant="muted">{room.settings.rounds} rounds</Badge>
              <Badge variant="muted">{TIME_LABELS[room.settings.timeLimitSec] ?? "None"} timer</Badge>
              <span className="text-xs text-muted-foreground">Waiting for the host to start…</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={me?.ready ? "secondary" : "primary"}
            size="lg"
            className="flex-1"
            onClick={() => setReady({ roomId: room._id, ready: !me?.ready })}
          >
            <Check className="size-4" />
            {me?.ready ? "Ready ✓" : "I'm ready"}
          </Button>
          {room.amHost && (
            <Button size="lg" className="flex-1" onClick={doStart} disabled={starting || room.standings.length < 1}>
              <Play className="size-4" />
              Start match
            </Button>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Players</h3>
            <span className="text-xs text-muted-foreground">{readyCount}/{room.standings.length} ready</span>
          </div>
          <Scoreboard standings={room.standings} myUserId={room.myUserId} phase="lobby" />
        </div>
        <div className="flex h-72 flex-col rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Chat</h3>
          <ChatPanel roomId={room._id} myUserId={room.myUserId} className="flex-1" />
        </div>
      </aside>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Home, RotateCcw, Trophy } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { TeamScoreboard } from "./team-scoreboard";
import { IdentityAvatar } from "@/components/ui/avatar";
import { MapGlyph } from "@/components/map-glyph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { getMapConfig, mapNameKey } from "@/lib/maps-config";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";

export function RoomResults({ room }: { room: RoomState }) {
  const t = useT();
  const rematch = useMutation(api.rooms.rematch);
  const leave = useMutation(api.rooms.leave);
  const [busy, setBusy] = useState(false);
  const map = getMapConfig(room.mapId);
  const winner = room.standings[0];
  const teamMode = room.teamMode;
  const teamWinner: "A" | "B" | null = teamMode
    ? room.teamTotals.A === room.teamTotals.B
      ? null
      : room.teamTotals.A > room.teamTotals.B
        ? "A"
        : "B"
    : null;
  const competitive = teamMode
    ? teamWinner !== null && room.teamTotals.A + room.teamTotals.B > 0
    : room.standings.length > 1 && (winner?.totalScore ?? 0) > 0;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <Badge variant="muted" className="gap-1.5">
          <MapGlyph mapId={room.mapId} className="size-3" /> {t(mapNameKey(map.id))} · {t("mp.finalResults")}
        </Badge>
        {teamMode ? (
          competitive && teamWinner ? (
            <>
              <Trophy className="mt-2 size-8 text-gold" />
              <h1 className="text-2xl font-semibold">{t("team.wins", { team: teamWinner })}</h1>
              <p className="text-sm text-muted-foreground">
                {t("team.pointsVs", {
                  a: formatNumber(room.teamTotals[teamWinner]),
                  b: formatNumber(room.teamTotals[teamWinner === "A" ? "B" : "A"]),
                })}
              </p>
            </>
          ) : (
            room.teamTotals.A + room.teamTotals.B > 0 && (
              <h1 className="mt-2 text-2xl font-semibold">{t("team.draw")}</h1>
            )
          )
        ) : (
          competitive &&
          winner && (
            <>
              <Trophy className="mt-2 size-8 text-gold" />
              <h1 className="text-2xl font-semibold">
                <span className="text-primary-muted">{winner.username}</span> {t("mp.wins")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("mp.pointsValue", { points: formatNumber(winner.totalScore) })}
              </p>
            </>
          )
        )}
      </motion.div>

      {teamMode ? (
        <TeamScoreboard
          standings={room.standings}
          myUserId={room.myUserId}
          phase="finished"
          teamTotals={room.teamTotals}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {room.standings.map((s, i) => (
            <motion.div
              key={s.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5",
                i === 0 && competitive ? "border-gold/40 bg-gold/5" : "border-border bg-card",
                s.userId === room.myUserId && "ring-1 ring-primary/40",
              )}
            >
              <span className="w-6 text-center text-lg font-semibold tabular text-muted-foreground">
                {i + 1}
              </span>
              <IdentityAvatar
                name={s.username}
                src={s.avatarUrl}
                buildingId={s.avatarBuildingId}
                color={s.avatarColor}
              />
              <span className="min-w-0 flex-1 truncate font-medium" title={s.username}>
                {s.username}
              </span>
              <span className="text-lg font-semibold tabular text-primary-muted">
                {formatNumber(s.totalScore)}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {room.amHost && (
          <Button
            size="lg"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await rematch({ roomId: room._id }).catch(() => {});
              setBusy(false);
            }}
          >
            <RotateCcw className="size-4" />
            {t("mp.rematch")}
          </Button>
        )}
        <Button size="lg" variant="secondary" className="flex-1" asChild onClick={() => leave({ roomId: room._id }).catch(() => {})}>
          <Link href="/">
            <Home className="size-4" />
            {t("mp.leave")}
          </Link>
        </Button>
      </div>
      {!room.amHost && (
        <p className="text-center text-xs text-muted-foreground">{t("mp.waitingForHost")}</p>
      )}
    </div>
  );
}

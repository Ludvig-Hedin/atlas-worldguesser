"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Home, RotateCcw, Trophy } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { IdentityAvatar } from "@/components/ui/avatar";
import { MapGlyph } from "@/components/map-glyph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { getMapConfig } from "@/lib/maps-config";
import { cn } from "@/lib/utils";

export function RoomResults({ room }: { room: RoomState }) {
  const rematch = useMutation(api.rooms.rematch);
  const leave = useMutation(api.rooms.leave);
  const [busy, setBusy] = useState(false);
  const map = getMapConfig(room.mapId);
  const winner = room.standings[0];
  const competitive = room.standings.length > 1;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <Badge variant="muted" className="gap-1.5">
          <MapGlyph mapId={room.mapId} className="size-3" /> {map.name} · Final results
        </Badge>
        {competitive && winner && (
          <>
            <Trophy className="mt-2 size-8 text-gold" />
            <h1 className="text-2xl font-semibold">
              <span className="text-primary-muted">{winner.username}</span> wins
            </h1>
            <p className="text-sm text-muted-foreground">{formatNumber(winner.totalScore)} points</p>
          </>
        )}
      </motion.div>

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
            <span className="w-6 text-center text-lg font-semibold tabular text-muted-foreground">{i + 1}</span>
            <IdentityAvatar name={s.username} />
            <span className="min-w-0 flex-1 truncate font-medium" title={s.username}>{s.username}</span>
            <span className="text-lg font-semibold tabular text-primary-muted">{formatNumber(s.totalScore)}</span>
          </motion.div>
        ))}
      </div>

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
            Rematch
          </Button>
        )}
        <Button size="lg" variant="secondary" className="flex-1" asChild onClick={() => leave({ roomId: room._id })}>
          <Link href="/">
            <Home className="size-4" />
            Leave
          </Link>
        </Button>
      </div>
      {!room.amHost && (
        <p className="text-center text-xs text-muted-foreground">Waiting for the host to start a rematch…</p>
      )}
    </div>
  );
}

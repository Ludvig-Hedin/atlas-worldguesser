"use client";

import Link from "next/link";
import { Clock, Globe2 } from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import { MapGlyph } from "@/components/map-glyph";
import { formatClock, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GameHUDProps {
  round: number;
  totalRounds: number;
  mapName: string;
  mapId: string;
  totalScore: number;
  timeRemaining: number | null;
  movementLabel: string;
}

export function GameHUD({
  round,
  totalRounds,
  mapName,
  mapId,
  totalScore,
  timeRemaining,
  movementLabel,
}: GameHUDProps) {
  const lowTime = timeRemaining !== null && timeRemaining <= 10;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-4 pb-10">
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/"
          className="flex size-9 items-center justify-center rounded-lg bg-black/40 text-primary-muted backdrop-blur transition-colors hover:bg-black/60"
          aria-label="Home"
        >
          <Globe2 className="size-4" />
        </Link>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-xs font-medium text-white/85 backdrop-blur">
            <MapGlyph mapId={mapId} className="size-3.5 text-primary-muted" />
            <span>{mapName}</span>
            <span className="text-white/40">·</span>
            <span className="text-white/60">{movementLabel}</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {timeRemaining !== null && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-semibold tabular backdrop-blur transition-colors",
              lowTime ? "bg-destructive/25 text-destructive-foreground" : "bg-black/40 text-white/85",
            )}
          >
            <Clock className="size-3.5" />
            {formatClock(timeRemaining)}
          </div>
        )}
        <div className="flex flex-col items-end rounded-lg bg-black/40 px-3 py-1 backdrop-blur">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Round {round}/{totalRounds}</span>
          <AnimatedNumber
            value={totalScore}
            format={formatNumber}
            className="text-lg font-semibold leading-tight tabular text-white"
          />
        </div>
      </div>
    </div>
  );
}

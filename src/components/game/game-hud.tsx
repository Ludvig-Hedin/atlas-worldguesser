"use client";

import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
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

const pill = "flex h-9 items-center rounded-full bg-black/45 backdrop-blur transition-colors";

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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3 pb-10">
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/"
          className={cn(pill, "gap-1 pl-2 pr-3 text-sm font-medium text-white/90 hover:bg-black/65")}
          aria-label="Back to menu"
        >
          <ChevronLeft className="size-4" />
          Menu
        </Link>
        <div className={cn(pill, "hidden gap-1.5 px-3 text-xs font-medium text-white/85 sm:flex")}>
          <MapGlyph mapId={mapId} className="size-3.5 text-primary-muted" />
          <span>{mapName}</span>
          <span className="text-white/35">·</span>
          <span className="text-white/60">{movementLabel}</span>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {timeRemaining !== null && (
          <div
            className={cn(
              pill,
              "gap-1.5 px-3 font-mono text-sm font-semibold tabular",
              lowTime ? "bg-destructive/30 text-destructive-foreground" : "text-white/90",
            )}
          >
            <Clock className="size-3.5" />
            {formatClock(timeRemaining)}
          </div>
        )}
        <div className={cn(pill, "gap-2 px-3.5")}>
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/50">
            {round}/{totalRounds}
          </span>
          <AnimatedNumber
            value={totalScore}
            format={formatNumber}
            className="text-base font-semibold leading-none tabular text-white"
          />
        </div>
      </div>
    </div>
  );
}

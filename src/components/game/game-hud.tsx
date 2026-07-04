"use client";

import Link from "next/link";
import { ChevronLeft, Clock } from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import { KeyboardLegend } from "./keyboard-legend";
import { MapGlyph } from "@/components/map-glyph";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { useHasKeyboard } from "@/hooks/use-has-keyboard";
import { useT } from "@/hooks/use-t";
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
  /** Survival mode: show a running country streak instead of "round X/Y". */
  survivalStreak?: number | null;
}

const pill =
  "flex h-9 items-center rounded-full bg-hud shadow-1 backdrop-blur-md transition-colors";

export function GameHUD({
  round,
  totalRounds,
  mapName,
  mapId,
  totalScore,
  timeRemaining,
  movementLabel,
  survivalStreak = null,
}: GameHUDProps) {
  const t = useT();
  const lowTime = timeRemaining !== null && timeRemaining <= 10;
  const hasKeyboard = useHasKeyboard();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-[var(--hud-scrim)] to-transparent p-3 pb-10">
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/"
          className={cn(pill, "gap-1 pl-2 pr-3 text-sm font-medium text-foreground/90 hover:bg-hud-hover")}
          aria-label={t("hud.backToMenu")}
        >
          <ChevronLeft className="size-4" />
          {t("hud.menu")}
        </Link>
        {hasKeyboard && <KeyboardLegend />}
        <div className={cn(pill, "hidden gap-1.5 px-3 text-xs font-medium text-foreground/85 sm:flex")}>
          <MapGlyph mapId={mapId} className="size-3.5 text-primary-muted" />
          <span>{mapName}</span>
          <span className="text-foreground/35">·</span>
          <span className="text-foreground/60">{movementLabel}</span>
        </div>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {timeRemaining !== null && (
          <div
            className={cn(
              pill,
              "gap-1.5 px-3 font-mono text-sm font-semibold tabular",
              lowTime ? "bg-destructive/30 text-destructive-foreground" : "text-foreground/90",
            )}
          >
            <Clock className="size-3.5" />
            {formatClock(timeRemaining)}
          </div>
        )}
        <div className={cn(pill, "gap-2 px-3.5")}>
          <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
            {survivalStreak !== null
              ? t("hud.streak", { count: survivalStreak })
              : t("hud.roundOf", { current: round, total: totalRounds })}
          </span>
          <AnimatedNumber
            value={totalScore}
            format={formatNumber}
            className="text-base font-semibold leading-none tabular text-white"
          />
        </div>
        <SettingsMenu className="size-9 bg-hud text-foreground/90 shadow-1 backdrop-blur-md hover:bg-hud-hover" />
      </div>
    </div>
  );
}

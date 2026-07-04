"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { FlagMap } from "./flag-map";
import { FlagResults } from "./flag-results";
import { AnimatedNumber } from "./animated-number";
import { useFlagGame } from "@/hooks/use-flag-game";
import { getFlagRegion, type FlagRegionId } from "@/lib/flags/regions";
import { countryName } from "@/lib/countries-meta";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";

const REVEAL_MS = 950;

interface FlagGameProps {
  regionId: FlagRegionId;
  length: number;
  /** Pre-resolved country pool (loaded async by the caller). */
  pool: string[];
  /** Back to the setup screen. */
  onExit: () => void;
}

export function FlagGame({ regionId, length, pool, onExit }: FlagGameProps) {
  const t = useT();
  const region = getFlagRegion(regionId);
  const game = useFlagGame({ regionId, pool, length });
  const { state } = game;

  // Auto-advance a short beat after each reveal. A ref keeps `game.next` out of
  // the deps so the timer isn't reset by unrelated re-renders.
  const nextRef = useRef(game.next);
  useEffect(() => {
    nextRef.current = game.next;
  });
  useEffect(() => {
    if (state.phase !== "revealed") return;
    const id = setTimeout(() => nextRef.current(), REVEAL_MS);
    return () => clearTimeout(id);
  }, [state.phase, state.index]);

  if (state.phase === "finished") {
    return (
      <FlagResults
        regionId={regionId}
        results={state.results}
        onPlayAgain={game.restart}
        onNewGame={onExit}
      />
    );
  }

  const revealed = state.phase === "revealed";
  const last = state.results[state.results.length - 1];

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <FlagMap
        status={game.status}
        onPick={game.guess}
        initialView={region.view}
        interactive={!revealed}
        className="absolute inset-0"
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-1 rounded-full bg-hud px-3 py-2 text-sm font-medium shadow-1 backdrop-blur-md transition-colors hover:bg-hud-hover"
        >
          <ChevronLeft className="size-4" />
          {t("flags.menu")}
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-hud px-3 py-2 text-sm font-medium shadow-1 backdrop-blur-md tabular">
            {t("flags.of", { current: Math.min(state.index + 1, length), total: length })}
          </span>
          <span className="rounded-full bg-hud px-3 py-2 text-sm font-semibold shadow-1 backdrop-blur-md tabular">
            <AnimatedNumber value={game.totalScore} format={formatNumber} />
          </span>
        </div>
      </div>

      {/* Flag stimulus */}
      {game.currentIso && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-hud px-5 py-4 text-center shadow-2 backdrop-blur-md">
            <img
              src={`/flags/${game.currentIso.toLowerCase()}.svg`}
              alt={t("flags.flagAlt")}
              className="h-20 w-32 rounded-md object-cover ring-1 ring-border sm:h-24 sm:w-40"
            />
            <p className="text-sm font-medium text-foreground">
              {revealed && last
                ? last.solved
                  ? t("flags.correct")
                  : t("flags.answerWas", { country: countryName(state.flags[state.index]) })
                : t("flags.prompt")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

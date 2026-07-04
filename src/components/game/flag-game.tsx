"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useAnimationControls } from "motion/react";
import { ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { FlagMap } from "./flag-map";
import { FlagResults } from "./flag-results";
import { AnimatedNumber } from "./animated-number";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { useFlagGame } from "@/hooks/use-flag-game";
import { getFlagRegion, type FlagGameMode, type FlagRegionId } from "@/lib/flags/regions";
import { countryName } from "@/lib/countries-meta";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import { playCorrect, playFinish, playWrong } from "@/lib/sound";
import { cn } from "@/lib/utils";

const REVEAL_MS = 1500;

interface FlagGameProps {
  regionId: FlagRegionId;
  /** Whether each round shows the flag image or the country's name. */
  mode: FlagGameMode;
  length: number;
  /** Pre-resolved country pool (loaded async by the caller). */
  pool: string[];
  /** Back to the setup screen. */
  onExit: () => void;
}

export function FlagGame({ regionId, mode, length, pool, onExit }: FlagGameProps) {
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

  // Let an impatient player skip the reveal wait from the keyboard.
  useEffect(() => {
    if (state.phase !== "revealed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        nextRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, state.index]);

  // Shake the flag card + buzz on a wrong click for tactile "nope" feedback.
  const shake = useAnimationControls();
  useEffect(() => {
    if (state.wrongThisFlag > 0) {
      void shake.start({ x: [0, -9, 9, -6, 6, 0], transition: { duration: 0.4 } });
      playWrong();
    }
  }, [state.wrongThisFlag, shake]);

  // Ding when a flag is solved (a miss already buzzed on the final wrong click).
  const solvedCount = state.results.filter((r) => r.solved).length;
  useEffect(() => {
    if (solvedCount > 0) playCorrect();
  }, [solvedCount]);

  // Fanfare when the run finishes.
  useEffect(() => {
    if (state.phase === "finished") playFinish();
  }, [state.phase]);

  // Trailing consecutive correct answers — momentum counter.
  const streak = useMemo(() => {
    let n = 0;
    for (let i = state.results.length - 1; i >= 0; i--) {
      if (state.results[i].solved) n++;
      else break;
    }
    return n;
  }, [state.results]);

  if (state.phase === "finished") {
    return (
      <FlagResults
        regionId={regionId}
        mode={mode}
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

      {/* Tap anywhere to skip the reveal wait (map is inert during reveal). */}
      {revealed && (
        <button
          type="button"
          aria-label={t("flags.continue")}
          onClick={() => nextRef.current()}
          className="absolute inset-0 z-[5] cursor-pointer"
        />
      )}

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
          {streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              aria-label={t("flags.streak", { count: streak })}
              className="rounded-full bg-hud px-3 py-2 text-sm font-semibold shadow-1 backdrop-blur-md tabular"
            >
              🔥 {streak}
            </motion.span>
          )}
          <span className="rounded-full bg-hud px-3 py-2 text-sm font-medium shadow-1 backdrop-blur-md tabular">
            {t("flags.of", { current: Math.min(state.index + 1, length), total: length })}
          </span>
          <span className="rounded-full bg-hud px-3 py-2 text-sm font-semibold shadow-1 backdrop-blur-md tabular">
            <AnimatedNumber value={game.totalScore} format={formatNumber} />
          </span>
          <div className="pointer-events-auto">
            <SettingsMenu className="size-9 bg-hud text-foreground/90 shadow-1 backdrop-blur-md hover:bg-hud-hover" />
          </div>
        </div>
      </div>

      {/* Flag stimulus */}
      {game.currentIso && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center px-4">
          <motion.div animate={shake}>
          <div
            key={state.index}
            className="animate-fade-up flex flex-col items-center gap-2 rounded-2xl bg-hud px-5 py-4 text-center shadow-2 backdrop-blur-md"
          >
            {mode === "flag" ? (
              <img
                src={`/flags/${game.currentIso.toLowerCase()}.svg`}
                alt={t("flags.flagAlt")}
                className={cn(
                  "h-20 w-32 rounded-md object-cover ring-1 ring-border transition-transform duration-300 sm:h-24 sm:w-40",
                  revealed && last?.solved && "scale-105 ring-2 ring-[#22c55e]",
                )}
              />
            ) : (
              <p
                className={cn(
                  "px-2 text-2xl font-semibold tracking-tight transition-transform duration-300 sm:text-3xl",
                  revealed && last?.solved && "scale-105 text-[#22c55e]",
                )}
              >
                {countryName(game.currentIso)}
              </p>
            )}
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                revealed && last?.solved && "text-[#22c55e]",
                revealed && last && !last.solved && "text-[#ef4444]",
                !revealed && "text-foreground",
              )}
            >
              {revealed && last?.solved && <CheckCircle2 className="size-4" />}
              {revealed && last && !last.solved && <XCircle className="size-4" />}
              {revealed && last
                ? last.solved
                  ? t("flags.correct")
                  : t("flags.answerWas", { country: countryName(state.flags[state.index]) })
                : t(mode === "flag" ? "flags.prompt" : "countries.prompt")}
              {revealed && last?.solved && last.score > 0 && (
                <span className="font-semibold">+{last.score}</span>
              )}
            </p>
          </div>
          </motion.div>
        </div>
      )}

      {/* Continue hint during reveal */}
      {revealed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <span className="rounded-full bg-hud px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-1 backdrop-blur-md">
            {t("flags.continue")}
          </span>
        </div>
      )}
    </div>
  );
}

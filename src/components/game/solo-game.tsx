"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Globe2 } from "lucide-react";
import { StreetViewCanvas } from "./street-view-canvas";
import { GameHUD } from "./game-hud";
import { MapSheet } from "./map-sheet";
import { RoundReveal } from "./round-reveal";
import { MatchResults } from "./match-results";
import { SoloCloudSync } from "./solo-cloud-sync";
import { features } from "@/lib/env";
import { useSoloGame } from "@/hooks/use-solo-game";
import { useCountdown } from "@/hooks/use-countdown";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { getMapConfig, MOVEMENTS } from "@/lib/maps-config";
import type { ApplyResult } from "@/lib/local-profile";
import type { GameSettings } from "@/lib/types";

interface SoloGameProps {
  mapId: string;
  settings: GameSettings;
  onExit: () => void;
}

export function SoloGame({ mapId, settings, onExit }: SoloGameProps) {
  const engine = useSoloGame({ mapId, settings });
  const { game, guess, setGuess, submit, next, restart, currentLocation, currentResult, totalScore, submitting } =
    engine;
  const { record } = useLocalProfile();

  const [pinned, setPinned] = useState(false);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const recordedRef = useRef<string | null>(null);

  // The game is fully client-driven (random seed) — avoid SSR/hydration mismatch.
  useEffect(() => setMounted(true), []);

  const mapConfig = getMapConfig(mapId);
  const movementLabel = MOVEMENTS.find((m) => m.id === settings.movement)?.label ?? "Moving";

  // Server-authoritative-style timer for solo: auto-submit when time runs out.
  const deadline =
    game.phase === "guessing" && settings.timeLimitSec > 0
      ? game.roundStartAt + settings.timeLimitSec * 1000
      : null;
  const remaining = useCountdown(deadline, () => {
    if (game.phase === "guessing" && !submitting) void submit();
  });

  // Record the finished game exactly once.
  useEffect(() => {
    if (game.phase === "finished" && recordedRef.current !== game.id) {
      recordedRef.current = game.id;
      setApplied(record({ id: game.id, mapId: game.mapId, results: game.results }));
    }
  }, [game.phase, game.id, game.mapId, game.results, record]);

  const handlePlayAgain = useCallback(() => {
    setApplied(null);
    setPinned(false);
    restart();
  }, [restart]);

  useKeyboardShortcuts(
    {
      " ": (e) => {
        e.preventDefault();
        if (game.phase === "guessing" && guess && !submitting) void submit();
        else if (game.phase === "reveal") next();
      },
      enter: () => {
        if (game.phase === "reveal") next();
      },
      m: () => setPinned((p) => !p),
    },
    game.phase !== "finished",
  );

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Globe2 className="size-6 animate-pulse text-primary-muted" />
          <p className="text-sm">Dropping you somewhere…</p>
        </div>
      </div>
    );
  }

  if (game.phase === "finished" && applied) {
    return (
      <>
        {features.convex && <SoloCloudSync game={game} />}
        <MatchResults game={game} applied={applied} onPlayAgain={handlePlayAgain} onNewGame={onExit} />
      </>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <StreetViewCanvas location={currentLocation} movement={settings.movement} />

      <GameHUD
        round={game.round}
        totalRounds={settings.rounds}
        mapName={mapConfig.name}
        mapEmoji={mapConfig.emoji}
        totalScore={totalScore}
        timeRemaining={deadline ? Math.ceil(remaining) : null}
        movementLabel={movementLabel}
      />

      {game.phase === "guessing" && (
        <MapSheet
          guess={guess}
          onGuess={setGuess}
          onSubmit={() => void submit()}
          submitting={submitting}
          initialView={mapConfig.view}
          pinned={pinned}
          onTogglePinned={() => setPinned((p) => !p)}
        />
      )}

      <AnimatePresence>
        {game.phase === "reveal" && currentResult && (
          <RoundReveal
            key={currentResult.round}
            result={currentResult}
            map={mapConfig}
            isLastRound={game.round >= settings.rounds}
            onNext={next}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

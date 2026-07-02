"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { AtlasMark } from "@/components/atlas-mark";
import { continentOf } from "@/lib/geo";
import { StreetViewCanvas } from "./street-view-canvas";
import { GameHUD } from "./game-hud";
import { MapSheet } from "./map-sheet";
import { RoundReveal } from "./round-reveal";
import { MatchResults } from "./match-results";
import { SoloCloudSync } from "./solo-cloud-sync";
import type { HintCircle } from "./guess-map";
import { features } from "@/lib/env";
import { pickLocations } from "@/lib/locations";
import { useSoloGame } from "@/hooks/use-solo-game";
import { useCountdown } from "@/hooks/use-countdown";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { getMapConfig, MOVEMENTS } from "@/lib/maps-config";
import type { ApplyResult } from "@/lib/local-profile";
import type { GameLocation, GameSettings } from "@/lib/types";

interface SoloGameProps {
  mapId: string;
  settings: GameSettings;
  onExit: () => void;
  customLocations?: GameLocation[];
}

export function SoloGame({ mapId, settings, onExit, customLocations }: SoloGameProps) {
  const engine = useSoloGame({ mapId, settings, customLocations });
  const {
    game,
    guess,
    setGuess,
    submit,
    next,
    restart,
    replaceCurrentLocation,
    currentLocation,
    currentResult,
    totalScore,
    submitting,
  } = engine;
  const { record } = useLocalProfile();

  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hintCircle, setHintCircle] = useState<HintCircle | null>(null);
  const [forceDemo, setForceDemo] = useState(false);
  const rerollRef = useRef(0);
  const recordedRef = useRef<string | null>(null);

  // Reset the hint + coverage re-roll each round.
  useEffect(() => {
    setHintCircle(null);
    setForceDemo(false);
    rerollRef.current = 0;
  }, [game.round]);

  const useHint = useCallback(() => {
    if (hintCircle) return;
    const radiusMeters = getMapConfig(mapId).scaleKm * 500;
    setHintCircle({ center: { lat: currentLocation.lat, lng: currentLocation.lng }, radiusMeters });
    toast(`Search area shown on the map · ${continentOf(currentLocation.lat, currentLocation.lng)}`, {
      icon: <Lightbulb className="size-4 text-primary-muted" />,
    });
  }, [hintCircle, mapId, currentLocation]);

  // No Google coverage → swap in another location instead of showing the demo.
  const handleNoCoverage = useCallback(() => {
    if (rerollRef.current >= 6) {
      setForceDemo(true);
      return;
    }
    rerollRef.current += 1;
    const [nextLoc] = pickLocations(mapId, 1);
    if (nextLoc) replaceCurrentLocation(nextLoc);
  }, [mapId, replaceCurrentLocation]);

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
    },
    game.phase !== "finished",
  );

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <AtlasMark className="size-6 animate-pulse text-primary-muted" />
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
      <StreetViewCanvas
        location={currentLocation}
        movement={settings.movement}
        onUnavailable={handleNoCoverage}
        forceDemo={forceDemo}
      />

      <GameHUD
        round={game.round}
        totalRounds={settings.rounds}
        mapName={mapConfig.name}
        mapId={mapId}
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
          onHint={useHint}
          hintUsed={!!hintCircle}
          hintCircle={hintCircle}
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

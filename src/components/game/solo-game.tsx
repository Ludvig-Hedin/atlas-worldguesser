"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
import { pickLocations, sampleLocations } from "@/lib/locations";
import { useSoloGame, type SoloGame as SoloGameState, type SoloMode } from "@/hooks/use-solo-game";
import { useCountdown } from "@/hooks/use-countdown";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { useT } from "@/hooks/use-t";
import { getMapConfig, mapNameKey, movementLabelKey } from "@/lib/maps-config";
import { playCorrect, playFinish, playWrong } from "@/lib/sound";
import type { ApplyResult } from "@/lib/local-profile";
import type { GameLocation, GameSettings, RoundResult } from "@/lib/types";
import type { Id } from "@convex/_generated/dataModel";

interface SoloGameProps {
  mapId: string;
  settings: GameSettings;
  onExit: () => void;
  customLocations?: GameLocation[];
  /** "classic" (fixed rounds) or "survival" (endless country streak). */
  mode?: SoloMode;
  /**
   * Play `customLocations` verbatim, in order — no resample, no easter-egg
   * roll. Required whenever the server (not the client) owns the round
   * order, e.g. a streak-challenge attempt replaying a creator's exact
   * sequence — a client reshuffle would show a different round order than
   * the creator saw. Default false (custom maps keep sampling fresh).
   */
  fixedOrder?: boolean;
  /** Mirror the finished game to the global cloud profile. Default true. */
  cloudSync?: boolean;
  /** Fired once when the game finishes (e.g. daily-challenge submit). */
  onComplete?: (results: RoundResult[], game: SoloGameState) => void;
  /** Real Convex id of the custom map being played, so the finished-game sync
   * can bump its play counter. `mapId` stays the "custom" sentinel used for
   * scoring/location-pool lookups above — this is separate and optional. */
  customMapId?: Id<"maps">;
  /** Server-authoritative session id (official/classic maps, signed-in users)
   * — when present, SoloCloudSync submits through `solo.submitGame` instead
   * of the legacy `recordSoloResult` path. */
  sessionId?: Id<"soloSessions">;
  /** When provided, "Play Again" calls this instead of the local `restart()` —
   * used by the session-backed flow, which must mint a NEW server session
   * (a fresh `sessionId` + locations) rather than just reseeding client-side. */
  onPlayAgain?: () => void;
}

export function SoloGame({
  mapId,
  settings,
  onExit,
  customLocations,
  mode = "classic",
  fixedOrder = false,
  cloudSync = true,
  onComplete,
  customMapId,
  sessionId,
  onPlayAgain,
}: SoloGameProps) {
  const t = useT();
  const engine = useSoloGame({ mapId, settings, customLocations, mode, fixedOrder });
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
    survivalStreak,
    submitting,
  } = engine;
  const { record } = useLocalProfile();

  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hintCircle, setHintCircle] = useState<HintCircle | null>(null);
  const [forceDemo, setForceDemo] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const rerollRef = useRef(0);
  const rerollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedRef = useRef<string | null>(null);

  // Reset the hint + coverage re-roll each round.
  useEffect(() => {
    setHintCircle(null);
    setForceDemo(false);
    setRerolling(false);
    rerollRef.current = 0;
    if (rerollTimer.current) {
      clearTimeout(rerollTimer.current);
      rerollTimer.current = null;
    }
  }, [game.round]);

  // Clear any pending reroll timer on unmount.
  useEffect(() => () => {
    if (rerollTimer.current) clearTimeout(rerollTimer.current);
  }, []);

  const useHint = useCallback(() => {
    if (hintCircle) return;
    const radiusMeters = getMapConfig(mapId).scaleKm * 500;
    // Offset the circle's center randomly so the answer lands anywhere inside
    // it — centered on the answer, the circle's midpoint IS a perfect guess.
    const bearing = Math.random() * 2 * Math.PI;
    const offsetMeters = Math.random() * radiusMeters * 0.7;
    const dLat = (offsetMeters * Math.cos(bearing)) / 111_320;
    const dLng =
      (offsetMeters * Math.sin(bearing)) /
      (111_320 * Math.max(0.2, Math.cos((currentLocation.lat * Math.PI) / 180)));
    const center = {
      lat: Math.max(-85, Math.min(85, currentLocation.lat + dLat)),
      lng: ((currentLocation.lng + dLng + 540) % 360) - 180,
    };
    setHintCircle({ center, radiusMeters });
    toast(t("mp.hintToast", { continent: continentOf(currentLocation.lat, currentLocation.lng) }), {
      icon: <Lightbulb className="size-4 text-primary-muted" />,
    });
  }, [hintCircle, mapId, currentLocation, t]);

  // No Google coverage → swap in another location instead of showing the demo.
  const handleNoCoverage = useCallback(
    (reason?: "load" | "coverage") => {
      // The Maps API itself failed to load (blocked / offline): re-rolling can't
      // help, and no further onUnavailable would ever fire — go straight to demo.
      if (reason === "load" || rerollRef.current >= 6) {
        setForceDemo(true);
        setRerolling(false);
        if (rerollTimer.current) {
          clearTimeout(rerollTimer.current);
          rerollTimer.current = null;
        }
        return;
      }
      rerollRef.current += 1;
      // Custom maps must re-roll from the user's own pool, not the world pool.
      const pick = () =>
        customLocations && customLocations.length > 0
          ? sampleLocations(customLocations, 1)[0]
          : pickLocations(mapId, 1)[0];
      let nextLoc = pick();
      // Re-picking the identical coordinates wouldn't re-trigger the panorama
      // effect (deps unchanged) and the round would hang — try once more.
      if (nextLoc && nextLoc.lat === currentLocation.lat && nextLoc.lng === currentLocation.lng) {
        nextLoc = pick();
      }
      if (nextLoc && (nextLoc.lat !== currentLocation.lat || nextLoc.lng !== currentLocation.lng)) {
        // Show a subtle "searching" overlay while we hunt for a covered spot.
        // Debounced clear: as long as rerolls keep firing the overlay stays;
        // once coverage is found (no more rerolls) it lifts after the delay.
        setRerolling(true);
        if (rerollTimer.current) clearTimeout(rerollTimer.current);
        rerollTimer.current = setTimeout(() => setRerolling(false), 1200);
        replaceCurrentLocation(nextLoc);
      } else {
        setForceDemo(true);
        setRerolling(false);
      }
    },
    [mapId, customLocations, currentLocation.lat, currentLocation.lng, replaceCurrentLocation],
  );

  // The game is fully client-driven (random seed) — avoid SSR/hydration mismatch.
  useEffect(() => setMounted(true), []);

  const mapConfig = getMapConfig(mapId);
  const movementLabel = t(movementLabelKey(settings.movement));

  // Server-authoritative-style timer for solo: auto-submit when time runs out.
  const deadline =
    game.phase === "guessing" && settings.timeLimitSec > 0
      ? game.roundStartAt + settings.timeLimitSec * 1000
      : null;
  const remaining = useCountdown(deadline, () => {
    if (game.phase === "guessing" && !submitting) {
      toast(t("game.timeUp"));
      void submit();
    }
  });

  // Record the finished game exactly once (local profile + optional onComplete).
  useEffect(() => {
    if (game.phase === "finished" && recordedRef.current !== game.id) {
      recordedRef.current = game.id;
      setApplied(record({ id: game.id, mapId: game.mapId, results: game.results }));
      onComplete?.(game.results, game);
      playFinish();
    }
  }, [game, record, onComplete]);

  // Sound cue on reveal: right/wrong by whether the country was correct.
  useEffect(() => {
    if (game.phase !== "reveal" || !currentResult) return;
    if (currentResult.countryCorrect) playCorrect();
    else playWrong();
    // currentResult is stable for the round; fire once per round reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.round]);

  const handlePlayAgain = useCallback(() => {
    if (onPlayAgain) {
      onPlayAgain();
      return;
    }
    setApplied(null);
    restart();
  }, [onPlayAgain, restart]);

  // Mirror RoundReveal's 450ms mash-guard: without it, held-down Space
  // (key-repeat) from submitting skips the reveal instantly.
  const revealAtRef = useRef(0);
  useEffect(() => {
    if (game.phase === "reveal") revealAtRef.current = Date.now();
  }, [game.phase]);
  const advanceFromReveal = useCallback(() => {
    if (Date.now() - revealAtRef.current >= 450) next();
  }, [next]);

  useKeyboardShortcuts(
    {
      " ": (e) => {
        e.preventDefault();
        if (game.phase === "guessing" && guess && !submitting) void submit();
        else if (game.phase === "reveal") advanceFromReveal();
      },
      enter: () => {
        if (game.phase === "reveal") advanceFromReveal();
      },
    },
    game.phase !== "finished",
  );

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <AtlasMark className="size-6 animate-pulse text-primary-muted" />
          <p className="text-sm">{t("game.droppingSomewhere")}</p>
        </div>
      </div>
    );
  }

  if (game.phase === "finished" && applied) {
    return (
      <>
        {features.convex && cloudSync && game.mode !== "survival" && (
          <SoloCloudSync game={game} customMapId={customMapId} sessionId={sessionId} />
        )}
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

      <AnimatePresence>
        {rerolling && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 text-white/60">
              <AtlasMark className="size-6 animate-pulse text-primary-muted" />
              <p className="text-sm">{t("game.findingSpot")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GameHUD
        round={game.round}
        totalRounds={settings.rounds}
        mapName={t(mapNameKey(mapConfig.id))}
        mapId={mapId}
        totalScore={totalScore}
        timeRemaining={deadline ? Math.ceil(remaining) : null}
        movementLabel={movementLabel}
        survivalStreak={game.mode === "survival" ? survivalStreak : null}
      />

      {/* TODO(bug-hunt): MapSheet is unmounted during the reveal, so the user's
          drag-resized dimensions and fullscreen preference reset every round.
          If persistence is wanted, lift size/fullscreen state up here (or hide
          with CSS instead of unmounting). */}
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
            isLastRound={
              game.mode === "survival"
                ? !currentResult.countryCorrect
                : game.round >= settings.rounds
            }
            onNext={next}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

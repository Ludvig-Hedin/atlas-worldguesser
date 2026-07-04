"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Flag, Navigation, Trophy } from "lucide-react";
import { GuessMap } from "./guess-map";
import { AnimatedNumber } from "./animated-number";
import { CluesReferenceSheet } from "./clues-reference-sheet";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { CountryGlyph } from "@/components/map-glyph";
import { useHasKeyboard } from "@/hooks/use-has-keyboard";
import { countryName } from "@/lib/countries-meta";
import { drivingSideFact } from "@/data/country-clues";
import { formatDistance, formatNumber } from "@/lib/format";
import { MAX_ROUND_SCORE, type RoundResult } from "@/lib/types";
import type { MapConfig } from "@/lib/maps-config";
import { cn } from "@/lib/utils";

interface RoundRevealProps {
  result: RoundResult;
  map: MapConfig;
  isLastRound: boolean;
  onNext: () => void;
}

export function RoundReveal({ result, map, isLastRound, onNext }: RoundRevealProps) {
  const madeGuess = result.guess !== null;
  const scoreFraction = result.score / MAX_ROUND_SCORE;
  const hasKeyboard = useHasKeyboard();
  const [cluesOpen, setCluesOpen] = useState(false);
  const sideFact = drivingSideFact(result.actual.countryCode);

  // Mash-guard: keep the advance button disabled briefly so a quick click
  // doesn't skip the map-fit animation. Re-focus once it becomes actionable.
  const nextRef = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setReady(true);
      nextRef.current?.focus();
    }, 450);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex flex-col bg-background"
    >
      <div className="relative flex-1">
        <GuessMap
          guess={result.guess}
          actual={result.actual}
          reveal
          interactive={false}
          initialView={map.view}
        />
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 34, delay: 0.1 }}
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 p-4"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-border-strong bg-popover/95 p-5 shadow-3 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-overlay">
                <CountryGlyph className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actual location</p>
                <p className="text-lg font-semibold leading-tight">{countryName(result.actual.countryCode)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Round score</p>
              <AnimatedNumber
                value={result.score}
                format={formatNumber}
                className="text-2xl font-semibold leading-tight tabular text-primary-muted"
              />
            </div>
          </div>

          <Progress value={scoreFraction} />

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated/50 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Navigation className="size-3.5 shrink-0 text-primary-muted" />
              {sideFact ?? "What gave it away?"}
            </span>
            <button
              type="button"
              onClick={() => setCluesOpen(true)}
              className="shrink-0 text-xs font-medium text-primary-muted transition-colors hover:text-primary-muted/80"
            >
              Learn more
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Flag className="size-3.5" />
              {madeGuess ? (
                <>
                  You guessed{" "}
                  <span className={cn("font-medium", result.countryCorrect ? "text-primary-muted" : "text-foreground")}>
                    {result.guessCountryCode ? countryName(result.guessCountryCode) : "the ocean"}
                  </span>
                </>
              ) : (
                <span className="text-destructive">No guess made</span>
              )}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="size-3.5" />
              <span className="font-medium text-foreground">{formatDistance(result.distanceMeters)}</span> away
            </span>
          </div>

          <Button ref={nextRef} size="lg" className="w-full" onClick={onNext} disabled={!ready} autoFocus>
            {isLastRound ? "See results" : "Next round"}
            <ArrowRight className="size-4" />
            {hasKeyboard && (
              <Kbd className="ml-1 border-white/20 bg-black/20 text-primary-foreground/80">Space</Kbd>
            )}
          </Button>
        </div>
      </motion.div>

      <CluesReferenceSheet open={cluesOpen} onOpenChange={setCluesOpen} />
    </motion.div>
  );
}

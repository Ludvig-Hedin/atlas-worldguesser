"use client";

import { motion } from "motion/react";
import { ArrowRight, Flag, Trophy } from "lucide-react";
import { GuessMap } from "./guess-map";
import { AnimatedNumber } from "./animated-number";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
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
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-popover/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-white/6">
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

          <Button size="lg" className="w-full" onClick={onNext} autoFocus>
            {isLastRound ? "See results" : "Next round"}
            <ArrowRight className="size-4" />
            <Kbd className="ml-1 border-white/20 bg-black/20 text-primary-foreground/80">Space</Kbd>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

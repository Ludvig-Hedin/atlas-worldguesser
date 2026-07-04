"use client";

import { RoundReveal } from "@/components/game/round-reveal";
import { getMapConfig } from "@/lib/maps-config";
import type { RoundResult } from "@/lib/types";

const result: RoundResult = {
  round: 1,
  actual: { lat: 50.06, lng: 19.94, countryCode: "PL" },
  guess: { lat: 43.9, lng: 17.68 },
  distanceMeters: 600_000,
  score: 3704,
  timeMs: 12000,
  guessCountryCode: "BA",
  countryCorrect: false,
};

export default function DebugRoundReveal() {
  return (
    <div className="relative h-screen w-screen">
      <RoundReveal result={result} map={getMapConfig("europe")} isLastRound={false} onNext={() => {}} />
    </div>
  );
}

import type { Metadata } from "next";
import { FlagsClient } from "@/components/game/flags-client";
import { isFlagRegionId, type FlagRegionId } from "@/lib/flags/regions";
import { ROUND_OPTIONS } from "@/lib/maps-config";

export const metadata: Metadata = {
  title: "Flags — Guess the Country",
  description:
    "See a flag, click the country on a blank world map. Play the World or a single continent, beat your best score, and climb the flag leaderboard. Free, no download.",
  alternates: { canonical: "/flags" },
};

type SearchParams = Promise<{ region?: string; len?: string }>;

export default async function FlagsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const initialRegion: FlagRegionId | undefined =
    params.region && isFlagRegionId(params.region) ? params.region : undefined;
  const len = params.len ? Number(params.len) : NaN;
  const initialLength = (ROUND_OPTIONS as readonly number[]).includes(len) ? len : undefined;
  return <FlagsClient initialRegion={initialRegion} initialLength={initialLength} />;
}

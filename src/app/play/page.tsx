import type { Metadata } from "next";
import { PlayClient } from "@/components/game/play-client";
import { MAPS } from "@/lib/maps-config";
import type { GameModeId } from "@/lib/types";

export const metadata: Metadata = {
  title: "Play — Choose a Map",
  description:
    "Start a round: play the World, Europe, USA, or Countries map. Get dropped into a random Street View and guess the location on the map. Free, no download.",
  alternates: { canonical: "/play" },
};

type SearchParams = Promise<{ map?: string; quick?: string; resume?: string }>;

export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  // Object.hasOwn, not `in`: `?map=constructor` walks the prototype chain and
  // would pass an Object.prototype member through as a "valid" map id.
  const mapId: GameModeId =
    params.map && Object.hasOwn(MAPS, params.map) ? (params.map as GameModeId) : "world";
  const quickStart = params.quick === "1";
  const resume = params.resume === "1";
  return <PlayClient initialMapId={mapId} quickStart={quickStart} resume={resume} />;
}

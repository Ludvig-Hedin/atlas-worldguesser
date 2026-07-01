import type { Metadata } from "next";
import { PlayClient } from "@/components/game/play-client";
import { MAPS } from "@/lib/maps-config";
import type { GameModeId } from "@/lib/types";

export const metadata: Metadata = {
  title: "Play",
};

type SearchParams = Promise<{ map?: string; quick?: string }>;

export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const mapId: GameModeId = params.map && params.map in MAPS ? (params.map as GameModeId) : "world";
  const quickStart = params.quick === "1";
  return <PlayClient initialMapId={mapId} quickStart={quickStart} />;
}

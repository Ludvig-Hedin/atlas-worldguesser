"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowRight, ChevronLeft, Play, Trophy } from "lucide-react";
import { AtlasMark } from "@/components/atlas-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StreetViewCanvas } from "./street-view-canvas";
import { MapSheet } from "./map-sheet";
import { LocalPartyResults } from "./local-party-results";
import {
  useLocalPartyGame,
  type LocalPlayer,
  type LocalTurnResult,
} from "@/hooks/use-local-party-game";
import { useCountdown } from "@/hooks/use-countdown";
import { SettingsMenu } from "@/components/preferences/settings-menu";
import { usePreferences } from "@/hooks/use-preferences";
import { useT } from "@/hooks/use-t";
import { mapStyleFor } from "@/lib/map-style";
import { resolveTheme } from "@/lib/preferences";
import { getMapConfig, movementLabelKey } from "@/lib/maps-config";
import { formatClock, formatDistance, formatNumber } from "@/lib/format";
import type { GameLocation, GameSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LocalPartyGameProps {
  mapId: string;
  settings: GameSettings;
  players: LocalPlayer[];
  onExit: () => void;
}

/**
 * Same-device "Pass & Play" party mode: one shared panorama per round, each
 * local player takes an independent turn before the round reveals to
 * everyone. Entirely client-side — no accounts, no Convex, no persistence.
 */
export function LocalPartyGame({ mapId, settings, players, onExit }: LocalPartyGameProps) {
  const t = useT();
  const engine = useLocalPartyGame({ mapId, settings, players });
  const {
    game,
    guess,
    setGuess,
    beginTurn,
    submit,
    continueToNextRound,
    restart,
    currentLocation,
    currentPlayer,
    currentRoundResults,
    totals,
  } = engine;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mapConfig = getMapConfig(mapId);
  const movementLabel = t(movementLabelKey(settings.movement));

  const deadline =
    game.phase === "guessing" && settings.timeLimitSec > 0
      ? game.roundStartAt + settings.timeLimitSec * 1000
      : null;
  const remaining = useCountdown(deadline, () => {
    if (game.phase === "guessing") submit();
  });

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

  if (game.phase === "finished") {
    return (
      <LocalPartyResults players={players} totals={totals} onPlayAgain={restart} onNewGame={onExit} />
    );
  }

  if (game.phase === "handoff") {
    return (
      <HandoffScreen
        player={currentPlayer}
        round={game.round}
        totalRounds={settings.rounds}
        onReady={beginTurn}
      />
    );
  }

  if (game.phase === "roundReveal") {
    return (
      <RoundRevealScreen
        actual={currentLocation}
        players={players}
        results={currentRoundResults}
        totals={totals}
        round={game.round}
        totalRounds={settings.rounds}
        mapView={mapConfig.view}
        onContinue={continueToNextRound}
      />
    );
  }

  // game.phase === "guessing"
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <StreetViewCanvas location={currentLocation} movement={settings.movement} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-[var(--hud-scrim)] to-transparent p-3 pb-10">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 items-center gap-1 rounded-full bg-hud pl-2 pr-3 text-sm font-medium text-foreground/90 shadow-1 backdrop-blur-md transition-colors hover:bg-hud-hover"
            aria-label={t("hud.backToMenu")}
          >
            <ChevronLeft className="size-4" />
            {t("hud.menu")}
          </Link>
          <div
            className="flex h-9 items-center gap-2 rounded-full px-3.5 shadow-1 backdrop-blur-md"
            style={{ backgroundColor: `${currentPlayer.color}40` }}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: currentPlayer.color }} />
            <span className="text-sm font-semibold text-white">
              {t("party.turnOf", { name: currentPlayer.name })}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {deadline !== null && (
            <div
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full bg-hud px-3 font-mono text-sm font-semibold tabular text-foreground/90 shadow-1 backdrop-blur-md",
                remaining <= 10 && "bg-destructive/30 text-destructive-foreground",
              )}
            >
              {formatClock(Math.ceil(remaining))}
            </div>
          )}
          <div className="flex h-9 items-center gap-1.5 rounded-full bg-hud px-3.5 text-sm font-medium text-foreground/85 shadow-1 backdrop-blur-md">
            <span className="text-foreground/60">{movementLabel}</span>
            <span className="text-foreground/35">·</span>
            {t("party.roundOf", { current: game.round, total: settings.rounds })}
          </div>
          <SettingsMenu className="size-9 bg-hud text-foreground/90 shadow-1 backdrop-blur-md hover:bg-hud-hover" />
        </div>
      </div>

      <MapSheet guess={guess} onGuess={setGuess} onSubmit={submit} submitting={false} initialView={mapConfig.view} />
    </div>
  );
}

function HandoffScreen({
  player,
  round,
  totalRounds,
  onReady,
}: {
  player: LocalPlayer;
  round: number;
  totalRounds: number;
  onReady: () => void;
}) {
  const t = useT();
  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("party.roundOf", { current: round, total: totalRounds })}
      </span>
      <div className="flex flex-col items-center gap-3">
        <span
          className="flex size-16 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-2"
          style={{ backgroundColor: player.color }}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <p className="text-sm text-muted-foreground">{t("party.passDeviceTo")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{player.name}</h1>
      </div>
      <Button size="lg" onClick={onReady} className="mt-2">
        <Play className="size-4" />
        {t("party.imReady")}
      </Button>
    </div>
  );
}

function RoundRevealScreen({
  actual,
  players,
  results,
  totals,
  round,
  totalRounds,
  mapView,
  onContinue,
}: {
  actual: GameLocation;
  players: LocalPlayer[];
  results: LocalTurnResult[];
  totals: number[];
  round: number;
  totalRounds: number;
  mapView: [number, number, number];
  onContinue: () => void;
}) {
  const t = useT();
  const rows = players
    .map((player, i) => ({ player, result: results.find((r) => r.playerIndex === i) ?? null, total: totals[i] ?? 0 }))
    .sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0));
  const isLastRound = round >= totalRounds;

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="text-center">
          <Badge variant="gold">{t("party.roundResults", { round })}</Badge>
        </div>

        <div className="h-56 overflow-hidden rounded-2xl border border-border sm:h-72">
          <RoundRevealMap actual={actual} players={players} results={results} view={mapView} />
        </div>

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-1">
          {rows.map(({ player, result, total }, i) => (
            <div key={`${player.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{player.name}</p>
                <p className="text-xs text-muted-foreground">
                  {result?.guess ? formatDistance(result.distanceMeters) : t("party.noGuess")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular text-primary-muted">+{formatNumber(result?.score ?? 0)}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {formatNumber(total)} {t("party.runningTotal")}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button size="lg" className="w-full" onClick={onContinue}>
          {isLastRound ? <Trophy className="size-4" /> : <ArrowRight className="size-4" />}
          {isLastRound ? t("party.seeFinalResults") : t("party.nextRound")}
        </Button>
      </div>
    </div>
  );
}

/** Static reveal map: every local player's pin (their own color) + the actual location, with result lines. */
function RoundRevealMap({
  actual,
  players,
  results,
  view,
}: {
  actual: GameLocation;
  players: LocalPlayer[];
  results: LocalTurnResult[];
  view: [number, number, number];
}) {
  const { mapType, theme, darkMap } = usePreferences();
  const dark = darkMap && resolveTheme(theme) === "dark";
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleFor(mapType, dark),
      center: [view[0], view[1]],
      zoom: view[2],
      attributionControl: false,
      dragRotate: false,
      interactive: true,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();

    const markers: maplibregl.Marker[] = [];
    map.on("load", () => {
      const bounds = new maplibregl.LngLatBounds();

      const actualEl = document.createElement("div");
      actualEl.innerHTML =
        '<div style="width:16px;height:16px;border-radius:9999px;background:#f5c451;border:2px solid #0b0b0c;box-shadow:0 2px 4px rgba(0,0,0,.5)"></div>';
      markers.push(new maplibregl.Marker({ element: actualEl, anchor: "center" }).setLngLat([actual.lng, actual.lat]).addTo(map));
      bounds.extend([actual.lng, actual.lat]);

      const lines: GeoJSON.Feature[] = [];
      for (const r of results) {
        if (!r.guess) continue;
        const player = players[r.playerIndex];
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:16px;height:16px;border-radius:9999px;background:${player.color};border:2px solid #ffffff;box-shadow:0 2px 4px rgba(0,0,0,.5)"></div>`;
        markers.push(new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([r.guess.lng, r.guess.lat]).addTo(map));
        bounds.extend([r.guess.lng, r.guess.lat]);
        lines.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [r.guess.lng, r.guess.lat],
              [actual.lng, actual.lat],
            ],
          },
        });
      }

      map.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: lines } });
      map.addLayer({
        id: "lines",
        type: "line",
        source: "lines",
        paint: { "line-color": "#f5c451", "line-width": 1.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.7 },
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 0 });
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, players, results, view, mapType, dark]);

  return <div ref={containerRef} className="h-full w-full" />;
}

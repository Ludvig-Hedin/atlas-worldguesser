"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { Scoreboard } from "./scoreboard";
import { RevealMap } from "./reveal-map";
import { StreetViewCanvas } from "@/components/game/street-view-canvas";
import { GameHUD } from "@/components/game/game-hud";
import { MapSheet } from "@/components/game/map-sheet";
import { useCountdown } from "@/hooks/use-countdown";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { continentOf, countryAtAsync } from "@/lib/geo";
import { getMapConfig, MOVEMENTS } from "@/lib/maps-config";
import { CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { formatDistance, formatNumber } from "@/lib/format";
import type { LatLng } from "@/lib/types";

export function RoomGame({ room }: { room: RoomState }) {
  const submitGuess = useMutation(api.rooms.submitGuess);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);

  const mapCfg = getMapConfig(room.mapId);
  const me = room.standings.find((s) => s.userId === room.myUserId);
  const iGuessed = me?.hasGuessed ?? false;
  const timed = room.settings.timeLimitSec > 0;
  const movementLabel = MOVEMENTS.find((m) => m.id === room.settings.movement)?.label ?? "Moving";

  // Reset the pending guess + hint whenever the round or phase changes.
  useEffect(() => {
    setGuess(null);
    setHintUsed(false);
  }, [room.currentRound, room.status]);

  const useHint = useCallback(() => {
    const p = room.panorama;
    if (!p) return;
    setHintUsed(true);
    toast(`This place is in ${continentOf(p.lat, p.lng)}`, {
      icon: <Lightbulb className="size-4 text-primary-muted" />,
    });
  }, [room.panorama]);

  const submit = useCallback(async () => {
    if (iGuessed || submitting || room.status !== "active") return;
    setSubmitting(true);
    const cc = guess ? await countryAtAsync(guess) : null;
    try {
      await submitGuess({ roomId: room._id, guess, guessCountryCode: cc });
    } catch {
      // round may have already ended
    }
    setSubmitting(false);
  }, [iGuessed, submitting, room.status, room._id, guess, submitGuess]);

  const remaining = useCountdown(
    timed && room.status === "active" ? room.roundEndsAt : null,
    () => {
      if (!iGuessed) void submit();
    },
  );

  useKeyboardShortcuts(
    {
      " ": (e) => {
        e.preventDefault();
        if (room.status === "active" && guess && !iGuessed && !submitting) void submit();
      },
      m: () => setPinned((p) => !p),
    },
    room.status === "active",
  );

  const revealCountdown = useCountdown(
    room.status === "roundResult" ? room.roundEndsAt : null,
  );

  const panoLat = room.panorama?.lat;
  const panoLng = room.panorama?.lng;
  const panoLocation = useMemo(
    () => (panoLat != null && panoLng != null ? { lat: panoLat, lng: panoLng, countryCode: "" } : null),
    [panoLat, panoLng],
  );

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      {room.status === "active" && panoLocation && (
        <StreetViewCanvas location={panoLocation} movement={room.settings.movement} />
      )}

      {room.status === "roundResult" && room.reveal && (
        <RevealMap actual={room.reveal.actual} guesses={room.reveal.guesses} initialView={mapCfg.view} />
      )}

      <GameHUD
        round={room.currentRound}
        totalRounds={room.totalRounds}
        mapName={mapCfg.name}
        mapId={room.mapId}
        totalScore={me?.totalScore ?? 0}
        timeRemaining={timed && room.status === "active" ? Math.ceil(remaining) : null}
        movementLabel={movementLabel}
      />

      {/* Live standings */}
      <div className="absolute left-4 top-24 z-20 hidden w-56 rounded-2xl border border-white/10 bg-black/50 p-2.5 backdrop-blur md:block">
        <Scoreboard standings={room.standings} myUserId={room.myUserId} phase={room.status} />
      </div>

      {/* Active: guessing or waiting */}
      {room.status === "active" &&
        (iGuessed ? (
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white/80 backdrop-blur">
            <Loader2 className="size-4 animate-spin text-primary-muted" />
            Waiting for other players…
          </div>
        ) : (
          <MapSheet
            guess={guess}
            onGuess={setGuess}
            onSubmit={() => void submit()}
            submitting={submitting}
            initialView={mapCfg.view}
            pinned={pinned}
            onTogglePinned={() => setPinned((p) => !p)}
            onHint={useHint}
            hintUsed={hintUsed}
          />
        ))}

      {/* Reveal panel */}
      {room.status === "roundResult" && room.reveal && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-popover/95 p-4 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CountryGlyph className="size-4" />
                <span className="font-semibold">{countryName(room.reveal.actual.countryCode)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Next round in {Math.ceil(revealCountdown)}s
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {[...room.reveal.guesses]
                .sort((a, b) => b.score - a.score)
                .map((g) => (
                  <div key={g.userId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{g.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.distanceMeters !== null ? formatDistance(g.distanceMeters) : "No guess"}
                    </span>
                    <span className="w-14 text-right font-semibold tabular text-primary-muted">
                      +{formatNumber(g.score)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

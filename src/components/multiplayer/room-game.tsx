"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { RoomState } from "./types";
import { Scoreboard } from "./scoreboard";
import { TeamScoreboard } from "./team-scoreboard";
import { RevealMap } from "./reveal-map";
import { StreetViewCanvas } from "@/components/game/street-view-canvas";
import { GameHUD } from "@/components/game/game-hud";
import { MapSheet } from "@/components/game/map-sheet";
import type { HintCircle } from "@/components/game/guess-map";
import { useCountdown } from "@/hooks/use-countdown";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard";
import { useT } from "@/hooks/use-t";
import { continentOf, countryAtAsync } from "@/lib/geo";
import { getMapConfig, MOVEMENTS } from "@/lib/maps-config";
import { CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { formatDistance, formatNumber } from "@/lib/format";
import type { LatLng } from "@/lib/types";

export function RoomGame({ room }: { room: RoomState }) {
  const t = useT();
  const submitGuess = useMutation(api.rooms.submitGuess);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hintCircle, setHintCircle] = useState<HintCircle | null>(null);

  const mapCfg = getMapConfig(room.mapId);
  const me = room.standings.find((s) => s.userId === room.myUserId);
  const iGuessed = me?.hasGuessed ?? false;
  const timed = room.settings.timeLimitSec > 0;
  const movementLabel =
    MOVEMENTS.find((m) => m.id === room.settings.movement)?.label ?? t("mp.movementMoving");

  // Reset the pending guess + hint whenever the round or phase changes.
  useEffect(() => {
    setGuess(null);
    setHintCircle(null);
  }, [room.currentRound, room.status]);

  const useHint = useCallback(() => {
    const p = room.panorama;
    if (!p || hintCircle) return;
    const radiusMeters = getMapConfig(room.mapId).scaleKm * 500;
    setHintCircle({ center: { lat: p.lat, lng: p.lng }, radiusMeters });
    toast(t("mp.hintToast", { continent: continentOf(p.lat, p.lng) }), {
      icon: <Lightbulb className="size-4 text-primary-muted" />,
    });
  }, [room.panorama, hintCircle, room.mapId, t]);

  const submit = useCallback(async () => {
    if (iGuessed || submitting || room.status !== "active") return;
    setSubmitting(true);
    try {
      // Country lookup lazy-loads a JSON chunk; a rejection here must not
      // leave `submitting` stuck true (permanently disabled Guess button).
      let cc: string | null = null;
      if (guess) {
        try {
          cc = await countryAtAsync(guess);
        } catch {
          cc = null;
        }
      }
      await submitGuess({ roomId: room._id, guess, guessCountryCode: cc });
    } catch {
      // round may have already ended
    } finally {
      setSubmitting(false);
    }
  }, [iGuessed, submitting, room.status, room._id, guess, submitGuess]);

  // Always arm the deadline auto-submit: even "no timer" rooms are hard-capped
  // server-side (roundEndsAt is always set), and a placed pin should never be
  // silently lost when that cap hits. Only the HUD display is gated on `timed`.
  const remaining = useCountdown(
    room.status === "active" ? room.roundEndsAt : null,
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
        {room.teamMode ? (
          <TeamScoreboard
            standings={room.standings}
            myUserId={room.myUserId}
            phase={room.status}
            teamTotals={room.teamTotals}
          />
        ) : (
          <Scoreboard standings={room.standings} myUserId={room.myUserId} phase={room.status} />
        )}
      </div>

      {/* Active: guessing or waiting */}
      {room.status === "active" &&
        (iGuessed ? (
          <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/80 shadow-1 backdrop-blur-md">
            <Loader2 className="size-4 animate-spin text-primary-muted" />
            {t("mp.waitingForPlayers")}
          </div>
        ) : (
          <MapSheet
            guess={guess}
            onGuess={setGuess}
            onSubmit={() => void submit()}
            submitting={submitting}
            initialView={mapCfg.view}
            onHint={useHint}
            hintUsed={!!hintCircle}
            hintCircle={hintCircle}
          />
        ))}

      {/* Reveal panel */}
      {room.status === "roundResult" && room.reveal && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-4">
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-border bg-popover/95 p-4 shadow-3 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CountryGlyph className="size-4" />
                <span className="font-semibold">{countryName(room.reveal.actual.countryCode)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t("mp.nextRoundIn", { seconds: Math.ceil(revealCountdown) })}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {[...room.reveal.guesses]
                .sort((a, b) => b.score - a.score)
                .map((g) => (
                  <div key={g.userId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={g.username}>{g.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.distanceMeters !== null ? formatDistance(g.distanceMeters) : t("mp.noGuess")}
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

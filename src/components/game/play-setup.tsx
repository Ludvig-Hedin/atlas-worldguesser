"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { MapGlyph } from "@/components/map-glyph";
import { OFFICIAL_MAPS, MOVEMENTS, ROUND_OPTIONS, TIME_OPTIONS, DEFAULT_SETTINGS } from "@/lib/maps-config";
import { poolSize } from "@/lib/locations";
import { pluralize } from "@/lib/format";
import type { GameModeId, GameSettings, Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIME_LABELS: Record<number, string> = {
  0: "None",
  30: "30s",
  60: "1m",
  120: "2m",
};

interface PlaySetupProps {
  onStart: (config: { mapId: GameModeId; settings: GameSettings }) => void;
  initialMapId?: GameModeId;
}

export function PlaySetup({ onStart, initialMapId = "world" }: PlaySetupProps) {
  const [mapId, setMapId] = useState<GameModeId>(initialMapId);
  const [movement, setMovement] = useState<Movement>(DEFAULT_SETTINGS.movement);
  const [rounds, setRounds] = useState<number>(DEFAULT_SETTINGS.rounds);
  const [timeLimitSec, setTimeLimitSec] = useState<number>(DEFAULT_SETTINGS.timeLimitSec);

  const start = () =>
    onStart({ mapId, settings: { rounds, timeLimitSec, movement } });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Choose a map</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {OFFICIAL_MAPS.map((m) => {
            const active = m.id === mapId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMapId(m.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all duration-200 active:scale-[0.98]",
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-border-strong hover:bg-white/[0.03]",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="map-check"
                    className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-3" />
                  </motion.span>
                )}
                <MapGlyph mapId={m.id} className="size-6 text-primary-muted" />
                <span className="font-semibold">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.tagline}</span>
                <span className="mt-1 text-[11px] text-subtle">{pluralize(poolSize(m.id), "location")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Movement</h2>
        <Segmented
          ariaLabel="Movement difficulty"
          value={movement}
          onChange={setMovement}
          options={MOVEMENTS.map((m) => ({ value: m.id, label: m.label, hint: m.description }))}
        />
        <p className="text-xs text-subtle">{MOVEMENTS.find((m) => m.id === movement)?.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Rounds</h2>
          <Segmented
            size="sm"
            ariaLabel="Rounds"
            value={rounds}
            onChange={setRounds}
            options={ROUND_OPTIONS.map((r) => ({ value: r, label: String(r) }))}
          />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Round timer</h2>
          <Segmented
            size="sm"
            ariaLabel="Round timer"
            value={timeLimitSec}
            onChange={setTimeLimitSec}
            options={TIME_OPTIONS.map((t) => ({ value: t, label: TIME_LABELS[t] }))}
          />
        </div>
      </div>

      <Button size="lg" className="w-full" onClick={start}>
        <Play className="size-4" />
        Start game
      </Button>
    </motion.div>
  );
}

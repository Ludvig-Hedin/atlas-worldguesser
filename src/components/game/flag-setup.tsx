"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { MapGlyph } from "@/components/map-glyph";
import { FLAG_REGIONS, type FlagRegionId } from "@/lib/flags/regions";
import { ROUND_OPTIONS } from "@/lib/maps-config";
import { useT } from "@/hooks/use-t";
import { cn } from "@/lib/utils";
import type { GameModeId } from "@/lib/types";

/** Glyph reused from the street-view maps (Americas has no map, so use N. America). */
const REGION_GLYPH: Record<FlagRegionId, GameModeId> = {
  world: "world",
  europe: "europe",
  asia: "asia",
  africa: "africa",
  americas: "northamerica",
  oceania: "oceania",
};

interface FlagSetupProps {
  onStart: (config: { regionId: FlagRegionId; length: number }) => void;
  initialRegion?: FlagRegionId;
  initialLength?: number;
}

export function FlagSetup({ onStart, initialRegion = "world", initialLength = 5 }: FlagSetupProps) {
  const t = useT();
  const [regionId, setRegionId] = useState<FlagRegionId>(initialRegion);
  const [length, setLength] = useState<number>(initialLength);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("flags.chooseRegion")}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {FLAG_REGIONS.map((r) => {
            const active = r.id === regionId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegionId(r.id)}
                className={cn(
                  "group relative flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left shadow-1 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-fluid active:scale-[0.98]",
                  active
                    ? "border-primary/50 bg-primary/10 shadow-2"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="flag-region-check"
                    className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-3" />
                  </motion.span>
                )}
                <MapGlyph mapId={REGION_GLYPH[r.id]} className="size-6 text-primary-muted" />
                <span className="font-semibold">{t(r.nameKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("flags.length")}</h2>
        <Segmented
          size="sm"
          ariaLabel={t("flags.length")}
          value={length}
          onChange={setLength}
          options={ROUND_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        />
      </div>

      <Button size="lg" className="w-full" onClick={() => onStart({ regionId, length })}>
        <Play className="size-4" />
        {t("flags.start")}
      </Button>
    </motion.div>
  );
}

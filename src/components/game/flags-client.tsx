"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AtlasMark } from "@/components/atlas-mark";
import { Button } from "@/components/ui/button";
import { FlagSetup } from "./flag-setup";
import { FlagGame } from "./flag-game";
import { flagPoolForRegion } from "@/lib/flags/pool";
import { type FlagGameMode, type FlagRegionId } from "@/lib/flags/regions";
import { useT } from "@/hooks/use-t";

interface Config {
  regionId: FlagRegionId;
  length: number;
}

interface FlagsClientProps {
  /** Whether each round shows the flag image or the country's name. */
  mode: FlagGameMode;
  initialRegion?: FlagRegionId;
  initialLength?: number;
}

export function FlagsClient({ mode, initialRegion, initialLength }: FlagsClientProps) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [pool, setPool] = useState<string[] | null>(null);
  // Bumped on each start so FlagGame remounts with a fresh engine/seed.
  const [gameKey, setGameKey] = useState(0);

  const start = useCallback((next: Config) => {
    setPool(null);
    setConfig(next);
    setGameKey((k) => k + 1);
  }, []);

  const exit = useCallback(() => {
    setConfig(null);
    setPool(null);
  }, []);

  // Resolve the region's country pool (loads polygons; client-only).
  useEffect(() => {
    if (!config) return;
    let alive = true;
    flagPoolForRegion(config.regionId).then((p) => {
      if (alive) setPool(p);
    });
    return () => {
      alive = false;
    };
  }, [config]);

  if (config) {
    if (!pool) {
      return (
        <div className="grid min-h-[100dvh] place-items-center">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary-muted" />
            {t(mode === "flag" ? "flags.loading" : "countries.loading")}
          </div>
        </div>
      );
    }
    return (
      <FlagGame
        key={gameKey}
        regionId={config.regionId}
        mode={mode}
        length={config.length}
        pool={pool}
        onExit={exit}
      />
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <AtlasMark className="size-5 text-primary-muted" />
          Atlas
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/play">{t("flags.solo")}</Link>
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t(mode === "flag" ? "flags.title" : "countries.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(mode === "flag" ? "flags.subtitle" : "countries.subtitle")}
            </p>
          </div>
          <FlagSetup onStart={start} initialRegion={initialRegion} initialLength={initialLength} />
        </div>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AtlasMark } from "@/components/atlas-mark";
import { Button } from "@/components/ui/button";
import { FlagSetup } from "./flag-setup";
import { FlagGame } from "./flag-game";
import { flagPoolForRegion } from "@/lib/flags/pool";
import { type FlagRegionId } from "@/lib/flags/regions";
import { useT } from "@/hooks/use-t";

interface Config {
  regionId: FlagRegionId;
  length: number;
}

interface FlagsClientProps {
  initialRegion?: FlagRegionId;
  initialLength?: number;
}

export function FlagsClient({ initialRegion, initialLength }: FlagsClientProps) {
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
        <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">
          {t("flags.loading")}
        </div>
      );
    }
    return (
      <FlagGame
        key={gameKey}
        regionId={config.regionId}
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
            <h1 className="text-2xl font-semibold tracking-tight">{t("flags.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("flags.subtitle")}</p>
          </div>
          <FlagSetup onStart={start} initialRegion={initialRegion} initialLength={initialLength} />
        </div>
      </main>
    </div>
  );
}

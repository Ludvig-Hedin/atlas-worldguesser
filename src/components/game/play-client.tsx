"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AtlasMark } from "@/components/atlas-mark";
import { PlaySetup } from "./play-setup";
import { SoloGame } from "./solo-game";
import { MultiplayerEntry } from "@/components/multiplayer/multiplayer-entry";
import { DEFAULT_SETTINGS, getMapConfig } from "@/lib/maps-config";
import { loadLastGame, saveLastGame } from "@/lib/last-game";
import type { GameModeId, GameSettings } from "@/lib/types";

interface Config {
  mapId: GameModeId;
  settings: GameSettings;
}

interface PlayClientProps {
  initialMapId: GameModeId;
  quickStart: boolean;
  resume: boolean;
}

export function PlayClient({ initialMapId, quickStart, resume }: PlayClientProps) {
  const [config, setConfig] = useState<Config | null>(
    quickStart ? { mapId: initialMapId, settings: DEFAULT_SETTINGS } : null,
  );
  // A key that changes each time a game starts, so SoloGame remounts fresh.
  const [gameKey, setGameKey] = useState(0);

  const start = useCallback((next: Config) => {
    // Remember this setup so "Continue" on the landing page can jump back in.
    saveLastGame({ mapId: next.mapId, settings: next.settings, label: getMapConfig(next.mapId).name });
    setConfig(next);
    setGameKey((k) => k + 1);
  }, []);

  // Quick-play persists its setup too (it bypasses `start`).
  const savedQuick = useRef(false);
  useEffect(() => {
    if (quickStart && !savedQuick.current) {
      savedQuick.current = true;
      saveLastGame({
        mapId: initialMapId,
        settings: DEFAULT_SETTINGS,
        label: getMapConfig(initialMapId).name,
      });
    }
  }, [quickStart, initialMapId]);

  // Resume: restore the last setup from localStorage on mount (client-only, so
  // it runs in an effect to stay hydration-safe). Falls back to setup if none.
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || resumed.current) return;
    resumed.current = true;
    const last = loadLastGame();
    if (last) start({ mapId: last.mapId, settings: last.settings });
  }, [resume, start]);

  if (config) {
    return (
      <SoloGame
        key={gameKey}
        mapId={config.mapId}
        settings={config.settings}
        onExit={() => setConfig(null)}
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
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">New game</h1>
            <p className="mt-1 text-sm text-muted-foreground">Set it up, then guess where in the world you are.</p>
          </div>
          <PlaySetup onStart={start} initialMapId={initialMapId} />
          <div className="mt-8 flex justify-center">
            <MultiplayerEntry />
          </div>
        </div>
      </main>
    </div>
  );
}

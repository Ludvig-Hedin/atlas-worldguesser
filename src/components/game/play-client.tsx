"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Flag, Type, Users } from "lucide-react";
import { AtlasMark } from "@/components/atlas-mark";
import { PlaySetup } from "./play-setup";
import { SoloGame } from "./solo-game";
import { LocalPartySetup } from "./local-party-setup";
import { LocalPartyGame } from "./local-party-game";
import { MultiplayerEntry } from "@/components/multiplayer/multiplayer-entry";
import { DEFAULT_SETTINGS, getMapConfig } from "@/lib/maps-config";
import { loadLastGame, saveLastGame } from "@/lib/last-game";
import { useT } from "@/hooks/use-t";
import type { SoloMode } from "@/hooks/use-solo-game";
import type { LocalPlayer } from "@/hooks/use-local-party-game";
import type { GameModeId, GameSettings } from "@/lib/types";

interface Config {
  mapId: GameModeId;
  settings: GameSettings;
  mode: SoloMode;
}

interface PartyConfig {
  mapId: GameModeId;
  settings: GameSettings;
  players: LocalPlayer[];
}

interface PlayClientProps {
  initialMapId: GameModeId;
  quickStart: boolean;
  resume: boolean;
}

export function PlayClient({ initialMapId, quickStart, resume }: PlayClientProps) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(
    quickStart ? { mapId: initialMapId, settings: DEFAULT_SETTINGS, mode: "classic" } : null,
  );
  // A key that changes each time a game starts, so SoloGame remounts fresh.
  const [gameKey, setGameKey] = useState(0);

  const [partyConfig, setPartyConfig] = useState<PartyConfig | null>(null);
  const [showPartySetup, setShowPartySetup] = useState(false);
  // A key that changes each new party, so LocalPartyGame remounts fresh.
  const [partyKey, setPartyKey] = useState(0);

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
    if (last) start({ mapId: last.mapId, settings: last.settings, mode: "classic" });
  }, [resume, start]);

  if (partyConfig) {
    return (
      <LocalPartyGame
        key={partyKey}
        mapId={partyConfig.mapId}
        settings={partyConfig.settings}
        players={partyConfig.players}
        onExit={() => setPartyConfig(null)}
      />
    );
  }

  if (config) {
    return (
      <SoloGame
        key={gameKey}
        mapId={config.mapId}
        settings={config.settings}
        mode={config.mode}
        onExit={() => setConfig(null)}
      />
    );
  }

  if (showPartySetup) {
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
              <h1 className="text-2xl font-semibold tracking-tight">{t("party.setupTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("party.entrySubtitle")}</p>
            </div>
            <LocalPartySetup
              onStart={(next) => {
                setPartyConfig(next);
                setPartyKey((k) => k + 1);
                setShowPartySetup(false);
              }}
              onBack={() => setShowPartySetup(false)}
            />
          </div>
        </main>
      </div>
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
          <Link
            href="/daily"
            className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-1 transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Daily Challenge</p>
              <p className="text-xs text-muted-foreground">
                Same five places as everyone else. One shot a day.
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/flags"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-1 transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
              <Flag className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Flags</p>
              <p className="text-xs text-muted-foreground">
                See a flag, click the country. World or by continent.
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/countries"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-1 transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
              <Type className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Countries</p>
              <p className="text-xs text-muted-foreground">
                See a country&apos;s name, click it. World or by continent.
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={() => setShowPartySetup(true)}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-1 transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
              <Users className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t("party.entryTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("party.entrySubtitle")}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
          <div className="mt-8 flex justify-center">
            <MultiplayerEntry />
          </div>
        </div>
      </main>
    </div>
  );
}

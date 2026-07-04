"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Play, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { RulesSelect } from "@/components/game/rules-select";
import { MapGlyph } from "@/components/map-glyph";
import {
  OFFICIAL_MAPS,
  ROUND_OPTIONS,
  TIME_OPTIONS,
  DEFAULT_SETTINGS,
  mapNameKey,
  mapTaglineKey,
} from "@/lib/maps-config";
import { poolSize } from "@/lib/locations";
import { pluralize } from "@/lib/format";
import { playClick } from "@/lib/sound";
import { AVATAR_COLORS } from "@/lib/buildings";
import { useT } from "@/hooks/use-t";
import type { LocalPlayer } from "@/hooks/use-local-party-game";
import type { GameModeId, GameSettings, Movement } from "@/lib/types";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TIME_LABEL_KEYS: Record<number, TKey> = {
  0: "setup.timeNone",
  30: "setup.time30",
  60: "setup.time60",
  120: "setup.time120",
};

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

interface LocalPartySetupProps {
  onStart: (config: { mapId: GameModeId; settings: GameSettings; players: LocalPlayer[] }) => void;
  onBack: () => void;
}

/** Setup screen for the same-device "Pass & Play" mode: local player names + the same map/rules/rounds/timer controls solo setup uses. */
export function LocalPartySetup({ onStart, onBack }: LocalPartySetupProps) {
  const t = useT();
  const [mapId, setMapId] = useState<GameModeId>("world");
  const [movement, setMovement] = useState<Movement>(DEFAULT_SETTINGS.movement);
  const [rounds, setRounds] = useState<number>(DEFAULT_SETTINGS.rounds);
  const [timeLimitSec, setTimeLimitSec] = useState<number>(DEFAULT_SETTINGS.timeLimitSec);
  const [names, setNames] = useState<string[]>(["", ""]);

  const addPlayer = () => {
    if (names.length >= MAX_PLAYERS) return;
    playClick();
    setNames((n) => [...n, ""]);
  };
  const removePlayer = (i: number) => {
    if (names.length <= MIN_PLAYERS) return;
    playClick();
    setNames((n) => n.filter((_, idx) => idx !== i));
  };
  const setName = (i: number, value: string) => {
    setNames((n) => n.map((v, idx) => (idx === i ? value : v)));
  };

  const players: LocalPlayer[] = names.map((name, i) => ({
    name: name.trim() || t("party.playerPlaceholder", { n: i + 1 }),
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
  }));
  const canStart = players.length >= MIN_PLAYERS;

  const start = () => {
    if (!canStart) return;
    playClick();
    onStart({ mapId, settings: { rounds, timeLimitSec, movement }, players });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-lg flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("party.playersHeading")}</h2>
        <div className="flex flex-col gap-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              />
              <input
                value={name}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={t("party.playerPlaceholder", { n: i + 1 })}
                maxLength={24}
                className="h-10 flex-1 rounded-lg border border-border bg-input px-3 text-sm outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus-visible:border-ring"
              />
              {names.length > MIN_PLAYERS && (
                <button
                  type="button"
                  onClick={() => removePlayer(i)}
                  aria-label={t("party.removePlayer")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {names.length < MAX_PLAYERS && (
          <button
            type="button"
            onClick={addPlayer}
            className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-elevated hover:text-foreground"
          >
            <Plus className="size-4" />
            {t("party.addPlayer")}
          </button>
        )}
        {!canStart && <p className="text-center text-xs text-muted-foreground">{t("party.minPlayersHint")}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("setup.chooseMap")}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {OFFICIAL_MAPS.map((m) => {
            const active = m.id === mapId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  playClick();
                  setMapId(m.id);
                }}
                className={cn(
                  "group relative flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left shadow-1 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-fluid active:scale-[0.98]",
                  active
                    ? "border-primary/50 bg-primary/10 shadow-2"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated hover:shadow-2",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="party-map-check"
                    className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-3" />
                  </motion.span>
                )}
                <MapGlyph mapId={m.id} className="size-6 text-primary-muted" />
                <span className="font-semibold">{t(mapNameKey(m.id))}</span>
                <span className="line-clamp-2 min-h-8 text-xs text-muted-foreground">{t(mapTaglineKey(m.id))}</span>
                <span className="mt-1 text-[11px] text-subtle">{pluralize(poolSize(m.id), "location")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t("setup.rules")}</h2>
        <RulesSelect value={movement} onChange={setMovement} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("setup.rounds")}</h2>
          <Segmented
            size="sm"
            ariaLabel={t("setup.rounds")}
            value={rounds}
            onChange={setRounds}
            options={ROUND_OPTIONS.map((r) => ({ value: r, label: String(r) }))}
          />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("setup.roundTimer")}</h2>
          <Segmented
            size="sm"
            ariaLabel={t("setup.roundTimer")}
            value={timeLimitSec}
            onChange={setTimeLimitSec}
            options={TIME_OPTIONS.map((opt) => ({ value: opt, label: t(TIME_LABEL_KEYS[opt]) }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" onClick={start} disabled={!canStart}>
          <Play className="size-4" />
          {t("party.startGame")}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={onBack}>
          {t("party.back")}
        </Button>
      </div>
    </motion.div>
  );
}

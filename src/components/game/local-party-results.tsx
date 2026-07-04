"use client";

import Link from "next/link";
import { Home, RotateCcw, Settings2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-t";
import { formatNumber } from "@/lib/format";
import type { LocalPlayer } from "@/hooks/use-local-party-game";

interface LocalPartyResultsProps {
  players: LocalPlayer[];
  /** Running total per player, in `players` order. */
  totals: number[];
  onPlayAgain: () => void;
  onNewGame: () => void;
}

/** Final ranked scoreboard for a finished local "Pass & Play" match. Ephemeral — nothing here is persisted. */
export function LocalPartyResults({ players, totals, onPlayAgain, onNewGame }: LocalPartyResultsProps) {
  const t = useT();
  const ranked = players
    .map((player, i) => ({ player, total: totals[i] ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const topScore = ranked[0]?.total ?? 0;
  const winners = ranked.filter((r) => r.total === topScore);

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center gap-2 text-center">
          <Trophy className="size-8 text-primary-muted" />
          <h1 className="text-2xl font-semibold tracking-tight">{t("party.finalResults")}</h1>
          <p className="text-sm text-muted-foreground">
            {winners.length > 1 ? t("party.tie") : t("party.winner", { name: winners[0]?.player.name ?? "" })}
          </p>
        </div>

        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-1">
          {ranked.map(({ player, total }, i) => (
            <div key={`${player.name}-${i}`} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-overlay text-xs font-semibold tabular text-muted-foreground">
                {i + 1}
              </span>
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: player.color }} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</p>
              <span className="text-sm font-semibold tabular text-primary-muted">{formatNumber(total)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={onPlayAgain}>
            <RotateCcw className="size-4" />
            {t("party.playAgain")}
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={onNewGame}>
            <Settings2 className="size-4" />
            {t("party.newGame")}
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/">
              <Home className="size-4" />
              {t("party.home")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

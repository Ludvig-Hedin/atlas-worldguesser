import Link from "next/link";
import { ArrowRight, Globe2, MapPin, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { MultiplayerEntry } from "@/components/multiplayer/multiplayer-entry";
import { OFFICIAL_MAPS } from "@/lib/maps-config";
import { features } from "@/lib/env";

const HIGHLIGHTS = [
  { icon: MapPin, title: "Real streets", body: "Dropped into a random panorama anywhere on Earth." },
  { icon: Timer, title: "Your pace", body: "Untimed, or race a per-round clock. Moving to NMPZ." },
  { icon: Trophy, title: "Climb", body: "Earn XP, unlock achievements, keep your streak alive." },
];

export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] size-[680px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-30%] right-[-10%] size-[520px] rounded-full bg-sky-500/5 blur-[120px]" />
      </div>

      <SiteHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
        <Badge variant="muted" className="mb-6 gap-1.5">
          <Globe2 className="size-3" />
          A geography guessing game
        </Badge>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          Dropped somewhere on Earth.
          <br />
          <span className="text-primary-muted">Figure out where.</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Explore a random street, read the clues, and pin your guess on the map. Five rounds, one
          world, pure instinct.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="min-w-44">
            <Link href="/play?map=world&quick=1">
              Quick play
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild className="min-w-44">
            <Link href="/play">Choose a map</Link>
          </Button>
        </div>

        {!features.googleMaps && (
          <p className="mt-4 text-xs text-subtle">
            Running in demo mode — add a Google Maps key for real Street View.
          </p>
        )}

        {features.convex && (
          <div className="mt-10 flex w-full justify-center">
            <MultiplayerEntry />
          </div>
        )}

        {/* Mode grid */}
        <div className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {OFFICIAL_MAPS.map((m) => (
            <Link
              key={m.id}
              href={`/play?map=${m.id}&quick=1`}
              className="group flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-5 transition-all hover:border-border-strong hover:bg-card"
            >
              <span className="text-3xl transition-transform group-hover:scale-110" aria-hidden>
                {m.emoji}
              </span>
              <span className="text-sm font-semibold">{m.name}</span>
              <span className="text-[11px] text-muted-foreground">{m.tagline}</span>
            </Link>
          ))}
        </div>

        {/* Highlights */}
        <div className="mt-16 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-2xl border border-border bg-card/40 p-5">
              <h.icon className="size-5 text-primary-muted" />
              <h3 className="mt-3 text-sm font-semibold">{h.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-4 py-8 text-center text-xs text-subtle">
        Built with Next.js, MapLibre, and Convex · Atlas
      </footer>
    </div>
  );
}

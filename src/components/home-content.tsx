"use client";

import Link from "next/link";
import { ArrowRight, Flag, Globe2, MapPin, Timer, Trophy, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiplayerEntry } from "@/components/multiplayer/multiplayer-entry";
import { LiveStats } from "@/components/live-stats";
import { ResumeCta } from "@/components/resume-cta";
import { MapGlyph } from "@/components/map-glyph";
import { OFFICIAL_MAPS, mapNameKey, mapTaglineKey } from "@/lib/maps-config";
import { features } from "@/lib/env";
import { useT } from "@/hooks/use-t";
import type { TKey } from "@/lib/i18n";

const HIGHLIGHTS: { icon: typeof MapPin; titleKey: TKey; bodyKey: TKey }[] = [
  { icon: MapPin, titleKey: "home.highlightStreetsTitle", bodyKey: "home.highlightStreetsBody" },
  { icon: Timer, titleKey: "home.highlightPaceTitle", bodyKey: "home.highlightPaceBody" },
  { icon: Trophy, titleKey: "home.highlightClimbTitle", bodyKey: "home.highlightClimbBody" },
];

const STEPS: { titleKey: TKey; bodyKey: TKey }[] = [
  { titleKey: "home.stepDropTitle", bodyKey: "home.stepDropBody" },
  { titleKey: "home.stepCluesTitle", bodyKey: "home.stepCluesBody" },
  { titleKey: "home.stepGuessTitle", bodyKey: "home.stepGuessBody" },
];

const FAQ: { qKey: TKey; aKey: TKey }[] = [
  { qKey: "home.faqFreeQ", aKey: "home.faqFreeA" },
  { qKey: "home.faqGeoguessrQ", aKey: "home.faqGeoguessrA" },
  { qKey: "home.faqAccountQ", aKey: "home.faqAccountA" },
  { qKey: "home.faqGuessQ", aKey: "home.faqGuessA" },
];

/**
 * Marketing/landing page body — hero, map grid, highlights, "how to play",
 * "what is Atlas", and FAQ. Split out from `app/page.tsx` (which must stay a
 * Server Component for its `metadata` export) so it can call `useT()`.
 */
export function HomeContent() {
  const t = useT();

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero — full viewport so the globe has room to breathe */}
      <section className="relative flex min-h-[calc(100svh-4.25rem)] select-none flex-col items-center justify-center px-4 pb-12 text-center">
        <Badge
          variant="muted"
          className="mb-6 gap-1.5 border-border bg-overlay shadow-1 backdrop-blur-sm opacity-0 animate-[fade-up_0.5s_ease-out_forwards]"
        >
          <Globe2 className="size-3" />
          {t("home.badge")}
        </Badge>

        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight dark:drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-6xl opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:60ms]">
          {t("home.title1")}
          <br />
          <span className="text-primary-muted">{t("home.title2")}</span>
        </h1>

        <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground drop-shadow-[0_1px_12px_rgba(0,0,0,0.7)] sm:text-lg opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:120ms]">
          {t("home.subhead")}
        </p>

        <div className="pointer-events-auto mt-8 flex flex-col items-center gap-3 sm:flex-row opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:180ms]">
          <ResumeCta />
          <Button size="lg" asChild className="min-w-44 shadow-lg shadow-primary/20">
            <Link href="/play?map=world&quick=1">
              {t("home.quickPlay")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            asChild
            className="min-w-44 border-border bg-overlay backdrop-blur-sm hover:bg-overlay-hover"
          >
            <Link href="/play">{t("home.chooseMap")}</Link>
          </Button>
        </div>

        <div className="opacity-0 animate-[fade-up_0.5s_ease-out_forwards] [animation-delay:240ms]">
          {features.auth && <LiveStats />}

          <p className="mt-3 text-xs text-subtle drop-shadow-[0_1px_10px_rgba(0,0,0,0.7)] hidden">
            {t("home.quickPlayHelper")}
          </p>

          {!features.googleMaps && (
            <p className="mt-4 text-xs text-subtle">{t("home.demoMode")}</p>
          )}

          {features.multiplayer && (
            <div className="pointer-events-auto mt-6 flex w-full max-w-xl justify-center">
              <MultiplayerEntry />
            </div>
          )}
        </div>
      </section>

      {/* Below the fold — sits on solid ground so the globe fades out cleanly */}
      <section className="pointer-events-auto relative z-10 bg-gradient-to-t from-background to-transparent px-4 py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-14">
          {/* Pick a map */}
          <div>
            <h2 className="mb-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-subtle">
              {t("home.jumpIntoMap")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OFFICIAL_MAPS.map((m) => (
                <Link
                  key={m.id}
                  href={`/play?map=${m.id}&quick=1`}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card/60 p-5 shadow-1 transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-card hover:shadow-2 active:scale-[0.97] backdrop-blur-sm"
                >
                  <MapGlyph
                    mapId={m.id}
                    className="size-7 text-primary-muted transition-transform duration-200 ease-fluid group-hover:scale-110"
                  />
                  <span className="text-sm font-semibold">{t(mapNameKey(m.id))}</span>
                  <span className="text-[11px] text-muted-foreground">{t(mapTaglineKey(m.id))}</span>
                </Link>
              ))}
            </div>
            <Link
              href="/flags"
              className="group mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 shadow-1 backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-card hover:shadow-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
                <Flag className="size-5" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold">{t("home.flagsCardTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("home.flagsCardBody")}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform duration-200 ease-fluid group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/countries"
              className="group mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4 shadow-1 backdrop-blur-sm transition-all duration-200 ease-fluid hover:-translate-y-0.5 hover:border-border-strong hover:bg-card hover:shadow-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-muted">
                <Type className="size-5" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold">{t("home.countriesCardTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("home.countriesCardBody")}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform duration-200 ease-fluid group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Highlights */}
          <div className="grid gap-3 text-left sm:grid-cols-3">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.titleKey}
                className="rounded-2xl border border-border bg-card/40 p-5 shadow-1 backdrop-blur-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary-muted">
                  <h.icon className="size-[18px]" />
                </span>
                <h3 className="mt-3.5 text-sm font-semibold">{t(h.titleKey)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(h.bodyKey)}</p>
              </div>
            ))}
          </div>

          {/* How to play */}
          <div>
            <h2 className="mb-6 text-center text-xl font-semibold tracking-tight">
              {t("home.howToPlay")}
            </h2>
            <ol className="grid gap-3 text-left sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.titleKey}
                  className="rounded-2xl border border-border bg-card/40 p-5 shadow-1 backdrop-blur-sm"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-muted">
                    {t("home.stepLabel", { n: i + 1 })}
                  </span>
                  <h3 className="mt-2.5 text-sm font-semibold">{t(s.titleKey)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(s.bodyKey)}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* What is Atlas — keyword-rich intro for search + AI answer engines */}
          <div className="text-center">
            <h2 className="mb-3 text-xl font-semibold tracking-tight">
              {t("home.whatIsHeading")}
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("home.whatIsBody")}
            </p>
          </div>

          {/* FAQ (plain markup — Google restricts FAQ rich results, so no FAQPage schema) */}
          <div>
            <h2 className="mb-6 text-center text-xl font-semibold tracking-tight">
              {t("home.faqHeading")}
            </h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((f) => (
                <div
                  key={f.qKey}
                  className="rounded-2xl border border-border bg-card/40 p-5 shadow-1 backdrop-blur-sm"
                >
                  <h3 className="text-sm font-semibold">{t(f.qKey)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(f.aKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Flag, MapPin, Type } from "lucide-react";
import { AtlasMark } from "@/components/atlas-mark";
import { Button } from "@/components/ui/button";
import { MultiplayerEntry } from "@/components/multiplayer/multiplayer-entry";
import { ResumeCta } from "@/components/resume-cta";
import { useT } from "@/hooks/use-t";
import { features } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { TKey } from "@/lib/i18n";

const MODE_TILES: { icon: typeof MapPin; titleKey: TKey; href: string }[] = [
  { icon: MapPin, titleKey: "home.classicCardTitle", href: "/play" },
  { icon: Flag, titleKey: "home.flagsCardTitle", href: "/flags" },
  { icon: Type, titleKey: "home.countriesCardTitle", href: "/countries" },
];

type MenuSection = "singleplayer" | "multiplayer";

/**
 * WorldGuessr-style top-left hero menu: wordmark, thin divider, then a slim
 * vertical link list. Singleplayer/Multiplayer expand inline (accordion —
 * only one open at a time); Leaderboard/Friends/Profile are plain links.
 */
export function HeroMenu() {
  const t = useT();
  const [openSection, setOpenSection] = useState<MenuSection | null>(null);
  const toggle = (id: MenuSection) =>
    setOpenSection((current) => (current === id ? null : id));

  return (
    <div className="w-72 text-left">
      <Link
        href="/"
        className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground drop-shadow-[0_1px_12px_rgba(0,0,0,0.7)]"
      >
        <AtlasMark className="size-6 text-primary-muted" />
        Atlas
      </Link>

      <div className="mt-4 h-px w-10 bg-border/70" />

      <nav className="mt-5 flex flex-col gap-1.5">
        <AccordionSection
          id="singleplayer"
          label={t("nav.singleplayer")}
          expandedId={openSection}
          onToggle={toggle}
        >
          {MODE_TILES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-base text-foreground/70 transition-colors hover:bg-overlay-hover hover:text-foreground"
            >
              <m.icon className="size-5 text-primary-muted" />
              {t(m.titleKey)}
            </Link>
          ))}
          <div className="mt-1 flex flex-col gap-2 px-1 pt-1">
            <ResumeCta />
            <Button size="md" asChild className="w-full">
              <Link href="/play?map=world&quick=1">
                {t("home.quickPlay")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {!features.googleMaps && (
            <p className="px-2.5 pt-1 text-xs text-subtle">{t("home.demoMode")}</p>
          )}
        </AccordionSection>

        {features.multiplayer && (
          <AccordionSection
            id="multiplayer"
            label={t("nav.multiplayer")}
            expandedId={openSection}
            onToggle={toggle}
          >
            <MultiplayerEntry startExpanded />
          </AccordionSection>
        )}

        {features.convex && <MenuLink href="/leaderboard">{t("nav.leaderboard")}</MenuLink>}
        {features.auth && <MenuLink href="/friends">{t("nav.friends")}</MenuLink>}
        <MenuLink href="/profile">{t("nav.stats")}</MenuLink>
      </nav>
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      asChild
      className="h-auto w-full justify-start px-2.5 py-2 text-xl font-semibold text-foreground/80 hover:text-foreground"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function AccordionSection({
  id,
  label,
  expandedId,
  onToggle,
  children,
}: {
  id: MenuSection;
  label: string;
  expandedId: MenuSection | null;
  onToggle: (id: MenuSection) => void;
  children: ReactNode;
}) {
  const expanded = expandedId === id;
  const panelId = `hero-menu-panel-${id}`;
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="h-auto w-full justify-between px-2.5 py-2 text-xl font-semibold text-foreground/80 hover:text-foreground"
      >
        {label}
        <ChevronDown
          className={cn("size-5 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
        />
      </Button>
      {expanded && (
        <div
          id={panelId}
          className="mt-1.5 flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 p-3 shadow-2 backdrop-blur-sm opacity-0 animate-[fade-up_0.3s_ease-out_forwards]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

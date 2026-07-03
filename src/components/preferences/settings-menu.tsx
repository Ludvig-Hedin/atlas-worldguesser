"use client";

import type { ReactNode } from "react";
import { Check, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePreferences } from "@/hooks/use-preferences";
import { useT } from "@/hooks/use-t";
import { LOCALES } from "@/lib/i18n";
import type { MapType, Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      {children}
    </div>
  );
}

/** Header entry point for device-local preferences: theme, language, map type. */
export function SettingsMenu() {
  const { theme, setTheme, locale, setLocale, mapType, setMapType } = usePreferences();
  const t = useT();

  const themeOptions: { value: Theme; label: string }[] = [
    { value: "system", label: t("settings.theme.system") },
    { value: "light", label: t("settings.theme.light") },
    { value: "dark", label: t("settings.theme.dark") },
  ];

  const mapOptions: { value: MapType; label: string }[] = [
    { value: "normal", label: t("settings.mapType.normal") },
    { value: "satellite", label: t("settings.mapType.satellite") },
    { value: "terrain", label: t("settings.mapType.terrain") },
    { value: "hybrid", label: t("settings.mapType.hybrid") },
  ];

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("settings.open")}>
              <SettingsIcon className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("settings.title")}</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <Field label={t("settings.theme")}>
            <Segmented
              size="sm"
              ariaLabel={t("settings.theme")}
              value={theme}
              onChange={setTheme}
              options={themeOptions}
            />
          </Field>

          <Field label={t("settings.language")}>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCALES.map((l) => {
                const active = l.code === locale;
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setLocale(l.code)}
                    title={l.english}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border bg-overlay text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{l.native}</span>
                    {active && <Check className="size-3.5 shrink-0 text-primary-muted" />}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("settings.mapType")}>
            <Segmented
              size="sm"
              ariaLabel={t("settings.mapType")}
              value={mapType}
              onChange={setMapType}
              options={mapOptions}
            />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

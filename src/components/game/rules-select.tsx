"use client";

import { motion } from "motion/react";
import { Check, X } from "lucide-react";
import { MOVEMENTS, MOVEMENT_CAPS, movementLabelKey, movementTitleKey, movementCapLabelKey } from "@/lib/maps-config";
import { useT } from "@/hooks/use-t";
import type { Movement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RulesSelectProps {
  value: Movement;
  onChange: (movement: Movement) => void;
  /** Render a non-interactive summary (e.g. for players who can't edit settings). */
  readOnly?: boolean;
}

/**
 * Vertical, self-explaining replacement for the old "Movement" segmented tabs.
 * Each preset is a selectable row that spells out exactly what you can do
 * (move / pan / zoom) with a check or a cross — so "NMPZ" no longer needs to be
 * decoded. Still a single-select radio group under the hood.
 */
export function RulesSelect({ value, onChange, readOnly = false }: RulesSelectProps) {
  const t = useT();
  return (
    <div
      role={readOnly ? undefined : "radiogroup"}
      aria-label={readOnly ? undefined : t("setup.rules")}
      className="flex flex-col gap-2"
    >
      {MOVEMENTS.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : active}
            disabled={readOnly}
            onClick={readOnly ? undefined : () => onChange(m.id)}
            className={cn(
              "group relative flex flex-col gap-2.5 rounded-xl border p-3.5 text-left shadow-1 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-fluid",
              !readOnly && "active:scale-[0.99]",
              active
                ? "border-primary/50 bg-primary/10 shadow-2"
                : "border-border bg-card",
              !readOnly && !active && "hover:border-border-strong hover:bg-elevated hover:shadow-2",
              readOnly && "cursor-default",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border-strong text-transparent",
                )}
              >
                {active && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              <span className="font-semibold">{t(movementTitleKey(m.id))}</span>
              <span className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-subtle">
                {t(movementLabelKey(m.id))}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[1.625rem]">
              {MOVEMENT_CAPS.map((cap) => {
                const allowed = m.caps[cap.key];
                return (
                  <span
                    key={cap.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs",
                      allowed ? "text-foreground/80" : "text-subtle line-through",
                    )}
                  >
                    {allowed ? (
                      <Check className="size-3.5 shrink-0 text-primary-muted" strokeWidth={2.5} />
                    ) : (
                      <X className="size-3.5 shrink-0 text-muted-foreground/50" strokeWidth={2.5} />
                    )}
                    {t(movementCapLabelKey(cap.key))}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

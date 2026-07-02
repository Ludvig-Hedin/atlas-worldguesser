"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  hint?: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}

/** Animated segmented control with a sliding indicator (shared layout). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
  ariaLabel,
}: SegmentedProps<T>) {
  const groupId = React.useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex w-full items-stretch gap-1 rounded-xl bg-white/5 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="radio"
            aria-checked={active}
            type="button"
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-lg text-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
              size === "sm" ? "px-2 py-2 text-[13px]" : "px-3 py-2.5 text-sm",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-lg bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

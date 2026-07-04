"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLUE_CATEGORIES } from "@/data/country-clues";

interface CluesReferenceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Static reference panel for GeoGuessr's classic "meta" — the visual details
 * (bollards, poles, plates, camera generations, driving side) that experienced
 * players use to narrow a guess, taught in-product instead of only on
 * third-party wikis.
 */
export function CluesReferenceSheet({ open, onOpenChange }: CluesReferenceSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>What gives it away?</DialogTitle>
          <DialogDescription>
            Details experienced players learn to read at a glance — none of this is specific to any one round.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          {CLUE_CATEGORIES.map((category) => (
            <section key={category.id} className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <category.icon className="size-4 shrink-0 text-primary-muted" />
                {category.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{category.body}</p>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

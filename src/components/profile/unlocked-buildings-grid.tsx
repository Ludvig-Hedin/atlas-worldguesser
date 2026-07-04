import type { BuildingDef } from "@/lib/buildings";
import { countryName } from "@/lib/countries-meta";

/** Read-only tile grid for a guest's unlocked buildings (no setAvatar — guests aren't signed in). */
export function UnlockedBuildingsGrid({ buildings }: { buildings: BuildingDef[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {buildings.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-3"
        >
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-overlay">
            <img src={b.image} alt="" className="size-full object-contain p-1" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{b.name}</p>
            <p className="truncate text-xs text-muted-foreground">{countryName(b.id)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

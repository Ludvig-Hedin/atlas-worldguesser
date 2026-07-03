import {
  Building2,
  Compass,
  Flag,
  Globe2,
  Landmark,
  MapPin,
  Mountain,
  Palmtree,
  Sparkles,
  Snowflake,
  Sun,
  Trees,
  TentTree,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAP_ICONS: Record<string, LucideIcon> = {
  world: Globe2,
  europe: Landmark,
  nordics: Snowflake,
  asia: Mountain,
  middleeast: TentTree,
  southeastasia: Palmtree,
  africa: Sun,
  northamerica: Compass,
  southamerica: Trees,
  oceania: Waves,
  usa: Building2,
  countries: Flag,
  custom: Sparkles,
};

/** Icon for an official map (replaces map emojis). */
export function MapGlyph({ mapId, className }: { mapId: string; className?: string }) {
  const Icon = MAP_ICONS[mapId] ?? Globe2;
  return <Icon className={cn("shrink-0", className)} aria-hidden />;
}

/** Neutral location glyph shown beside a country name (replaces flag emojis). */
export function CountryGlyph({ className }: { className?: string }) {
  return <MapPin className={cn("shrink-0 text-muted-foreground", className)} aria-hidden />;
}

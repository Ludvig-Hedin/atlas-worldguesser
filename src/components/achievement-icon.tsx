import {
  Award,
  Calendar,
  Compass,
  Crosshair,
  Flame,
  Globe,
  Map,
  MapPin,
  Medal,
  Plane,
  Target,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  compass: Compass,
  target: Target,
  crosshair: Crosshair,
  plane: Plane,
  map: Map,
  "map-pin": MapPin,
  globe: Globe,
  flame: Flame,
  calendar: Calendar,
  medal: Medal,
};

/** Resolve an achievement's icon name to a Lucide icon (client-only). */
export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden />;
}

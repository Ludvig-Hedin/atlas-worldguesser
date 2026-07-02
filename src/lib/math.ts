/** Dependency-free math helpers safe to import in any runtime (incl. Convex). */

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

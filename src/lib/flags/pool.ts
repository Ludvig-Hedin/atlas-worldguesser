import { countryIsoSet } from "@/lib/geo";
import { sample, seededRandom, shuffle } from "@/lib/utils";
import { FLAG_CODES } from "./flag-codes";
import { getFlagRegion, type FlagRegionId } from "./regions";

const FLAG_CODE_SET = new Set(FLAG_CODES);
const NON_COUNTRY = new Set(["AQ", "TF"]);

/**
 * The countries a region can ask for: those that are in the region AND have a
 * clickable polygon AND have a bundled flag. This structural intersection is
 * why micro-states without geometry (Malta, Singapore, most Pacific islands)
 * are never asked — they can't be clicked, so they can't be answers.
 */
export async function flagPoolForRegion(id: FlagRegionId): Promise<string[]> {
  const region = getFlagRegion(id);
  const polygons = await countryIsoSet();
  const base = region.codes ?? [...polygons];
  const pool = base.filter(
    (iso) => polygons.has(iso) && FLAG_CODE_SET.has(iso) && !NON_COUNTRY.has(iso),
  );
  return [...new Set(pool)];
}

/**
 * Deterministically pick `count` flags from a pool. Uses unique sampling when
 * the pool is large enough; a small region (e.g. Oceania) falls back to
 * shuffled repeats, avoiding back-to-back duplicates where possible.
 */
export function pickFlags(pool: readonly string[], count: number, seed: number): string[] {
  if (pool.length === 0 || count <= 0) return [];
  const rng = seededRandom(seed);
  if (pool.length >= count) return sample(pool, count, rng);

  const out: string[] = [];
  while (out.length < count) {
    for (const iso of shuffle(pool, rng)) {
      if (out.length >= count) break;
      if (pool.length > 1 && out[out.length - 1] === iso) continue;
      out.push(iso);
    }
  }
  return out;
}

# Location Repeat Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop players from seeing the same round location twice (or more) across separate games in the same session/day, for every identity (signed-in, guest, and fully anonymous local play), without touching the two hardcoded "easter egg" locations or breaking any context that must stay deterministic/shared (Daily Challenge, Survival streak-challenge links).

**Architecture:** Every location pick today is an independent Fisher–Yates shuffle of a static pool with a brand-new random seed — there is no memory of what a player was shown in a previous game. We add a "recently shown locations" ring buffer per (identity, map) — a new Convex table for anyone with a `users` row (Clerk-authenticated or ephemeral guest), and a parallel localStorage mirror for fully anonymous client-only play — and bias the existing shuffle to draw unseen locations first, only falling back to repeats once the whole pool has been exhausted. Contexts that must show identical locations to everyone (Daily Challenge, shared Survival challenge links) are deliberately left untouched.

**Tech Stack:** TypeScript, Convex (schema + mutations), React hooks, Vitest + Testing Library (jsdom environment already configured).

## Global Constraints

- Never touch the hometown easter-egg mechanism (Åkers Styckebruk / Grundbro in `convex/gameLogic.ts` / `src/hooks/use-solo-game.ts`) — it is an independent, intentional post-hoc override, not part of the pool.
- Never add exclusion logic to Daily Challenge (`convex/dailyChallenge.ts`) or the Survival challenge-link flow (`convex/challenges.ts`) — both require every viewer to see byte-identical locations for a given seed/day; per-user exclusion would break that contract.
- Every existing caller of `pickMatchLocations`/`sampleLocations`/`pickLocations` that does NOT pass the new exclude param must get byte-identical output to before this change (regression safety for Daily Challenge and Survival challenge determinism tests).
- Read `convex/_generated/ai/guidelines.md` conventions before touching Convex code (already done for this plan): bounded arrays only, always validate args, `.first()` over `.unique()` for rows that could rarely double-insert.
- No new test infra: this repo has no `convex-test`/`edge-runtime` setup, so all new business logic must be pure/testable via plain Vitest (jsdom); thin `ctx.db`-touching glue is manually verified instead (documented per task), matching existing repo convention (no `convex/*.test.ts` files exist today).

---

### Task 1: Shared pure helpers in `convex/gameLogic.ts`

**Files:**
- Modify: `convex/gameLogic.ts:37-83`
- Test: `convex/gameLogic.test.ts` (create)

**Interfaces:**
- Produces: `locationKey(l: {lat:number; lng:number}): string`, `layeredSample<T>(pool: readonly T[], count: number, rng: () => number, keyOf: (item: T) => string, excludeKeys?: ReadonlySet<string>): T[]`, `RECENT_LOCATIONS_CAP: number`, `mergeRecentKeys(existing: readonly string[], newKeys: readonly string[], cap?: number): string[]`, and the updated `pickMatchLocations(mapId: string, rounds: number, seed: number, excludeKeys?: ReadonlySet<string>): MatchLocation[]`. Tasks 2, 5, 6 import these.

- [ ] **Step 1: Write the failing tests**

Create `convex/gameLogic.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  layeredSample,
  locationKey,
  mergeRecentKeys,
  pickMatchLocations,
  RECENT_LOCATIONS_CAP,
} from "./gameLogic";
import { getMapPool } from "../src/lib/locations";

describe("locationKey", () => {
  it("is stable for the same coordinates", () => {
    expect(locationKey({ lat: 1.5, lng: -2.25 })).toBe(locationKey({ lat: 1.5, lng: -2.25 }));
  });

  it("differs for different coordinates", () => {
    expect(locationKey({ lat: 1, lng: 2 })).not.toBe(locationKey({ lat: 2, lng: 1 }));
  });
});

describe("layeredSample", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const keyOf = (p: { id: string }) => p.id;

  it("returns `count` items with no excludeKeys", () => {
    const out = layeredSample(pool, 2, () => 0.4, keyOf);
    expect(out).toHaveLength(2);
  });

  it("prefers items not in excludeKeys", () => {
    const excludeKeys = new Set(["a", "b", "c"]);
    const out = layeredSample(pool, 1, () => 0, keyOf, excludeKeys);
    expect(out).toEqual([{ id: "d" }]);
  });

  it("falls back to excluded items once the fresh pool is exhausted", () => {
    const excludeKeys = new Set(["a", "b", "c"]);
    const out = layeredSample(pool, 4, () => 0, keyOf, excludeKeys);
    expect(out).toHaveLength(4);
    expect(out.map(keyOf).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("pads with replacement once the whole pool is exhausted (never returns undefined)", () => {
    const out = layeredSample(pool, 6, () => 1, keyOf);
    expect(out).toHaveLength(6);
    for (const p of out) expect(p).toBeDefined();
  });
});

describe("mergeRecentKeys", () => {
  it("appends new keys", () => {
    expect(mergeRecentKeys(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("caps at the given size, evicting the oldest first", () => {
    expect(mergeRecentKeys(["a", "b", "c"], ["d"], 3)).toEqual(["b", "c", "d"]);
  });

  it("defaults to RECENT_LOCATIONS_CAP", () => {
    const existing = Array.from({ length: RECENT_LOCATIONS_CAP }, (_, i) => `k${i}`);
    const merged = mergeRecentKeys(existing, ["new"]);
    expect(merged).toHaveLength(RECENT_LOCATIONS_CAP);
    expect(merged.at(-1)).toBe("new");
    expect(merged).not.toContain("k0");
  });
});

describe("pickMatchLocations with excludeKeys", () => {
  it("avoids excluded locations when enough fresh ones remain", () => {
    const size = getMapPool("usa").length;
    const excludeKeys = new Set(pickMatchLocations("usa", size - 2, 1).map(locationKey));
    const picks = pickMatchLocations("usa", 2, 2, excludeKeys);
    for (const loc of picks) expect(excludeKeys.has(locationKey(loc))).toBe(false);
  });

  it("still returns `rounds` locations once excludeKeys covers the whole pool", () => {
    const size = getMapPool("usa").length;
    const excludeKeys = new Set(pickMatchLocations("usa", size, 1).map(locationKey));
    const picks = pickMatchLocations("usa", 5, 2, excludeKeys);
    expect(picks).toHaveLength(5);
  });

  it("without excludeKeys, is unaffected by this feature (regression)", () => {
    const a = pickMatchLocations("world", 5, 999);
    const b = pickMatchLocations("world", 5, 999);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/gameLogic.test.ts`
Expected: FAIL — `layeredSample`, `mergeRecentKeys`, `RECENT_LOCATIONS_CAP` don't exist yet, and `pickMatchLocations` doesn't accept a 4th argument.

- [ ] **Step 3: Implement**

In `convex/gameLogic.ts`, replace the block from the `pool()` function through the end of `pickMatchLocations` (currently lines 37-83) with:

```typescript
// Mirror of `getMapPool` in src/lib/locations.ts, driven off the same shared
// `countryCodes` config so solo and multiplayer resolve identical pools.
function pool(mapId: string): SeedLocation[] {
  if (mapId === "countries") return COUNTRY_LOCATIONS;
  const codes = getMapConfig(mapId).countryCodes;
  if (!codes) return WORLD_LOCATIONS;
  const set = new Set(codes);
  return WORLD_LOCATIONS.filter((l) => set.has(l.cc));
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable identity for a seed/game location — same coordinates always yield
 * the same key, regardless of which pool (world/country/custom) they came
 * from. Used to bias repeat picks away from a player's recent history. */
export function locationKey(l: { lat: number; lng: number }): string {
  return `${l.lat}:${l.lng}`;
}

/**
 * Shuffle-and-slice `count` items out of `pool` using `rng`. When
 * `excludeKeys` is given, items NOT in it are exhausted first (in random
 * order) before falling back to excluded items, so a caller can bias away
 * from recently-seen locations without ever returning fewer than `count`
 * items (as long as the pool itself has enough). Falls back to sampling with
 * replacement only once the whole pool has been used once — identical to the
 * pre-existing pad behavior when `excludeKeys` is omitted.
 */
export function layeredSample<T>(
  pool: readonly T[],
  count: number,
  rng: () => number,
  keyOf: (item: T) => string,
  excludeKeys?: ReadonlySet<string>,
): T[] {
  const shuffled = (items: readonly T[]): T[] => {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      // Math.min guards an rng() that returns exactly 1.0 (mulberry32 never
      // does, but injected/test RNGs may) from indexing past the end.
      const j = Math.min(i, Math.floor(rng() * (i + 1)));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const ordered =
    excludeKeys && excludeKeys.size > 0
      ? [
          ...shuffled(pool.filter((p) => !excludeKeys.has(keyOf(p)))),
          ...shuffled(pool.filter((p) => excludeKeys.has(keyOf(p)))),
        ]
      : shuffled(pool);
  const chosen = ordered.slice(0, Math.min(count, pool.length));
  while (chosen.length < count && pool.length > 0) {
    chosen.push(pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]);
  }
  return chosen;
}

/** Ring-buffer cap for a user's "recently shown locations" history — see
 * convex/recentLocations.ts and src/lib/recent-locations.ts. */
export const RECENT_LOCATIONS_CAP = 30;

/** Append `newKeys` to `existing` and keep only the most recent `cap` entries
 * (oldest evicted first). Pure so both the server-side table and the
 * client-only localStorage mirror share one tested eviction rule. */
export function mergeRecentKeys(
  existing: readonly string[],
  newKeys: readonly string[],
  cap: number = RECENT_LOCATIONS_CAP,
): string[] {
  return [...existing, ...newKeys].slice(-cap);
}

/**
 * Deterministically pick the match's hidden answer locations from a seed.
 * `excludeKeys` (see `locationKey`), when given, biases the pick away from a
 * player's recently-shown locations (see convex/recentLocations.ts) — omit it
 * for contexts that must stay identical for every viewer (Daily Challenge,
 * shared Survival challenge links).
 */
export function pickMatchLocations(
  mapId: string,
  rounds: number,
  seed: number,
  excludeKeys?: ReadonlySet<string>,
): MatchLocation[] {
  const p = pool(mapId);
  const rng = mulberry32(seed);
  const chosen = layeredSample(p, rounds, rng, locationKey, excludeKeys);
  // Hometown easter eggs — small chance any round drops in Åkers Styckebruk or
  // Grundbro, SE. World map only: a Sweden drop inside Europe/USA maps breaks
  // their region contract (matches the solo engine's behavior). Each egg gets
  // an independent 3% roll off the same draw.
  const AKERS = { lat: 59.217, lng: 17.006, cc: "SE" };
  const GRUNDBRO = { lat: 59.3089, lng: 17.0899, cc: "SE" };
  return chosen.map((s) => {
    if (mapId !== "world") return { lat: s.lat, lng: s.lng, countryCode: s.cc };
    const r = rng();
    if (r < 0.03) return { lat: AKERS.lat, lng: AKERS.lng, countryCode: AKERS.cc };
    if (r < 0.06) return { lat: GRUNDBRO.lat, lng: GRUNDBRO.lng, countryCode: GRUNDBRO.cc };
    return { lat: s.lat, lng: s.lng, countryCode: s.cc };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/gameLogic.test.ts src/lib/locations.test.ts`
Expected: PASS — including the pre-existing `locations.test.ts` "daily challenge locations" and "region map" suites (regression: they call `pickMatchLocations` with no 4th arg and must see unchanged output).

- [ ] **Step 5: Commit**

```bash
git add convex/gameLogic.ts convex/gameLogic.test.ts
git commit -m "feat(gameLogic): add recency-aware layered sampling helpers"
```

---

### Task 2: `recentLocations` table + Convex accessor module

**Files:**
- Modify: `convex/schema.ts:110-117` (insert new table after `achievements`)
- Create: `convex/recentLocations.ts`

**Interfaces:**
- Consumes: `locationKey`, `mergeRecentKeys` from Task 1 (`convex/gameLogic.ts`).
- Produces: `getRecentLocationKeys(ctx: QueryCtx | MutationCtx, userId: Id<"users">, mapId: string): Promise<Set<string>>`, `recordSeenLocations(ctx: MutationCtx, userId: Id<"users">, mapId: string, locations: readonly {lat:number; lng:number}[]): Promise<void>`. Tasks 3 and 4 import these.

- [ ] **Step 1: Add the schema table**

In `convex/schema.ts`, insert immediately after the `achievements` table (after the line `.index("by_user_achievement", ["userId", "achievementId"]),` and before the `// Finished games...` comment):

```typescript
  // Per (user, map) ring buffer of recently-shown location keys
  // ("<lat>:<lng>", see gameLogic.locationKey), most-recent last, capped at
  // gameLogic.RECENT_LOCATIONS_CAP. Biases gameLogic.pickMatchLocations away
  // from repeats across separate solo games / rooms the same user starts the
  // same session or day (see convex/recentLocations.ts). Guest accounts get
  // real `users` rows too (see isGuest above), so this covers them for free
  // via the same userId key — no guest-specific handling needed.
  recentLocations: defineTable({
    userId: v.id("users"),
    mapId: v.string(),
    keys: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_user_map", ["userId", "mapId"]),

```

- [ ] **Step 2: Create the accessor module**

Create `convex/recentLocations.ts`:

```typescript
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { locationKey, mergeRecentKeys } from "./gameLogic";

/**
 * The set of location keys (see `locationKey`) `userId` was recently shown on
 * `mapId`, across solo games and any room they hosted or played in. Empty
 * when the user has no history yet for this map.
 */
export async function getRecentLocationKeys(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  mapId: string,
): Promise<Set<string>> {
  // `.first()` (not `.unique()`): mirrors the defensive read pattern already
  // used for guest rows (see users.currentUser) — a rare double-insert race
  // must degrade to the earliest row, not throw and break the game.
  const row = await ctx.db
    .query("recentLocations")
    .withIndex("by_user_map", (q) => q.eq("userId", userId).eq("mapId", mapId))
    .first();
  return new Set(row?.keys ?? []);
}

/**
 * Record that `userId` was just shown `locations` on `mapId`, so future picks
 * (see gameLogic.pickMatchLocations) bias away from repeating them.
 */
export async function recordSeenLocations(
  ctx: MutationCtx,
  userId: Id<"users">,
  mapId: string,
  locations: readonly { lat: number; lng: number }[],
): Promise<void> {
  if (locations.length === 0) return;
  const row = await ctx.db
    .query("recentLocations")
    .withIndex("by_user_map", (q) => q.eq("userId", userId).eq("mapId", mapId))
    .first();
  const keys = mergeRecentKeys(row?.keys ?? [], locations.map(locationKey));
  if (row) {
    await ctx.db.patch(row._id, { keys, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("recentLocations", { userId, mapId, keys, updatedAt: Date.now() });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (this file isn't wired up anywhere yet, so it should compile standalone).

**Note on testing:** this module only wraps `ctx.db` reads/writes around the already-unit-tested `mergeRecentKeys`/`locationKey` pure functions (Task 1) — there is no `convex-test`/`edge-runtime` harness in this repo to unit-test `ctx.db` code, and adding one is out of scope for this fix. This is manually verified end-to-end in Task 8's verification step (per repo convention: automated test not practical here, so the exact user flow is manually verified instead).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/recentLocations.ts
git commit -m "feat(schema): add recentLocations table for anti-repeat tracking"
```

---

### Task 3: Wire into solo play (`convex/solo.ts`)

**Files:**
- Modify: `convex/solo.ts:1-14` (imports), `convex/solo.ts:71-95` (`persistSoloGame`), `convex/solo.ts:185-204` (`startGame`)

**Interfaces:**
- Consumes: `getRecentLocationKeys`, `recordSeenLocations` from Task 2.

- [ ] **Step 1: Add the import**

In `convex/solo.ts`, after the existing `import { requireUser } from "./users";` line, add:

```typescript
import { getRecentLocationKeys, recordSeenLocations } from "./recentLocations";
```

- [ ] **Step 2: Record exposure in `persistSoloGame`**

In `persistSoloGame`, immediately after the existing validation loop (right after the closing `}` of `for (const r of rawResults) { ... }`, before `const clamped = clampSettings(settings);`), add:

```typescript
  // Record these as "seen" regardless of score — a submitted game means the
  // player was shown every one of these locations. Covers both this
  // function's callers: solo.submitGame and dailyChallenge.submit.
  await recordSeenLocations(ctx, user._id, mapId, locations);

```

- [ ] **Step 3: Exclude recent locations in `startGame`**

In `startGame`'s handler, change:

```typescript
    const clamped = clampSettings(settings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    const locations = pickMatchLocations(mapId, clamped.rounds, seed);
```

to:

```typescript
    const clamped = clampSettings(settings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    const excludeKeys = await getRecentLocationKeys(ctx, user._id, mapId);
    const locations = pickMatchLocations(mapId, clamped.rounds, seed, excludeKeys);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/solo.ts
git commit -m "feat(solo): avoid repeating recently-shown locations across games"
```

---

### Task 4: Wire into multiplayer rooms (`convex/rooms.ts`)

**Files:**
- Modify: `convex/rooms.ts:1-24` (imports), `convex/rooms.ts:106-116` (`createRoomForUser`), `convex/rooms.ts:270-285` (`updateSettings`), `convex/rooms.ts:748-750` (`finishMatch` member loop), `convex/rooms.ts:872-880` (`rematch`)

**Interfaces:**
- Consumes: `getRecentLocationKeys`, `recordSeenLocations` from Task 2.

- [ ] **Step 1: Add the import**

In `convex/rooms.ts`, after `import { foldGame, resolveCountryByMap } from "../src/lib/progression";`, add:

```typescript
import { getRecentLocationKeys, recordSeenLocations } from "./recentLocations";
```

- [ ] **Step 2: Exclude recent locations in `createRoomForUser`**

Change:

```typescript
  const seed = Math.floor(Math.random() * 0xffffffff);
  const locations = pickMatchLocations(mapId, settings.rounds, seed);
```

to:

```typescript
  const seed = Math.floor(Math.random() * 0xffffffff);
  const excludeKeys = await getRecentLocationKeys(ctx, user._id, mapId);
  const locations = pickMatchLocations(mapId, settings.rounds, seed, excludeKeys);
```

- [ ] **Step 3: Exclude recent locations in `updateSettings`**

Change:

```typescript
    const settings = clampSettings(rawSettings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    await ctx.db.patch(roomId, {
      mapId,
      settings,
      locations: pickMatchLocations(mapId, settings.rounds, seed),
    });
```

to:

```typescript
    const settings = clampSettings(rawSettings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    const excludeKeys = await getRecentLocationKeys(ctx, user._id, mapId);
    await ctx.db.patch(roomId, {
      mapId,
      settings,
      locations: pickMatchLocations(mapId, settings.rounds, seed, excludeKeys),
    });
```

- [ ] **Step 4: Record exposure for every member in `finishMatch`**

In `finishMatch`'s per-member loop, change:

```typescript
    const user = await ctx.db.get(member.userId);
    if (user) {
      const owned = await ctx.db
```

to:

```typescript
    const user = await ctx.db.get(member.userId);
    if (user) {
      await recordSeenLocations(ctx, user._id, room.mapId, room.locations);
      const owned = await ctx.db
```

- [ ] **Step 5: Exclude recent locations in `rematch`**

Change:

```typescript
    const seed = Math.floor(Math.random() * 0xffffffff);
    await ctx.db.patch(roomId, {
      status: "lobby",
      currentRound: 0,
      roundStartedAt: undefined,
      roundEndsAt: undefined,
      locations: pickMatchLocations(room.mapId, room.settings.rounds, seed),
    });
```

to:

```typescript
    const seed = Math.floor(Math.random() * 0xffffffff);
    const excludeKeys = await getRecentLocationKeys(ctx, user._id, room.mapId);
    await ctx.db.patch(roomId, {
      status: "lobby",
      currentRound: 0,
      roundStartedAt: undefined,
      roundEndsAt: undefined,
      locations: pickMatchLocations(room.mapId, room.settings.rounds, seed, excludeKeys),
    });
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add convex/rooms.ts
git commit -m "feat(rooms): avoid repeating recently-shown locations on create/rematch"
```

---

### Task 5: Recency-aware client pool sampling (`src/lib/locations.ts`)

**Files:**
- Modify: `src/lib/locations.ts` (full file, 52 lines)
- Test: `src/lib/locations.test.ts` (extend)

**Interfaces:**
- Consumes: `layeredSample`, `locationKey` from Task 1 (`@convex/gameLogic`).
- Produces: `sampleLocations(pool, count, rng?, excludeKeys?)`, `pickLocations(mapId, count, rng?, excludeKeys?)` — both now accept an optional trailing `excludeKeys?: ReadonlySet<string>`. Tasks 7 and 8 use this.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/locations.test.ts`:

```typescript
describe("pickLocations with excludeKeys", () => {
  it("avoids excluded locations when the fresh pool is large enough", () => {
    const size = poolSize("usa");
    const firstBatch = pickLocations("usa", size - 2, seededRandom(11));
    const excludeKeys = new Set(firstBatch.map((l) => `${l.lat}:${l.lng}`));
    const second = pickLocations("usa", 2, seededRandom(12), excludeKeys);
    for (const loc of second) {
      expect(excludeKeys.has(`${loc.lat}:${loc.lng}`)).toBe(false);
    }
  });

  it("still returns `count` locations once excludeKeys covers the whole pool", () => {
    const size = poolSize("usa");
    const all = pickLocations("usa", size, seededRandom(1));
    const excludeKeys = new Set(all.map((l) => `${l.lat}:${l.lng}`));
    const picks = pickLocations("usa", 3, seededRandom(2), excludeKeys);
    expect(picks).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/locations.test.ts`
Expected: FAIL — `pickLocations` doesn't accept a 4th argument yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/lib/locations.ts` with:

```typescript
import { WORLD_LOCATIONS, COUNTRY_LOCATIONS, toGameLocation, type SeedLocation } from "@/data/locations";
import { getMapConfig } from "./maps-config";
import type { GameLocation } from "./types";
import { layeredSample, locationKey } from "@convex/gameLogic";

/**
 * The candidate pool of seed locations for a given map. Driven entirely off the
 * map's `countryCodes` filter (null = worldwide), so any region/continent/single
 * country map is a config addition in `maps-config.ts` — no change needed here.
 * `countries` is the one true special case (its own one-place-per-nation pool).
 */
export function getMapPool(mapId: string): SeedLocation[] {
  if (mapId === "countries") return COUNTRY_LOCATIONS;
  const codes = getMapConfig(mapId).countryCodes;
  if (!codes) return WORLD_LOCATIONS;
  const set = new Set(codes);
  return WORLD_LOCATIONS.filter((l) => set.has(l.cc));
}

export function poolSize(mapId: string): number {
  return getMapPool(mapId).length;
}

/**
 * Sample `count` locations from a pool. When `excludeKeys` is given, items not
 * in it are used first, so callers can dedup against a player's recent
 * history; either way, falls back to repeats only once the whole pool has
 * been used once. Uses an injectable RNG for deterministic replays.
 */
export function sampleLocations(
  pool: readonly GameLocation[],
  count: number,
  rng: () => number = Math.random,
  excludeKeys?: ReadonlySet<string>,
): GameLocation[] {
  return layeredSample(pool, count, rng, locationKey, excludeKeys);
}

/**
 * Pick `count` locations for an official map's round set.
 */
export function pickLocations(
  mapId: string,
  count: number,
  rng: () => number = Math.random,
  excludeKeys?: ReadonlySet<string>,
): GameLocation[] {
  const pool = getMapPool(mapId).map(toGameLocation);
  return sampleLocations(pool, count, rng, excludeKeys);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/locations.test.ts`
Expected: PASS — including every pre-existing test in this file (regression: "is deterministic for a given seed", "sampleLocations pad-loop", "daily challenge locations" must all still pass unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/locations.ts src/lib/locations.test.ts
git commit -m "feat(locations): support excludeKeys in client-side pool sampling"
```

---

### Task 6: Client-only localStorage recency mirror

**Files:**
- Create: `src/lib/recent-locations.ts`
- Test: `src/lib/recent-locations.test.ts` (create)

**Interfaces:**
- Consumes: `locationKey`, `mergeRecentKeys` from Task 1 (`@convex/gameLogic`).
- Produces: `getRecentLocationKeys(mapId: string): Set<string>`, `recordSeenLocations(mapId: string, locations: readonly {lat:number; lng:number}[]): void`. Tasks 7 and 8 use this for anonymous (no server identity) play.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/recent-locations.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { RECENT_LOCATIONS_CAP } from "@convex/gameLogic";
import { getRecentLocationKeys, recordSeenLocations } from "./recent-locations";

describe("recent-locations (localStorage mirror)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty set with no history", () => {
    expect(getRecentLocationKeys("world").size).toBe(0);
  });

  it("records and retrieves seen locations", () => {
    recordSeenLocations("world", [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]);
    const keys = getRecentLocationKeys("world");
    expect(keys.has("1:2")).toBe(true);
    expect(keys.has("3:4")).toBe(true);
  });

  it("keeps history separate per map", () => {
    recordSeenLocations("world", [{ lat: 1, lng: 2 }]);
    recordSeenLocations("usa", [{ lat: 5, lng: 6 }]);
    expect(getRecentLocationKeys("world").has("5:6")).toBe(false);
    expect(getRecentLocationKeys("usa").has("1:2")).toBe(false);
  });

  it("caps history and evicts the oldest entries", () => {
    for (let i = 0; i < RECENT_LOCATIONS_CAP + 10; i++) {
      recordSeenLocations("world", [{ lat: i, lng: i }]);
    }
    const keys = getRecentLocationKeys("world");
    expect(keys.size).toBeLessThanOrEqual(RECENT_LOCATIONS_CAP);
    expect(keys.has("0:0")).toBe(false);
    expect(keys.has(`${RECENT_LOCATIONS_CAP + 9}:${RECENT_LOCATIONS_CAP + 9}`)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/recent-locations.test.ts`
Expected: FAIL — module `./recent-locations` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/recent-locations.ts`:

```typescript
import { locationKey, mergeRecentKeys } from "@convex/gameLogic";

const STORAGE_PREFIX = "atlas.recentLocations.";

function storageKey(mapId: string): string {
  return `${STORAGE_PREFIX}${mapId}`;
}

/**
 * Recently shown location keys for `mapId`, read from localStorage. Returns
 * an empty set when unavailable (SSR, private browsing, quota errors) — this
 * is only ever a "nice to have" dedup layer for anonymous, no-account play,
 * never a source of truth to guard against failure.
 */
export function getRecentLocationKeys(mapId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(mapId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((k): k is string => typeof k === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

/** Record that the on-device player was just shown `locations` on `mapId`. */
export function recordSeenLocations(
  mapId: string,
  locations: readonly { lat: number; lng: number }[],
): void {
  if (typeof window === "undefined" || locations.length === 0) return;
  try {
    const existing = Array.from(getRecentLocationKeys(mapId));
    const next = mergeRecentKeys(existing, locations.map(locationKey));
    window.localStorage.setItem(storageKey(mapId), JSON.stringify(next));
  } catch {
    // Private browsing / quota errors — dedup is a nice-to-have, never block play.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/recent-locations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recent-locations.ts src/lib/recent-locations.test.ts
git commit -m "feat(recent-locations): add localStorage anti-repeat mirror for anonymous play"
```

---

### Task 7: Wire into solo/survival client engine (`src/hooks/use-solo-game.ts`)

**Files:**
- Modify: `src/hooks/use-solo-game.ts`
- Test: `src/hooks/use-solo-game.test.ts` (extend)

**Interfaces:**
- Consumes: `getRecentLocationKeys`, `recordSeenLocations` from Task 6 (`@/lib/recent-locations`); the updated `pickLocations` from Task 5.
- Produces: `SoloGame.usesOfficialPool: boolean` — true when `locations` came from the official pool (not server-fixed, not a custom map).

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/use-solo-game.test.ts` (add the imports at the top alongside the existing ones):

```typescript
import { getMapPool } from "@/lib/locations";
import { recordSeenLocations } from "@/lib/recent-locations";
```

Then add this new `describe` block at the end of the file:

```typescript
describe("useSoloGame — recent-location exclusion (official pool only)", () => {
  it("avoids locations recorded as recently seen on the same map", () => {
    window.localStorage.clear();
    // Europe (not World) deliberately — World rolls a small per-round chance
    // of swapping in a hometown easter egg, which would make an exact-match
    // assertion here flaky. Record every Europe location except exactly 3 as
    // "seen", so the only way this game's 3 rounds can all avoid the seen set
    // is if exclusion actually ran (pure chance would almost certainly hit at
    // least one of the many "seen" entries).
    const pool = getMapPool("europe");
    const toExclude = pool.slice(0, pool.length - 3);
    recordSeenLocations("europe", toExclude.map((l) => ({ lat: l.lat, lng: l.lng })));
    const remainingKeys = new Set(pool.slice(pool.length - 3).map((l) => `${l.lat}:${l.lng}`));

    const { result } = renderHook(() =>
      useSoloGame({ mapId: "europe", settings: { ...settings, rounds: 3 } }),
    );
    expect(result.current.game.usesOfficialPool).toBe(true);
    for (const loc of result.current.game.locations) {
      expect(remainingKeys.has(`${loc.lat}:${loc.lng}`)).toBe(true);
    }
  });

  it("marks fixedOrder (server-authoritative) games as not using the official pool", () => {
    const { result } = renderHook(() =>
      useSoloGame({ mapId: "world", settings, customLocations: serverLocations, fixedOrder: true }),
    );
    expect(result.current.game.usesOfficialPool).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/use-solo-game.test.ts`
Expected: FAIL — `usesOfficialPool` doesn't exist on `SoloGame` yet, and `createGame` doesn't consult recent-location history.

- [ ] **Step 3: Implement**

In `src/hooks/use-solo-game.ts`:

1. Add the import, alongside the existing ones:

```typescript
import { getRecentLocationKeys, recordSeenLocations } from "@/lib/recent-locations";
```

2. Add a field to the `SoloGame` interface, after `roundStartAt: number;`:

```typescript
  /** True when `locations` came from the official pool (`pickLocations`), not
   * server-fixed or custom-map locations — gates client-side recent-location
   * tracking (see recordSeenLocations in next()). */
  usesOfficialPool: boolean;
```

3. In `createGame`, change:

```typescript
  const picked = hasCustom
    ? fixedOrder
      ? custom.slice(0, count)
      : sampleLocations(custom, count, rng)
    : pickLocations(mapId, count, rng);
```

to:

```typescript
  const picked = hasCustom
    ? fixedOrder
      ? custom.slice(0, count)
      : sampleLocations(custom, count, rng)
    : pickLocations(mapId, count, rng, getRecentLocationKeys(mapId));
```

4. In `createGame`'s return statement, add `usesOfficialPool: !hasCustom,` after `roundStartAt: Date.now(),`.

5. Replace the `next` callback with:

```typescript
  const next = useCallback(() => {
    setGame((prev) => {
      if (prev.phase !== "reveal") return prev;
      if (prev.mode === "survival") {
        // Survive only if the just-revealed round named the correct country.
        // A miss (or exhausting the buffer) ends the run.
        const last = prev.results[prev.results.length - 1];
        const survived = !!last && last.countryCorrect;
        if (!survived || prev.round >= prev.locations.length) {
          if (prev.usesOfficialPool) {
            recordSeenLocations(prev.mapId, prev.locations.slice(0, prev.round));
          }
          return { ...prev, phase: "finished" };
        }
        return { ...prev, round: prev.round + 1, phase: "guessing", roundStartAt: Date.now() };
      }
      if (prev.round >= prev.settings.rounds) {
        if (prev.usesOfficialPool) {
          recordSeenLocations(prev.mapId, prev.locations.slice(0, prev.round));
        }
        return { ...prev, phase: "finished" };
      }
      return { ...prev, round: prev.round + 1, phase: "guessing", roundStartAt: Date.now() };
    });
    setGuess(null);
  }, []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/use-solo-game.test.ts`
Expected: PASS — including every pre-existing test in this file.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-solo-game.ts src/hooks/use-solo-game.test.ts
git commit -m "feat(use-solo-game): dedup official-pool picks against local history"
```

---

### Task 8: Wire into local party mode + full verification pass

**Files:**
- Modify: `src/hooks/use-local-party-game.ts`
- Modify: `README.md:108-109` (Status list)

**Interfaces:**
- Consumes: `getRecentLocationKeys`, `recordSeenLocations` from Task 6.

- [ ] **Step 1: Wire local party mode**

In `src/hooks/use-local-party-game.ts`:

1. Add the import, alongside the existing ones:

```typescript
import { getRecentLocationKeys, recordSeenLocations } from "@/lib/recent-locations";
```

2. In `createGame`, change:

```typescript
  const locations = pickLocations(mapId, settings.rounds, rng);
```

to:

```typescript
  const locations = pickLocations(mapId, settings.rounds, rng, getRecentLocationKeys(mapId));
```

3. In `continueToNextRound`, change:

```typescript
    setGame((prev) => {
      if (prev.phase !== "roundReveal") return prev;
      if (prev.round >= prev.settings.rounds) return { ...prev, phase: "finished" };
```

to:

```typescript
    setGame((prev) => {
      if (prev.phase !== "roundReveal") return prev;
      if (prev.round >= prev.settings.rounds) {
        recordSeenLocations(prev.mapId, prev.locations);
        return { ...prev, phase: "finished" };
      }
```

This hook has no existing test file — it is manually verified in Step 3 below, consistent with the repo's documented fallback for cases where automated testing isn't already set up for a given surface.

- [ ] **Step 2: Update README Status list**

In `README.md`, immediately after the "✅ Server-authoritative solo & Daily Challenge scoring —" bullet (ends "...a different, accepted trust model)."), insert a new bullet:

```markdown
- ✅ Anti-repeat location tracking — players used to sometimes see the exact
  same round location twice in one session/day (not the hometown easter eggs
  — those are an unrelated, intentional post-hoc override). Every game/room
  used to shuffle its map's pool with a brand-new random seed and no memory of
  prior games. Now `pickMatchLocations`/`sampleLocations` (`convex/gameLogic.ts`)
  draw unseen locations first, falling back to repeats only once the whole
  pool is exhausted (guaranteed on tiny pools like USA's 9 locations if you
  play enough rounds — this is a real, unavoidable limit, not a bug). History
  is a per-(user, map) row (`recentLocations` table) for anyone with a `users`
  row — Clerk-authenticated or ephemeral guest alike — and a parallel
  localStorage mirror (`src/lib/recent-locations.ts`) for fully anonymous,
  no-account play (including local party/couch mode). Daily Challenge and
  shared Survival challenge links are deliberately excluded: both require
  every viewer to see byte-identical locations for a given seed/day.
```

- [ ] **Step 3: Full verification pass**

Run, in order, and confirm each is clean before moving to the next:

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: no type errors, no new lint errors, and every test file passes (including the newly added ones from Tasks 1, 5, 6, 7 and every pre-existing test — especially `src/lib/locations.test.ts`'s "daily challenge locations" suite and `src/hooks/use-solo-game.test.ts`'s "fixedOrder" suite, which must be byte-identical to before).

Then manually verify the actual bug scenario end-to-end (this exercises the `ctx.db`-touching `convex/recentLocations.ts` glue that has no automated test, per Task 2's note):

1. Start the dev server (`npx convex dev` in one terminal, `npm run dev` in another) and confirm the new `recentLocations` table appears in the Convex dashboard schema (a purely additive table — no backfill or migration needed since no existing rows reference it).
2. Signed in, play a 5-round solo game on the small **USA** map (9 locations), then immediately start a second 5-round USA game. Confirm the second game's locations don't overlap the first game's 5 (4 fresh locations remain, so rounds 1-4 of game 2 must be new; round 5 will legitimately repeat — expected and documented above).
3. Signed out (or in an incognito window), play two quick **World**-map solo games back to back and confirm no repeats (World's pool is 100+, so zero repeats should be observed across two 5-round games).
4. Create a multiplayer room, finish a match, then click "Rematch" and confirm the new match's locations don't repeat the finished match's.
5. Play Daily Challenge and confirm it still shows the same locations to every player that day (unaffected by this change) — e.g. compare with a second browser/incognito session.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-local-party-game.ts README.md
git commit -m "feat(local-party): dedup local-party picks against local history; document anti-repeat fix"
```

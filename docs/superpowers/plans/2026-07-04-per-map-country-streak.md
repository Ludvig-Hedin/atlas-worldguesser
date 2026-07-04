# Per-Map Country Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Segment the existing country-correct streak (`StreakState.country`/`bestCountry`) per map instead of one flat global counter, so a streak on "usa" and a streak on "world" no longer share the same number, and surface it in the UI.

**Architecture:** `StreakState` gains `countryByMap: Record<string, {current, best}>`. `foldGame` gains a required `mapId` input and bumps only that map's entry. The old flat `country`/`bestCountry` fields are kept on the Convex schema **as deprecated-optional** (Convex refuses to drop a field that existing rows still populate — see Task 2) and folded into `countryByMap.world` lazily on read via a shared pure helper, `resolveCountryByMap`. Four `foldGame` call sites (convex/users.ts, convex/solo.ts, convex/rooms.ts, src/lib/local-profile.ts) thread `mapId` through; two read-only paths (`publicProfile` in convex/users.ts, `loadProfile` in src/lib/local-profile.ts) apply the same fold for display without needing a game to be played.

**Tech Stack:** TypeScript, Convex, Next.js App Router, Vitest.

## Global Constraints

- Convex schema evolution: a field cannot be removed while existing documents still hold it — mark deprecated fields `v.optional()` instead (confirmed via Convex docs: "Convex will not let you remove a field from a schema if that field still has data in the database").
- Every locale in `src/lib/i18n/{sv,pl,uk,lt}.ts` must have every key `en.ts` has, no extras, no empty strings (enforced by `src/lib/i18n/dictionaries.test.ts`) — any new `t()` key added to `en.ts` needs all four translated.
- `README.md`'s Status list must reflect this change in the same commit per this repo's `AGENTS.md`.
- No destructive migration script — fold-on-read only, per the task spec.
- Do not touch `src/lib/achievements.ts` — nothing keys off `streaks.country` today; out of scope.

---

### Task 1: `StreakState` gains per-map streaks + legacy fold helper

**Files:**
- Modify: `src/lib/progression.ts`
- Modify: `src/lib/progression.test.ts`

**Interfaces:**
- Produces: `CountryMapStreak { current: number; best: number }`, `StreakState { daily, lastPlayedDay, win, bestWin, countryByMap: Record<string, CountryMapStreak> }`, `EMPTY_STREAKS: StreakState`, `resolveCountryByMap(streaks: { countryByMap?: Record<string, CountryMapStreak>; country?: number; bestCountry?: number }): Record<string, CountryMapStreak>`, `bestCountryStreakOf(countryByMap: Record<string, CountryMapStreak>): number | undefined` (max `.best` across all maps, `undefined` if empty — shared by Task 8's two profile pages instead of being duplicated), `ProgressionInput` gains required `mapId: string`, `foldGame(input: ProgressionInput): ProgressionOutput` (same signature otherwise).
- Consumes: nothing new from other tasks.

- [ ] **Step 1: Rewrite the failing tests first**

Replace `src/lib/progression.test.ts` in full with:

```typescript
import { describe, expect, it } from "vitest";
import { foldGame, resolveCountryByMap, bestCountryStreakOf, EMPTY_STREAKS, isSoloWin } from "./progression";
import { EMPTY_STATS, type RoundResult } from "./types";

const perfect: RoundResult = {
  round: 1,
  actual: { lat: 48.85, lng: 2.35, countryCode: "FR" },
  guess: { lat: 48.85, lng: 2.35 },
  distanceMeters: 10,
  score: 5000,
  timeMs: 1000,
  guessCountryCode: "FR",
  countryCorrect: true,
};
const missed: RoundResult = {
  round: 2,
  actual: { lat: 35.68, lng: 139.75, countryCode: "JP" },
  guess: null,
  distanceMeters: 15_000_000,
  score: 0,
  timeMs: 2000,
  guessCountryCode: null,
  countryCorrect: false,
};

const NOW = 1_700_000_000_000;

describe("foldGame", () => {
  it("accumulates stats and xp", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.stats.gamesPlayed).toBe(1);
    expect(out.stats.roundsPlayed).toBe(2);
    expect(out.stats.bestScore).toBe(5000);
    expect(out.stats.countryCorrect).toBe(1);
    expect(out.stats.countryTotal).toBe(1); // only one round had a guess
    expect(out.xpGained).toBe(1100); // 1000 + 100 pinpoint bonus
    expect(out.stats.xp).toBe(1100);
    expect(out.totalScore).toBe(5000);
  });

  it("unlocks the expected achievements", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.newAchievements).toContain("first_game");
    expect(out.newAchievements).toContain("bullseye");
    expect(out.newAchievements).toContain("local_expert");
  });

  it("unlocks a curated building on a correct country guess", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.newBuildings).toEqual(["FR"]);
  });

  it("does not re-unlock an already-owned building", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: ["FR"],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.newBuildings).toEqual([]);
  });

  it("resets the country streak on a wrong round", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS, countryByMap: { world: { current: 3, best: 3 } } },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.streaks.countryByMap.world.current).toBe(0);
    expect(out.streaks.daily).toBe(1);
  });

  it("records a country-streak peak that breaks before the game ends", () => {
    // 3 (carried) + 1 correct = 4, then broken by the miss: the peak must
    // still land in best even though the live streak ends at 0.
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS, countryByMap: { world: { current: 3, best: 3 } } },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect, missed],
      now: NOW,
      mapId: "world",
    });
    expect(out.streaks.countryByMap.world.current).toBe(0);
    expect(out.streaks.countryByMap.world.best).toBe(4);
  });

  it("tracks separate maps independently", () => {
    // A 3-streak on "usa" must not leak into "world"'s counter for the same user.
    const withUsaStreak = {
      ...EMPTY_STREAKS,
      countryByMap: { usa: { current: 3, best: 3 } },
    };
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: withUsaStreak,
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [perfect],
      now: NOW,
      mapId: "world",
    });
    expect(out.streaks.countryByMap.world).toEqual({ current: 1, best: 1 });
    expect(out.streaks.countryByMap.usa).toEqual({ current: 3, best: 3 });
  });

  it("honors a multiplayer win override", () => {
    const out = foldGame({
      stats: { ...EMPTY_STATS },
      streaks: { ...EMPTY_STREAKS },
      ownedAchievements: [],
      unlockedBuildings: [],
      results: [missed],
      now: NOW,
      mapId: "world",
      wonOverride: true,
    });
    expect(out.won).toBe(true);
    expect(out.stats.wins).toBe(1);
    expect(out.streaks.win).toBe(1);
  });
});

describe("isSoloWin", () => {
  it("requires 60% of the max", () => {
    expect(isSoloWin(15_000, 5)).toBe(true); // 60% of 25000
    expect(isSoloWin(14_999, 5)).toBe(false);
    expect(isSoloWin(100, 0)).toBe(false);
  });
});

describe("resolveCountryByMap", () => {
  it("returns countryByMap unchanged when already migrated", () => {
    const map = { world: { current: 2, best: 5 } };
    expect(resolveCountryByMap({ countryByMap: map, country: 99, bestCountry: 99 })).toBe(map);
  });

  it("folds a legacy flat country/bestCountry pair into world", () => {
    expect(resolveCountryByMap({ country: 3, bestCountry: 7 })).toEqual({
      world: { current: 3, best: 7 },
    });
  });

  it("returns an empty map for a brand-new account with nothing to fold", () => {
    expect(resolveCountryByMap({})).toEqual({});
  });
});

describe("bestCountryStreakOf", () => {
  it("returns the max best across every map", () => {
    expect(bestCountryStreakOf({ world: { current: 1, best: 5 }, usa: { current: 0, best: 9 } })).toBe(9);
  });

  it("returns undefined for an empty map", () => {
    expect(bestCountryStreakOf({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/progression.test.ts`
Expected: FAIL — `resolveCountryByMap` is not exported, `countryByMap` does not exist on `StreakState`, `mapId` is missing from `ProgressionInput`.

- [ ] **Step 3: Implement the new shape in `src/lib/progression.ts`**

Replace lines 16–32 (the `StreakState` interface and `EMPTY_STREAKS` constant) with:

```typescript
export interface CountryMapStreak {
  current: number;
  best: number;
}

export interface StreakState {
  daily: number;
  lastPlayedDay: number;
  win: number;
  bestWin: number;
  /** Country-correct streak, segmented per map id (e.g. "world", "usa"). */
  countryByMap: Record<string, CountryMapStreak>;
}

export const EMPTY_STREAKS: StreakState = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  countryByMap: {},
};

/**
 * Pre-per-map streaks stored one flat `country`/`bestCountry` pair — implicitly
 * the "world" map, since Survival always played World before this shipped. Fold
 * it into `countryByMap.world` exactly once: if `countryByMap` is already
 * present the account has migrated, and any lingering legacy numbers in
 * storage are ignored from then on.
 */
export function resolveCountryByMap(streaks: {
  countryByMap?: Record<string, CountryMapStreak>;
  country?: number;
  bestCountry?: number;
}): Record<string, CountryMapStreak> {
  if (streaks.countryByMap) return streaks.countryByMap;
  if (!streaks.country && !streaks.bestCountry) return {};
  return { world: { current: streaks.country ?? 0, best: streaks.bestCountry ?? 0 } };
}

/** Best streak across every map — used for the profile page's aggregate summary. */
export function bestCountryStreakOf(
  countryByMap: Record<string, CountryMapStreak>,
): number | undefined {
  const bests = Object.values(countryByMap).map((m) => m.best);
  return bests.length ? Math.max(...bests) : undefined;
}
```

Update `ProgressionInput` (currently lines 39–49) to add `mapId`:

```typescript
export interface ProgressionInput {
  stats: PlayerStats;
  streaks: StreakState;
  ownedAchievements: string[];
  /** Country codes with a building avatar already unlocked. */
  unlockedBuildings: string[];
  results: RoundResult[];
  now: number;
  /** Which map's streak counter this game bumps (e.g. "world", "usa"). */
  mapId: string;
  /** Override the "won" determination (e.g. multiplayer placement). */
  wonOverride?: boolean;
}
```

Inside `foldGame`, replace the destructure and the country-streak block (currently):

```typescript
const { stats: prev, streaks: s, ownedAchievements, results, now } = input;
```

with:

```typescript
const { stats: prev, streaks: s, ownedAchievements, results, now, mapId } = input;
```

Replace the existing country-streak tracking block:

```typescript
  // Track the peak inside the game too — a streak that breaks before the last
  // round would otherwise never be recorded in bestCountry.
  let country = s.country;
  let bestCountry = s.bestCountry;
  for (const r of results) {
    country = r.countryCorrect ? country + 1 : 0;
    bestCountry = Math.max(bestCountry, country);
  }

  const streaks: StreakState = {
    daily,
    lastPlayedDay: today,
    win,
    bestWin: Math.max(s.bestWin, win),
    country,
    bestCountry,
  };

  const ctx: AchievementContext = {
    stats,
    streaks: { daily: streaks.daily, win: streaks.win, country: streaks.country },
    lastGame: { results, totalScore, perfectRounds, won },
  };
```

with:

```typescript
  // Track the peak inside the game too — a streak that breaks before the last
  // round would otherwise never be recorded as this map's best.
  const prevMapStreak = s.countryByMap[mapId] ?? { current: 0, best: 0 };
  let country = prevMapStreak.current;
  let best = prevMapStreak.best;
  for (const r of results) {
    country = r.countryCorrect ? country + 1 : 0;
    best = Math.max(best, country);
  }
  const countryByMap: Record<string, CountryMapStreak> = {
    ...s.countryByMap,
    [mapId]: { current: country, best },
  };

  const streaks: StreakState = {
    daily,
    lastPlayedDay: today,
    win,
    bestWin: Math.max(s.bestWin, win),
    countryByMap,
  };

  const ctx: AchievementContext = {
    stats,
    streaks: { daily: streaks.daily, win: streaks.win, country },
    lastGame: { results, totalScore, perfectRounds, won },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/progression.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck (will show downstream breakage — expected until later tasks land)**

Run: `bun run typecheck`
Expected: errors in `convex/users.ts`, `convex/solo.ts`, `convex/rooms.ts`, `src/lib/local-profile.ts` (they still pass the old `streaks`/no-`mapId` shape) — these are fixed in Tasks 3–6. Confirm there are **no** errors reported inside `src/lib/progression.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add src/lib/progression.ts src/lib/progression.test.ts
git commit -m "feat(progression): segment country streak per map"
```

---

### Task 2: Convex schema — deprecate flat fields, add `countryByMap`

**Files:**
- Modify: `convex/schema.ts:59-66`

**Interfaces:**
- Produces: `users.streaks` document shape `{ daily: number; lastPlayedDay: number; win: number; bestWin: number; country?: number; bestCountry?: number; countryByMap?: Record<string, {current: number; best: number}> }`.
- Consumes: nothing.

- [ ] **Step 1: Edit the schema**

In `convex/schema.ts`, replace:

```typescript
    streaks: v.object({
      daily: v.number(),
      lastPlayedDay: v.number(),
      win: v.number(),
      bestWin: v.number(),
      country: v.number(),
      bestCountry: v.number(),
    }),
```

with:

```typescript
    streaks: v.object({
      daily: v.number(),
      lastPlayedDay: v.number(),
      win: v.number(),
      bestWin: v.number(),
      // Deprecated: the old flat, cross-map country streak (implicitly the
      // "world" map). Convex can't drop a field existing rows still hold, so
      // this stays optional-and-unwritten going forward; new writes only set
      // countryByMap. Folded into countryByMap.world on read — see
      // resolveCountryByMap in src/lib/progression.ts.
      country: v.optional(v.number()),
      bestCountry: v.optional(v.number()),
      countryByMap: v.optional(
        v.record(v.string(), v.object({ current: v.number(), best: v.number() })),
      ),
    }),
```

- [ ] **Step 2: Push the schema and confirm it's accepted**

Run: `bunx convex dev --once`
Expected: succeeds with no schema validation error (existing rows still carrying `country`/`bestCountry` remain valid because those fields are now optional-with-value, which satisfies the validator).

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): deprecate flat country streak fields, add countryByMap"
```

---

### Task 3: `convex/users.ts` — streaksShape, EMPTY_STREAKS, publicProfile fold, applySoloResults

**Files:**
- Modify: `convex/users.ts`

**Interfaces:**
- Consumes: `resolveCountryByMap` from `../src/lib/progression` (Task 1), `foldGame`'s new required `mapId` input (Task 1), the schema's optional `country`/`bestCountry`/`countryByMap` on `streaks` (Task 2).
- Produces: `publicProfile(user)` now returns a fully-migrated `streaks` shape (`{ daily, lastPlayedDay, win, bestWin, countryByMap: Record<string, {current,best}> }`, no legacy fields) — `src/components/profile/public-profile.tsx` and `guest-profile.tsx`'s `CloudProfile` read `profile.streaks.countryByMap` off this.

- [ ] **Step 1: Update imports**

At the top of `convex/users.ts`, change:

```typescript
import { foldGame } from "../src/lib/progression";
```

to:

```typescript
import { foldGame, resolveCountryByMap } from "../src/lib/progression";
```

- [ ] **Step 2: Update `streaksShape` and `EMPTY_STREAKS`**

Replace:

```typescript
const streaksShape = {
  daily: v.number(),
  lastPlayedDay: v.number(),
  win: v.number(),
  bestWin: v.number(),
  country: v.number(),
  bestCountry: v.number(),
};
```

with:

```typescript
// Shape of the streaks payload a client (guest → cloud import) sends. The
// client always normalizes to the current shape before sending (see
// loadProfile in src/lib/local-profile.ts) — legacy country/bestCountry are
// never sent, only the DB-side schema.ts still carries them for old rows.
const streaksShape = {
  daily: v.number(),
  lastPlayedDay: v.number(),
  win: v.number(),
  bestWin: v.number(),
  countryByMap: v.optional(
    v.record(v.string(), v.object({ current: v.number(), best: v.number() })),
  ),
};
```

Replace:

```typescript
const EMPTY_STREAKS = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  country: 0,
  bestCountry: 0,
};
```

with:

```typescript
const EMPTY_STREAKS = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  countryByMap: {},
};
```

- [ ] **Step 3: Fold legacy streaks in `publicProfile`**

Replace:

```typescript
function publicProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarBuildingId: user.avatarBuildingId,
    avatarColor: user.avatarColor,
    unlockedBuildings: user.unlockedBuildings ?? [],
    xp: user.xp,
    level: levelForXp(user.xp),
    stats: user.stats,
    streaks: user.streaks,
    createdAt: user.createdAt,
  };
}
```

with:

```typescript
function publicProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarBuildingId: user.avatarBuildingId,
    avatarColor: user.avatarColor,
    unlockedBuildings: user.unlockedBuildings ?? [],
    xp: user.xp,
    level: levelForXp(user.xp),
    stats: user.stats,
    streaks: {
      daily: user.streaks.daily,
      lastPlayedDay: user.streaks.lastPlayedDay,
      win: user.streaks.win,
      bestWin: user.streaks.bestWin,
      countryByMap: resolveCountryByMap(user.streaks),
    },
    createdAt: user.createdAt,
  };
}
```

- [ ] **Step 4: Thread `mapId` + resolved streaks into `applySoloResults`' `foldGame` call**

In `applySoloResults`, replace:

```typescript
  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: user.streaks,
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
  });
```

with:

```typescript
  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: { ...user.streaks, countryByMap: resolveCountryByMap(user.streaks) },
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
    mapId,
  });
```

(`mapId` is already a parameter of `applySoloResults` — no signature change needed.)

- [ ] **Step 5: Update `importGuestProfile`'s clamp block**

Replace:

```typescript
    const streaks = {
      daily: clampInt(args.streaks.daily, 100_000),
      lastPlayedDay: clampInt(args.streaks.lastPlayedDay, Number.MAX_SAFE_INTEGER),
      win: clampInt(args.streaks.win, 100_000),
      bestWin: clampInt(args.streaks.bestWin, 100_000),
      country: clampInt(args.streaks.country, 10_000_000),
      bestCountry: clampInt(args.streaks.bestCountry, 10_000_000),
    };
```

with:

```typescript
    // Cap both the number of distinct maps and each map's counters — a
    // malicious/buggy client shouldn't be able to smuggle an unbounded record
    // into a single document write.
    const MAX_COUNTRY_MAP_ENTRIES = 64;
    const countryByMap: Record<string, { current: number; best: number }> = {};
    for (const [mapId, entry] of Object.entries(args.streaks.countryByMap ?? {}).slice(
      0,
      MAX_COUNTRY_MAP_ENTRIES,
    )) {
      countryByMap[mapId.slice(0, 32)] = {
        current: clampInt(entry.current, 10_000_000),
        best: clampInt(entry.best, 10_000_000),
      };
    }
    const streaks = {
      daily: clampInt(args.streaks.daily, 100_000),
      lastPlayedDay: clampInt(args.streaks.lastPlayedDay, Number.MAX_SAFE_INTEGER),
      win: clampInt(args.streaks.win, 100_000),
      bestWin: clampInt(args.streaks.bestWin, 100_000),
      countryByMap,
    };
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: `convex/users.ts` now clean. Remaining errors (if any) are in `convex/solo.ts` and `convex/rooms.ts`, fixed next.

- [ ] **Step 7: Commit**

```bash
git add convex/users.ts
git commit -m "feat(users): per-map streaks in publicProfile, applySoloResults, importGuestProfile"
```

---

### Task 4: `convex/solo.ts` — thread `mapId` into `persistSoloGame`'s `foldGame` call

**Files:**
- Modify: `convex/solo.ts`

**Interfaces:**
- Consumes: `resolveCountryByMap` from `../src/lib/progression`, `foldGame`'s new `mapId` input (Task 1).

- [ ] **Step 1: Update the import**

Replace:

```typescript
import { foldGame } from "../src/lib/progression";
```

with:

```typescript
import { foldGame, resolveCountryByMap } from "../src/lib/progression";
```

- [ ] **Step 2: Update the `foldGame` call in `persistSoloGame`**

Replace:

```typescript
  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: user.streaks,
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
  });
```

with:

```typescript
  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: { ...user.streaks, countryByMap: resolveCountryByMap(user.streaks) },
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
    mapId,
  });
```

(`mapId` is already a parameter of `persistSoloGame` — no signature change needed.)

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: `convex/solo.ts` clean.

- [ ] **Step 4: Commit**

```bash
git add convex/solo.ts
git commit -m "feat(solo): thread mapId into persistSoloGame's foldGame call"
```

---

### Task 5: `convex/rooms.ts` — thread `mapId` into `finishMatch`'s `foldGame` call

**Files:**
- Modify: `convex/rooms.ts`

**Interfaces:**
- Consumes: `resolveCountryByMap` from `../src/lib/progression`, `foldGame`'s new `mapId` input (Task 1).

- [ ] **Step 1: Add the import**

Find the existing `import { foldGame } from "../src/lib/progression";` line in `convex/rooms.ts` and replace with:

```typescript
import { foldGame, resolveCountryByMap } from "../src/lib/progression";
```

- [ ] **Step 2: Update the `foldGame` call inside `finishMatch`**

Replace:

```typescript
      const out = foldGame({
        stats: { ...user.stats, xp: user.xp },
        streaks: user.streaks,
        ownedAchievements: owned.map((a) => a.achievementId),
        unlockedBuildings: user.unlockedBuildings ?? [],
        results,
        now,
        wonOverride: won,
      });
```

with:

```typescript
      const out = foldGame({
        stats: { ...user.stats, xp: user.xp },
        streaks: { ...user.streaks, countryByMap: resolveCountryByMap(user.streaks) },
        ownedAchievements: owned.map((a) => a.achievementId),
        unlockedBuildings: user.unlockedBuildings ?? [],
        results,
        now,
        mapId: room.mapId,
        wonOverride: won,
      });
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: fully clean across `convex/` now (modulo Task 6's client-side fixes).

- [ ] **Step 4: Commit**

```bash
git add convex/rooms.ts
git commit -m "feat(rooms): thread mapId into finishMatch's foldGame call"
```

---

### Task 6: `src/lib/local-profile.ts` — legacy fold on read, `mapId` in `applyGame`, new tests

**Files:**
- Modify: `src/lib/local-profile.ts`
- Create: `src/lib/local-profile.test.ts`

**Interfaces:**
- Consumes: `resolveCountryByMap`, `StreakState` from `./progression` (Task 1).
- Produces: `loadProfile()` always returns a fully-migrated `streaks.countryByMap` (no legacy leakage); `guestImportPayload(profile)` never emits `country`/`bestCountry` (so it satisfies the narrowed `streaksShape` from Task 3 without a Convex arg-validation error).

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/local-profile.test.ts`:

```typescript
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  applyGame,
  emptyProfile,
  guestImportPayload,
  loadProfile,
  saveProfile,
  type LocalProfile,
} from "./local-profile";
import { EMPTY_STREAKS } from "./progression";
import type { RoundResult } from "./types";

const perfect: RoundResult = {
  round: 1,
  actual: { lat: 48.85, lng: 2.35, countryCode: "FR" },
  guess: { lat: 48.85, lng: 2.35 },
  distanceMeters: 10,
  score: 5000,
  timeMs: 1000,
  guessCountryCode: "FR",
  countryCorrect: true,
};

describe("applyGame", () => {
  it("segments the country streak by mapId", () => {
    const profile = emptyProfile();
    const afterWorld = applyGame(profile, { id: "g1", mapId: "world", results: [perfect] });
    const afterUsa = applyGame(afterWorld.profile, { id: "g2", mapId: "usa", results: [perfect] });

    expect(afterUsa.profile.streaks.countryByMap.world).toEqual({ current: 1, best: 1 });
    expect(afterUsa.profile.streaks.countryByMap.usa).toEqual({ current: 1, best: 1 });
  });
});

describe("loadProfile", () => {
  const STORAGE_KEY = "atlas:profile:v1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("folds a legacy flat country/bestCountry pair into countryByMap.world", () => {
    const legacy = {
      username: "Guest",
      stats: { gamesPlayed: 1, roundsPlayed: 1, wins: 0, bestScore: 5000, totalDistanceMeters: 10, countryCorrect: 1, countryTotal: 1, xp: 1100 },
      streaks: { daily: 1, lastPlayedDay: 20000, win: 0, bestWin: 0, country: 4, bestCountry: 6 },
      achievements: [],
      unlockedBuildings: [],
      recent: [],
      flag: { bests: {}, gamesPlayed: 0 },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    const profile = loadProfile();
    expect(profile.streaks.countryByMap).toEqual({ world: { current: 4, best: 6 } });
    // The legacy fields must not leak into the normalized in-memory shape.
    expect(profile.streaks).not.toHaveProperty("country");
    expect(profile.streaks).not.toHaveProperty("bestCountry");
  });

  it("leaves an already-migrated countryByMap untouched", () => {
    const migrated: LocalProfile = {
      ...emptyProfile(),
      streaks: { ...EMPTY_STREAKS, countryByMap: { usa: { current: 2, best: 9 } } },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

    const profile = loadProfile();
    expect(profile.streaks.countryByMap).toEqual({ usa: { current: 2, best: 9 } });
  });

  it("defaults to an empty countryByMap for a brand-new profile", () => {
    expect(loadProfile().streaks.countryByMap).toEqual({});
  });
});

describe("guestImportPayload", () => {
  it("never emits legacy country/bestCountry fields", () => {
    const profile: LocalProfile = {
      ...emptyProfile(),
      streaks: { ...EMPTY_STREAKS, countryByMap: { world: { current: 1, best: 1 } } },
    };
    const payload = guestImportPayload(profile);
    expect(payload.streaks).not.toHaveProperty("country");
    expect(payload.streaks).not.toHaveProperty("bestCountry");
    expect(payload.streaks.countryByMap).toEqual({ world: { current: 1, best: 1 } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/local-profile.test.ts`
Expected: FAIL — `applyGame` rejects the call (missing `mapId` on `ProgressionInput` propagation causes a type error at build, but at runtime `foldGame` will still execute with `mapId: undefined`, so the streak key becomes `"undefined"` instead of `"world"`/`"usa"` — either way the assertions fail); `loadProfile`'s naive spread-merge does not fold `country`/`bestCountry` into `countryByMap`.

- [ ] **Step 3: Update `applyGame` to thread `mapId`**

In `src/lib/local-profile.ts`, replace:

```typescript
export function applyGame(
  profile: LocalProfile,
  game: GameSummary,
  now = Date.now(),
): ApplyResult {
  const out = foldGame({
    stats: profile.stats,
    streaks: profile.streaks,
    ownedAchievements: profile.achievements,
    unlockedBuildings: profile.unlockedBuildings,
    results: game.results,
    now,
  });
```

with:

```typescript
export function applyGame(
  profile: LocalProfile,
  game: GameSummary,
  now = Date.now(),
): ApplyResult {
  const out = foldGame({
    stats: profile.stats,
    streaks: profile.streaks,
    ownedAchievements: profile.achievements,
    unlockedBuildings: profile.unlockedBuildings,
    results: game.results,
    now,
    mapId: game.mapId,
  });
```

- [ ] **Step 4: Rewrite `loadProfile` to fold legacy streaks explicitly**

Add the import at the top of the file:

```typescript
import { EMPTY_STREAKS, foldGame, isSoloWin, resolveCountryByMap, type StreakState } from "./progression";
```

(replacing the existing `import { EMPTY_STREAKS, foldGame, isSoloWin, type StreakState } from "./progression";`)

Replace the `loadProfile` function body:

```typescript
export function loadProfile(): LocalProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      ...emptyProfile(),
      ...parsed,
      stats: { ...EMPTY_STATS, ...parsed.stats },
      streaks: { ...EMPTY_STREAKS, ...parsed.streaks },
      achievements: parsed.achievements ?? [],
      unlockedBuildings: parsed.unlockedBuildings ?? [],
      recent: parsed.recent ?? [],
      flag: {
        bests: parsed.flag?.bests ?? {},
        gamesPlayed: parsed.flag?.gamesPlayed ?? 0,
      },
    };
  } catch {
    return emptyProfile();
  }
}
```

with:

```typescript
export function loadProfile(): LocalProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<LocalProfile> & {
      streaks?: Partial<StreakState> & { country?: number; bestCountry?: number };
    };
    const rawStreaks = parsed.streaks;
    // Rebuild explicitly (not a blind spread) so a pre-migration profile's
    // legacy `country`/`bestCountry` gets folded into countryByMap.world and
    // never leaks into the normalized in-memory/re-saved shape.
    const streaks: StreakState = {
      daily: rawStreaks?.daily ?? EMPTY_STREAKS.daily,
      lastPlayedDay: rawStreaks?.lastPlayedDay ?? EMPTY_STREAKS.lastPlayedDay,
      win: rawStreaks?.win ?? EMPTY_STREAKS.win,
      bestWin: rawStreaks?.bestWin ?? EMPTY_STREAKS.bestWin,
      countryByMap: rawStreaks ? resolveCountryByMap(rawStreaks) : {},
    };
    return {
      ...emptyProfile(),
      ...parsed,
      stats: { ...EMPTY_STATS, ...parsed.stats },
      streaks,
      achievements: parsed.achievements ?? [],
      unlockedBuildings: parsed.unlockedBuildings ?? [],
      recent: parsed.recent ?? [],
      flag: {
        bests: parsed.flag?.bests ?? {},
        gamesPlayed: parsed.flag?.gamesPlayed ?? 0,
      },
    };
  } catch {
    return emptyProfile();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run src/lib/local-profile.test.ts`
Expected: PASS.

- [ ] **Step 6: Full typecheck**

Run: `bun run typecheck`
Expected: clean across the whole repo (no remaining `foldGame`/`StreakState` mismatches).

- [ ] **Step 7: Commit**

```bash
git add src/lib/local-profile.ts src/lib/local-profile.test.ts
git commit -m "feat(local-profile): fold legacy country streak on read, thread mapId"
```

---

### Task 7: `match-results.tsx` — per-map streak card + locale keys

**Files:**
- Modify: `src/components/game/match-results.tsx`
- Modify: `src/lib/i18n/en.ts`, `src/lib/i18n/sv.ts`, `src/lib/i18n/pl.ts`, `src/lib/i18n/uk.ts`, `src/lib/i18n/lt.ts`

**Interfaces:**
- Consumes: `applied.profile.streaks.countryByMap` (`Record<string, {current:number;best:number}>`, from Task 6's `ApplyResult`), `mapNameKey`/`getMapConfig` (already imported in this file).

- [ ] **Step 1: Add locale keys to `src/lib/i18n/en.ts`**

In the `// Solo match results` block, after `"match.levelUp": "Level up! Now level {level}",` add:

```typescript
  "match.countryStreak": "{map} streak",
  "match.countryStreakCurrent": "Current",
  "match.countryStreakBest": "Best",
```

- [ ] **Step 2: Add the matching keys to every other locale**

In `src/lib/i18n/sv.ts`, same insertion point, add:

```typescript
  "match.countryStreak": "{map}-serie",
  "match.countryStreakCurrent": "Nuvarande",
  "match.countryStreakBest": "Bästa",
```

In `src/lib/i18n/pl.ts`:

```typescript
  "match.countryStreak": "Seria: {map}",
  "match.countryStreakCurrent": "Obecna",
  "match.countryStreakBest": "Najlepsza",
```

In `src/lib/i18n/uk.ts`:

```typescript
  "match.countryStreak": "Серія: {map}",
  "match.countryStreakCurrent": "Поточна",
  "match.countryStreakBest": "Найкраща",
```

In `src/lib/i18n/lt.ts`:

```typescript
  "match.countryStreak": "{map} serija",
  "match.countryStreakCurrent": "Dabartinė",
  "match.countryStreakBest": "Geriausia",
```

- [ ] **Step 3: Run the dictionary parity test**

Run: `bun run vitest run src/lib/i18n/dictionaries.test.ts`
Expected: PASS (every locale still covers every English key, no extras, no empties).

- [ ] **Step 4: Add the streak card to `MatchResults`**

In `src/components/game/match-results.tsx`, add a computed `mapStreak` const alongside the other top-of-component computed values. Replace:

```typescript
  const level = levelProgress(applied.profile.stats.xp);
```

with:

```typescript
  const level = levelProgress(applied.profile.stats.xp);
  const mapStreak = applied.profile.streaks.countryByMap[game.mapId] ?? { current: 0, best: 0 };
```

Then insert a new card immediately before the existing Level card (currently starting `<div className="rounded-2xl border border-border bg-card p-4 shadow-1">` that wraps the `match.level` row). Add, right above that `<div>`:

```tsx
        <div className="rounded-2xl border border-border bg-card p-4 shadow-1">
          <p className="mb-3 text-sm font-medium">
            {t("match.countryStreak", { map: t(mapNameKey(map.id)) })}
          </p>
          <div className="flex gap-6">
            <div>
              <p className="text-xl font-semibold tabular">{formatNumber(mapStreak.current)}</p>
              <p className="text-xs text-muted-foreground">{t("match.countryStreakCurrent")}</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular">{formatNumber(mapStreak.best)}</p>
              <p className="text-xs text-muted-foreground">{t("match.countryStreakBest")}</p>
            </div>
          </div>
        </div>

```

(Placed directly before the pre-existing `<div className="rounded-2xl border border-border bg-card p-4 shadow-1">` / `match.level` block — both cards then sit adjacent in the same `flex flex-col gap-6` container.)

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/game/match-results.tsx src/lib/i18n/en.ts src/lib/i18n/sv.ts src/lib/i18n/pl.ts src/lib/i18n/uk.ts src/lib/i18n/lt.ts
git commit -m "feat(match-results): show per-map country streak card"
```

---

### Task 8: `stats-grid.tsx` — best-across-all-maps summary

**Files:**
- Modify: `src/components/profile/stats-grid.tsx`
- Modify: `src/components/profile/public-profile.tsx`
- Modify: `src/components/profile/guest-profile.tsx`

**Interfaces:**
- Consumes: `profile.streaks.countryByMap` from the callers (Task 3/6's `publicProfile`/`loadProfile` output).
- Produces: `StatsGridProps` gains optional `bestCountryStreak?: number`.

- [ ] **Step 1: Add the optional prop + card to `StatsGrid`**

In `src/components/profile/stats-grid.tsx`, add the `Award` icon to the existing import:

```typescript
import { Award, Flame, Gamepad2, Globe2, Ruler, Target, Trophy } from "lucide-react";
```

Update `StatsGridProps`:

```typescript
interface StatsGridProps {
  stats: Omit<PlayerStats, "xp">;
  xp: number;
  dailyStreak?: number;
  /** Best country-correct streak across every map. */
  bestCountryStreak?: number;
}
```

Update the function signature and `cards` array:

```typescript
export function StatsGrid({ stats, xp, dailyStreak, bestCountryStreak }: StatsGridProps) {
  const level = levelProgress(xp);
  const avgDistance = stats.roundsPlayed > 0 ? stats.totalDistanceMeters / stats.roundsPlayed : 0;

  const cards = [
    { icon: Gamepad2, label: "Games", value: formatNumber(stats.gamesPlayed) },
    {
      icon: Trophy,
      label: "Wins",
      value: formatNumber(stats.wins),
      sub: formatPercent(stats.wins, stats.gamesPlayed),
    },
    { icon: Target, label: "Best score", value: formatNumber(stats.bestScore) },
    { icon: Ruler, label: "Avg distance", value: stats.roundsPlayed ? formatDistance(avgDistance) : "—" },
    {
      icon: Globe2,
      label: "Country accuracy",
      value: formatPercent(stats.countryCorrect, stats.countryTotal),
    },
    { icon: Flame, label: "Daily streak", value: dailyStreak != null ? `${dailyStreak}d` : "—" },
    ...(bestCountryStreak != null
      ? [{ icon: Award, label: "Best country streak", value: formatNumber(bestCountryStreak) }]
      : []),
  ];
```

(Rest of the component — the JSX grid — is unchanged; it already maps over `cards`.)

- [ ] **Step 2: Wire the prop from `public-profile.tsx`**

In `src/components/profile/public-profile.tsx`, add the import (alongside the other `@/lib` imports):

```typescript
import { bestCountryStreakOf } from "@/lib/progression";
```

Replace:

```tsx
      <StatsGrid stats={profile.stats} xp={profile.xp} dailyStreak={profile.streaks.daily} />
```

with:

```tsx
      <StatsGrid
        stats={profile.stats}
        xp={profile.xp}
        dailyStreak={profile.streaks.daily}
        bestCountryStreak={bestCountryStreakOf(profile.streaks.countryByMap)}
      />
```

- [ ] **Step 3: Wire the prop from `guest-profile.tsx`'s `CloudProfile` and `LocalProfileView`**

In `src/components/profile/guest-profile.tsx`, add the same import (alongside the other `@/lib` imports):

```typescript
import { bestCountryStreakOf } from "@/lib/progression";
```

In `CloudProfile`, replace:

```tsx
      <StatsGrid stats={profile.stats} xp={profile.xp} dailyStreak={profile.streaks.daily} />
```

with:

```tsx
      <StatsGrid
        stats={profile.stats}
        xp={profile.xp}
        dailyStreak={profile.streaks.daily}
        bestCountryStreak={bestCountryStreakOf(profile.streaks.countryByMap)}
      />
```

In `LocalProfileView`, replace:

```tsx
      <StatsGrid stats={profile.stats} xp={profile.stats.xp} dailyStreak={profile.streaks.daily} />
```

with:

```tsx
      <StatsGrid
        stats={profile.stats}
        xp={profile.stats.xp}
        dailyStreak={profile.streaks.daily}
        bestCountryStreak={bestCountryStreakOf(profile.streaks.countryByMap)}
      />
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/stats-grid.tsx src/components/profile/public-profile.tsx src/components/profile/guest-profile.tsx
git commit -m "feat(profile): surface best country streak across all maps"
```

---

### Task 9: Docs + full verification pass

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README Status bullet**

In `README.md`'s `## Status` section, replace:

```markdown
- ✅ Core solo gameplay — modes (World / Europe / USA / Countries), difficulty
  (Moving / No Move / NMPZ), rounds, timer, scoring, reveal, match results,
  XP/levels, achievements, streaks, guest history.
```

with:

```markdown
- ✅ Core solo gameplay — modes (World / Europe / USA / Countries), difficulty
  (Moving / No Move / NMPZ), rounds, timer, scoring, reveal, match results,
  XP/levels, achievements, guest history. The country-correct streak is
  tracked **per map** (`streaks.countryByMap`, keyed by map id) instead of one
  flat global counter, shown on the match-results screen and as a
  best-across-all-maps summary on the profile page (`src/lib/progression.ts`
  `foldGame`, `convex/schema.ts` `users.streaks`). Pre-existing accounts'
  single flat streak is folded into the "world" map key lazily on read
  (`resolveCountryByMap`), no migration script needed.
```

- [ ] **Step 2: Run the full test suite**

Run: `bun run vitest run`
Expected: all tests pass, including `progression.test.ts`, `local-profile.test.ts`, `dictionaries.test.ts`, `i18n.test.ts`.

- [ ] **Step 3: Full typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: clean.

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: succeeds.

- [ ] **Step 5: Manual verification (dev server)**

Run: `bunx convex dev` (in one terminal) and `bun run dev` (in another), then in the browser:
1. As a signed-in user, play a Survival run on the World map, then a Survival run on the USA map. Confirm the match-results streak card shows independent current/best numbers per map, and the profile page's "Best country streak" card shows the max across both.
2. As a guest (signed out, `features.auth` on), repeat the same two-map test and confirm `localStorage["atlas:profile:v1"]` accumulates `streaks.countryByMap` with both `world` and `usa` keys.
3. If there is a pre-existing test account with old flat `streaks.country`/`bestCountry` data (check the Convex dashboard's `users` table for a row with those fields set and no `countryByMap`), load that account's profile page and confirm it now shows a "Best country streak" card reflecting the old flat value folded into `world` — then confirm after playing one more game, the dashboard row's `streaks` field now has `countryByMap` populated (self-migrated on next write).

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: describe per-map country streak in README status"
```

---

## Verification Summary

- `bun run vitest run` — unit coverage for the pure logic (`progression.ts`, `local-profile.ts`) and locale parity.
- `bun run typecheck` — full repo, including all four `foldGame` call sites and the Convex schema.
- `bun run lint`, `bun run build` — no regressions.
- Manual dogfood of the two-map streak scenario as both a signed-in user and a guest, plus one pre-existing-account fold-on-read check, per Task 9 Step 5.

# Phase 2 — Game Modes: Daily Challenge + Survival

## Context
Today a "mode" is only `map × movement × timer`. No rule-variant modes. This phase adds
two real modes, chosen for highest value: **Daily Challenge** (retention/competition) and
**Survival streak** (fun, differentiated). Part of the approved roadmap
(`~/.claude/plans/add-more-maps-and-temporal-raven.md`).

Constraint: the repo is under active concurrent editing. Prefer new files; keep edits to
hot files (`solo-game.tsx`, `use-solo-game.ts`, `play-client.tsx`, `play-setup.tsx`,
`schema.ts`) small and additive; re-read before editing.

## Survival streak (client-only)
Classic GeoGuessr "streak" rule: **guess the correct country to survive; first wrong
country ends the run.** Score = countries in a row. Maps perfectly onto existing
`RoundResult.countryCorrect`.

- **Engine** (`use-solo-game.ts`): add `mode: "classic" | "survival"` to `CreateOpts`/`SoloGame`.
  - `createGame`: survival pre-picks a large buffer (`pickLocations(mapId, 150, rng)`) instead of `settings.rounds`.
  - `next()`: survival advances only if the just-revealed round was `countryCorrect` (and buffer remains); otherwise → `finished`.
  - `submit()` unchanged. Add derived `survivalStreak = results.filter(r => r.countryCorrect).length`.
- **UI** (`solo-game.tsx`): pass `mode` to the hook; when survival, show a streak chip in `GameHUD` (new optional `survivalStreak?` prop) instead of "round X/Y"; `isLastRound` for reveal = the failing round; `MatchResults` shows "N in a row".
- **Persistence:** survival records to the **local** profile (`useLocalProfile`, no round cap). Cloud sync (`recordSoloResult`, 20-round cap) is **skipped** for survival — it stays a casual client-side high-score. Gate `<SoloCloudSync>` to `mode === "classic"`.

## Daily Challenge (backend)
Same 5 world locations for everyone each UTC day; one attempt/day; global leaderboard.

- **Server owns the day's locations.** `day = floor(now / 86_400_000)`. Locations = `pickMatchLocations("world", 5, day)` (already deterministic; seeded easter eggs are identical for everyone → fair).
- **New backend** `convex/dailyChallenge.ts`:
  - `today` (query): `{ day, mapId: "world", settings: {rounds:5,timeLimitSec:0,movement:"moving"}, locations, played }` — `played` = whether the signed-in user already has a `dailyResults` row for today.
  - `submit` (mutation): `requireUser` → rate-limit `dailyRecord` → reject if `day !== serverDay` → enforce one/day via `by_day_user` → validate + server-recompute scores (shared helper, see below) → `foldGame` into user xp/stats/streaks/achievements → insert a `games` row (`mode:"solo"`, `mapId:"world"`) → insert a `dailyResults` row. Returns `{ score, correctCount }`.
  - `leaderboard` (query): `{ day?, limit }` → top N by score for the day (via `by_day_score`) + the caller's own row/rank.
- **Shared helper:** extract the validate-recompute-fold-record core of `recordSoloResult` into `applySoloResults(ctx, user, mapId, settings, results, now)` in `convex/users.ts`; `recordSoloResult` and `dailyChallenge.submit` both call it (submit additionally writes the `dailyResults` row). Avoids duplicating the anti-cheat validation.
- **Schema** (`convex/schema.ts`): add
  ```
  dailyResults: defineTable({
    day: v.number(), userId: v.id("users"), username: v.string(),
    avatarUrl: v.optional(v.string()), score: v.number(), correctCount: v.number(),
    avgDistanceMeters: v.number(), createdAt: v.number(),
  }).index("by_day", ["day"]).index("by_day_user", ["day","userId"]).index("by_day_score", ["day","score"])
  ```
- **Rate limit** (`convex/rateLimit.ts`): add `dailyRecord: { max: 20, windowMs: DAY }` (DB uniqueness is the real cap; this is anti-spam).
- **Client:** new route `/daily` → `DailyClient` (wrapped in `ConvexGate`).
  - Guests: can play for fun; a "sign in to compete" note; no submit.
  - Signed-in, not played: "Play today's challenge" → renders `SoloGame` with `customLocations = today.locations`, `mapId="world"`, fixed settings, `cloudSync={false}`, `onComplete={submit}`.
  - Already played / after submit: show the leaderboard + own result.

## SoloGame reuse (small additive props)
Add to `SoloGame`:
- `mode?: "classic" | "survival"` (default classic) — threads to the hook + HUD.
- `cloudSync?: boolean` (default true) — daily passes false.
- `onComplete?: (results: RoundResult[], game: SoloGame) => void` — fired once in the existing once-only finish effect, alongside the local `record`.

## Entry points
- Daily: a card/link to `/daily` from the landing page and `play-client` (new, additive).
- Survival: `PlaySetup` gains an optional secondary "Survival" action that calls `onStart` with `mode:"survival"` (uses the selected map). `PlayClient.Config` gains `mode?`. Additive.

## Verification
- `bun run typecheck`, `bunx eslint <changed>`, `bunx vitest run`.
- Unit: survival end-condition (fails on first wrong country) + daily determinism (same `day` → same locations) as a pure test where possible.
- Convex: `dailyChallenge` compiles (relative imports only), `by_day_user` blocks a second submit.
- Manual: play a survival run (wrong country ends it, streak shown); play `/daily`, submit, see leaderboard, confirm second submit is rejected.

## Out of scope (flag)
- Anti-cheat on daily (client-scored; same trust model as existing solo sync). Note only.
- Distance-only / Time Attack variants (roadmap 2c).

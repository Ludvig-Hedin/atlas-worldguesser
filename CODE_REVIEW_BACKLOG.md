# Code Review Backlog

## Bug Hunt — 2026-07-03 (changed-files review, session 2)

Focused review of the uncommitted working-tree changes (4 parallel subagents:
Convex backend, solo flow, multiplayer, misc UI). No HIGH-severity/crash bugs
found — the earlier full-repo pass had already hardened the risky paths.

### Auto-fixed (11 issues, validated typecheck ✓ / test 96 ✓ / lint 0-err before the parallel avatar work broke the tree)

- `src/components/multiplayer/room-results.tsx` — FFA winner had no `totalScore > 0`
  guard (the team branch requires `teamTotals.A+B > 0`). An all-AFK / all-zero
  match crowned `standings[0]` as "wins · 0 points". Now `competitive` also
  requires `(winner?.totalScore ?? 0) > 0`, matching the team branch and the
  earlier server-side all-zero walkover fix in `finishMatch`.
- `src/lib/google-maps.ts` — `findPanorama` cache key ignored `radius`: a lookup at
  a non-default radius would return a wrong-radius cached hit/`null`. `panoKey`
  now folds `radius` in.
- `src/lib/google-maps.ts` — transient 10s pano timeouts were cached as permanent
  "no coverage", poisoning a real location (→ reroll/demo) for the whole session
  on one flaky moment. `resolvePano` now reports `{ pano, timedOut }`; `findPanorama`
  skips caching on timeout. (Aligns with the "playable on bad internet" goal.)
- `src/hooks/use-solo-game.ts` — country-lookup retry loop ran 3 attempts back-to-back
  with no delay (a persistent immediate failure burned all tries in ms → false
  "wrong country" that ends a survival run). Added 200ms backoff between attempts.
- `src/lib/utils.ts` (`shuffle`) + `src/lib/locations.ts` (`sampleLocations` pad-loop) —
  `Math.floor(rng() * n)` indexes out of bounds (→ `undefined` entry) if an injected
  `rng()` ever returns exactly 1.0. Real RNGs are `[0,1)` so it's unreachable today,
  but a new regression test (`locations.test.ts`) surfaced that the root was in
  `shuffle`'s Fisher–Yates step (which `sample`/`sampleLocations` flow through), not
  just the pad-loop. Both clamped with `Math.min` (no-op for real RNGs).
- `convex/users.ts` (`bumpUserCount`) + `convex/presence.ts` (`seedUserCount`) —
  read the singleton `appStats` row with `.unique()`, which throws hard if a stray
  duplicate row ever exists (every new-user signup would fail). Switched to `.first()`
  to match the deliberate defensive read in `presence.homeStats`.
- `src/components/multiplayer/room-lobby.tsx` — `leave`/`setReady` fire-and-forget
  mutations had no `.catch` (unhandled promise rejection → dev overlay on network
  failure); `patch`'s error toast assumed `e` is an `Error` (non-Error → blank toast).
  Added `.catch` + `e instanceof Error` guards. (NOTE: this file is also being
  edited by parallel avatar/i18n work — my two `.catch` edits are preserved.)

### Needs human review (backlog — flagged, not fixed)

- `src/components/game/solo-cloud-sync.tsx` — pending sync retry (2s/4s) is stranded
  and swallowed on unmount: finishing a signed-in game then hitting "Play Again"
  before the retry fires drops the result with no toast. Architectural (needs the
  pending-sync state hoisted above the unmounting subtree, or a final best-effort
  save on unmount). Same accepted-tradeoff pattern noted for `ensure-user.tsx`.
- `convex/dailyChallenge.ts` (`submit`) + `convex/users.ts` (`recordSoloResult`) —
  score is recomputed from the **client-supplied `actual` coordinates**; the server
  never checks `results[i].actual` against its own `pickMatchLocations(day)` output.
  A client can send `guess === actual` to top the per-day board and inflate global
  XP. Acknowledged in-comment ("casual board, not anti-cheat"); real fix = validate
  each submitted `actual` against the server-derived location for that day/round.
- `src/components/multiplayer/room-results.tsx` — FFA top-tie (two players at equal
  max score) still renders one as "wins" by array order; team mode shows a draw.
  For parity, render a draw when `standings[0].totalScore === standings[1].totalScore`.
- `convex/rooms.ts` (`getByCode`) — mid-round score leak: live `standings[].totalScore`
  / `teamTotals` are exposed while `status === "active"`, so opponents see a round
  score before the reveal. (Already an in-code `TODO(bug-hunt)`.) Fix: report
  round-start totals while active.
- `convex/gameLogic.ts` / `convex/rooms.ts` — `getMapConfig(mapId)` falls back to
  `MAPS.world` for any unknown id; if a room ever accepts a custom-map slug it would
  silently serve world locations + world scoring. Validate `mapId` against the
  built-in set in `create`/`updateSettings`.
- `convex/rooms.ts` / `convex/users.ts` — achievement inserts aren't uniqueness-enforced
  (`by_user_achievement` index isn't a unique constraint); a concurrent MP-finish +
  solo-sync could double-insert the same `achievementId`. Re-check on insert or treat
  as idempotent on read.
- `src/components/game/solo-game.tsx` — coverage rerolls use the un-seeded default RNG,
  so a game that hits a no-coverage reroll is no longer deterministically replayable
  from its seed. Thread the game's seeded RNG into `pick()` if replay fidelity matters.
- `convex/presence.ts` (`seedUserCount`) — one-time backfill caps at `users.take(10_000)`
  and overwrites (not adds) the counter; undercounts >10k users and would clobber a
  live count if re-run. Documented one-time op, low impact.

### Reviewed clean (no action)

- Convex: `rateLimit.ts`, `crons.ts`, `schema.ts`, `parties.ts`, and the `rooms.ts`
  match-flow (`startRound`/`endRound`/`advance`/`enterRoundResult` `startedAt` fence +
  OCC serialization + walkover guards).
- Solo: `play-client.tsx`, `maps-config.ts`, `loadGoogleMaps` retry/backoff, easter-egg
  spawn logic, both new test files.
- Multiplayer: `scoreboard.tsx`, `team-scoreboard.tsx`, `presence-ping.tsx`,
  `multiplayer-entry.tsx`, `party-client.tsx`, `room-game.tsx` (deadline auto-submit
  is not a stale-closure bug — `useCountdown` refreshes `onExpireRef` each render).
- Misc UI: `globe-background.tsx` (raf/observer/listener cleanup all correct),
  `live-stats.tsx`, `daily-client.tsx`, `match-results.tsx` (was clean at review time),
  `use-has-keyboard.ts`, `providers.tsx`, `layout.tsx`. `map-sheet.tsx` reads
  `window.innerWidth` in a `useState` initializer (SSR-smell) but only mounts
  client-side, so it's effectively safe.

## Bug Hunt — 2026-07-03 (full repo scan)

### Auto-fixed (33 issues)

**Convex backend**
- `convex/rooms.ts` — stale round timer from a previous match could force-end a rematch round early: `endRound`/`advance` now carry a `startedAt` fence checked against `roundStartedAt`; `rematch` now requires `status === "finished"`
- `convex/rooms.ts` — deadline auto-submits raced the server's exact-time `endRound` and lost the pin: round close now scheduled with a 2.5s grace window past the displayed deadline
- `convex/rooms.ts` — reveal countdown showed the stale active-round deadline: `enterRoundResult` now repoints `roundEndsAt` to `now + REVEAL_MS`
- `convex/rooms.ts` — `connected: false` was never written anywhere (dead disconnect UI, early-advance blocked forever by abandoned tabs): liveness now derived from `lastSeenAt` (45s window) in `getByCode` and in the everyone-guessed check
- `convex/rooms.ts` — room-code collision fell through after 5 retries and inserted a duplicate (bricking `.unique()` lookups for both rooms): now throws
- `convex/rooms.ts` — last non-guessing player leaving never triggered the early advance: `leave` now runs the everyone-guessed check
- `convex/rooms.ts` — `submitGuess` accepted NaN/Infinity/out-of-range lat/lng (NaN distance stored + folded into stats) and arbitrary `guessCountryCode` strings: both validated now
- `convex/users.ts` — `recordSoloResult` accepted unbounded/non-finite client scores and distances (XP/leaderboard injection, permanent NaN profile corruption): all numeric fields validated/clamped; `rounds`/`maxScore` now derived from the submitted results
- `convex/users.ts` — `setUsername` silently replaced invalid input with a random `playerNNNNN` name: now throws a validation error
- `convex/maps.ts` — `create` stored unvalidated coordinates/country codes in public custom maps: validated now
- `convex/maps.ts` / `convex/games.ts` — malformed route ids (`/replay/garbage`, `/maps/garbage/play`) crashed the page via `v.id()` validator rejection: queries accept strings and `normalizeId` → null ("not found" state)

**Shared logic (guest + cloud)**
- `src/lib/progression.ts` — `bestCountry` only sampled the end-of-game streak, losing peaks that broke mid-game: fold now tracks the running max (regression test added)
- `src/lib/achievements.ts` — "Cartographer" (20,000+ in a 5-round game) unlocked from 10-round games at half the skill: capped at ≤5 rounds
- `src/lib/format.ts` — `timeAgo` rendered "0y ago" for ages 360–364 days; `formatDistance(999.5)` rendered "1000 m" (regression tests added)
- `src/lib/countries-meta.ts` + `scripts/build-geo-data.mjs` — ISO `SO` displayed as "Somaliland" instead of "Somalia" (Natural Earth iso collision, last-write-wins); pinned in generator + fixed generated file
- `scripts/build-geo-data.mjs` — cities whose polygon-resolved country disagrees with their source country (e.g. Singapore → "MY") are now dropped instead of mislabeled; regenerate with `bun run build:geo` to remove the existing mislabeled Singapore entries in `src/data/locations.ts:72,706`
- `src/lib/google-maps.ts` — timed-out/failed script tag stayed in the DOM, so a retry double-included the Maps API: removed on failure
- `src/lib/last-game.ts` — `loadLastGame` only validated `mapId` + `rounds`, letting drifted payloads through the cast (also `label`)
- `src/lib/maps-config.ts` + `src/app/play/page.tsx` — `params.map in MAPS` walked the prototype chain (`?map=constructor` → NaN scores synced to the cloud): `Object.hasOwn` in both

**Hooks**
- `src/hooks/use-keyboard.ts` — only single-char keys were lowercased, so the registered `enter` handler never matched `"Enter"` (dead "Enter → next round" shortcut)
- `src/hooks/use-solo-game.ts` — `submit()` had no try/finally: a rejected country-lookup chunk load left `submitting` stuck true, soft-locking the round forever
- `src/hooks/use-solo-game.ts` — Åkers easter egg replaced rounds on EVERY map (USA/Europe/custom maps could drop in Sweden): restricted to the world map
- `src/hooks/use-local-profile.ts` — `setUsername` saved the stale in-memory profile, clobbering stats recorded since mount by another hook instance/tab: merges onto fresh `loadProfile()`

**Game components**
- `src/components/game/solo-game.tsx` — custom-map coverage re-roll pulled replacements from the official world pool instead of the user's custom locations
- `src/components/game/solo-game.tsx` — hint circle was centered exactly on the answer (pin at circle center = near-perfect score): center now randomly offset up to 70% of the radius
- `src/components/game/solo-game.tsx` — held-down Space (key-repeat) bypassed RoundReveal's 450ms mash-guard and skipped the reveal: keyboard advance now shares the same delay
- `src/components/game/solo-game.tsx` + `street-view-canvas.tsx` + `google-street-view.tsx` — Maps-API load failure dead-ended the re-roll chain (permanent skeleton, demo never engaged): `onUnavailable` now carries a `"load" | "coverage"` reason; load failures go straight to demo; identical re-picked coordinates no longer hang the round
- `src/components/game/google-street-view.tsx` — implemented the advertised `+`/`−` zoom keyboard shortcut (was listed in the legend but wired to nothing)
- `src/components/game/compass-strip.tsx` — marks only covered 0–720° but headings near north need up to 779°: right side of the strip was blank for headings 300–360°
- `src/components/game/animated-number.tsx` — interrupted animations restarted from a stale origin (number visibly jumped backwards)
- `src/components/game/demo-panorama.tsx` — missing `onPointerCancel` left drag state stuck after cancelled touch gestures

**Multiplayer / social / maps UI**
- `src/components/multiplayer/room-game.tsx` — "no timer" rooms are hard-capped server-side at 90s but the client never armed the deadline auto-submit (placed pins silently lost): auto-submit now always armed off `roundEndsAt`; also added try/finally around submit (same soft-lock as solo)
- `src/components/multiplayer/room-client.tsx` — non-members opening an invite link mid-match got a broken pseudo-spectator game view (pins placed, submits silently swallowed): now a "Match in progress" screen
- `src/components/multiplayer/chat-panel.tsx` — failed sends (rate limit) silently discarded the message: draft restored + error toast
- `src/components/social/friends-client.tsx` — "Recent players" showed users with pending requests, whose Add button always errored: excluded
- `src/components/maps/map-creator.tsx` — async click handler raced `pointsRef` (quick clicks dropped points), clicks bypassed the 200-location cap, and removals didn't renumber the on-map pins
- `src/components/auth/ensure-user.tsx` — failed provisioning was never retried (the "later auth tick" the comment promised can't happen — deps never change while signed in): bounded retry with backoff
- `src/app/layout.tsx` + `src/app/page.tsx` — root-layout `canonical: "/"` was inherited by every noindex page (profile/rooms/replays canonicalizing to the homepage): moved to the homepage's own metadata
- `src/app/profile/[username]/page.tsx` — title used the percent-encoded username (`j%C3%B6rgen`); decode also made crash-safe for malformed encodings

### Fixed after independent review (claude-review, 2 rounds — 8 more issues)

- `convex/chat.ts` — `chat.list` was world-readable for anyone resolving a room code: now members-only (returns `[]` for non-members/unauthenticated so the panel degrades gracefully during auth settling)
- `convex/rooms.ts` (`finishMatch`) — an all-AFK match ended with everyone at 0 === maxScore 0, marking every player a "winner" and inflating win streaks: competitive now requires `maxScore > 0`
- `convex/users.ts` (`recordSoloResult`) — scores/distances recomputed server-side via `computeGuessScore` instead of trusting client numbers (closes score-stuffing; `actual` remains client-supplied — solo is client-authoritative by design, see note below); `guessCountryCode` sanitized to ISO alpha-2; `countryCorrect` recomputed; replay stores the recomputed rounds
- `convex/users.ts` (`importGuestProfile`) — `bestScore` clamp raised 50k → 100k (a 20-round game can legitimately reach 100,000)
- `convex/gameLogic.ts` (`pickMatchLocations`) — same Åkers easter-egg scoping as solo: world map only (Europe/USA multiplayer maps could drop a round in Sweden)
- `convex/leaderboard.ts` — `top({ limit: -1 })` made `.take()` throw (lower bound + floor added); `myRank`'s unbounded `.collect()` capped at 5,000 (TODO: aggregate component at scale); `top` now uses competition ranking so tied-XP ranks agree with `myRank`
- `src/components/maps/map-creator.tsx` — effect cleanup read `markersRef.current` (react-hooks warning): Map instance captured in the effect body

### Needs human review (5 issues — TODOs in code)

- `convex/users.ts` (`recordSoloResult`) — solo games are client-authoritative: a modified client can still fabricate `actual` locations to farm XP. A real fix (server-issued location seeds like multiplayer) is architectural.
- `convex/rooms.ts` (`getByCode`) — mid-round score leak: `totalScore` updates the instant a player guesses, so opponents see your round score before the reveal
  - Suggested fix: report round-start totals during `status === "active"`
- `convex/users.ts` (`setUsername`) — renaming leaves denormalized `maps.ownerName` and `roomMembers.username` stale
- `src/components/game/solo-game.tsx` — MapSheet unmounts during reveal, so drag-resized size/fullscreen reset every round (may be intentional)
- `src/components/game/google-street-view.tsx` — each remount leaks a WebGL context (no destroy API); long sessions can hit the browser's ~16-context cap
- `src/lib/geo.ts` (`continentOf`) — paid hint shows "Europe" for coastal North Africa and "South America" for Panama/Costa Rica; needs a country-code → continent lookup to fix properly

### Validation

- `bun typecheck` ✓ (0 errors)
- `bun lint` ✓ (0 errors, 11 pre-existing warnings — unchanged from before the fixes)
- `bun test:run` ✓ (42/42, including 4 new regression tests for `bestCountry`, `timeAgo`, `formatDistance`)

### Notes

- `src/data/locations.ts` is generated ("do not edit by hand") — the Singapore/`MY` entries remain until `bun run build:geo` is re-run with the fixed generator.
- Deploying `convex/` changes requires `npx convex deploy` (or the Vercel build hook that runs it).

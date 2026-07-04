# Code Review Backlog

## Bug Hunt — 2026-07-05 (targeted: swallowed-error → misleading-fallback-UI pattern)

Triggered by a user report: on localhost, the console showed `Google Maps
JavaScript API error: RefererNotAllowedMapError` (the dev API key's HTTP referrer
allowlist doesn't include `http://localhost:3000/*`), yet the game silently showed
the low-poly "No Street View here — showing a demo view" placeholder as if that
location genuinely had no Street View coverage — misreporting a config/auth failure
as a normal, expected empty state.

### Root cause + fix (already applied this session, not a "hunt" find)

Google's Maps JS API doesn't reject the script load on an auth failure (bad key,
disallowed referer, API not activated, billing disabled) — the script still finishes
loading and calls the ready callback normally. The only signal is `console.error` and
the optional `window.gm_authFailure` global. Downstream, the Street View panorama
lookup (`StreetViewService.getPanorama`) then also fails, and the existing code
treated *any* failed lookup identically as "no coverage at this location".

- `src/lib/google-maps.ts` — installs a `window.gm_authFailure` hook and exposes
  `hasGoogleMapsAuthFailed()`.
- `src/components/game/google-street-view.tsx` — panorama-lookup failures now report
  reason `"auth"` instead of `"coverage"` when `hasGoogleMapsAuthFailed()` is true.
- `src/components/game/street-view-canvas.tsx` / `solo-game.tsx` — thread the reason
  through (`forceDemoReason`) instead of collapsing to a boolean; `"auth"` is treated
  like `"load"` for reroll purposes (rerolling to a new location can't fix a bad key).
- `src/components/game/demo-panorama.tsx` — caption is now reason-aware: only a real
  `"coverage"` failure gets "No Street View here"; `"load"`/`"auth"` get an honest
  "Street View unavailable — showing a demo view".
- New regression tests in `src/lib/google-maps-retry.test.ts` covering
  `hasGoogleMapsAuthFailed()`.
- **Action needed from you (not a code fix):** add `http://localhost:3000/*` (and any
  other local dev ports you use) to the Google Cloud Console HTTP referrer allowlist
  for the Maps browser key used in `.env.local`, or remove the referrer restriction
  for local development.

### Swept for the same pattern elsewhere (0 new issues found)

Checked all 31 non-test `catch`/`.catch()` blocks in `src/lib`, `src/components/game`,
and `src/components/multiplayer` for the same anti-pattern (an external API/auth
error silently converted into a misleading "normal"/"empty" UI state instead of being
surfaced or distinguished). None found — the rest of the codebase consistently either
(a) surfaces the real error via `toast.error(e instanceof Error ? e.message : ...)`,
or (b) is a genuine best-effort fire-and-forget action (clipboard write, leave
room/party, heartbeat, decline invite) where swallowing failure doesn't misrepresent
game state. The Street View fallback was the one place a failure path rendered a
"this is fine, business as usual" graphic instead of an error signal.

### Validation

- `tsc --noEmit` ✓ (0 errors)
- `eslint` ✓ (0 errors; 17 pre-existing warnings, unchanged)
- `vitest run` ✓ (222/222, incl. 2 new regression tests)

## Bug Hunt — 2026-07-04 (targeted: useConvexAuth-without-isLoading + full-repo checklist sweep)

Triggered by a user bug report: the solo match-results "New building unlocked" pill
showed "Sign in to claim" to an already-signed-in user. Root cause (fixed earlier
this session, not counted below): `match-results.tsx`'s `BuildingClaimAction`/
`ChallengeShareAction` destructured `isAuthenticated` from `useConvexAuth()` without
also checking `isLoading` — Convex reports `isAuthenticated: false` while still
resolving the Clerk JWT, so a signed-in user can briefly see wrong UI. User then
asked to hunt for *similar* bugs; this entry covers that hunt (all 17
`useConvexAuth()` call sites in the repo, checked individually) plus a 4-way
parallel full-repo sweep for the standard bug-hunt checklist (logic errors, race
conditions, swallowed errors, missing awaits) across convex/, game components/hooks,
multiplayer/social/profile, and lib/maps/misc.

### Auto-fixed (4 issues, validated: `tsc --noEmit` 0 errors / `vitest run` 208/208 / `eslint` 0 new errors)

- `src/components/game/daily-client.tsx` + `src/components/challenge/challenge-client.tsx`
  — same `isAuthenticated`-without-`isLoading` pattern as the original report: both
  showed a "sign in to play" nudge under the Play button to an already-authenticated
  user during the auth-loading window. Both now also destructure `isLoading` and gate
  the nudge on `!authLoading`.
- `src/components/social/friends-client.tsx` — accept/decline friend-request buttons
  called `respond(...)` with no `.catch` at all (every other mutation in the same file
  has one). A stale/withdrawn/expired request (realistic: two tabs, or the sender
  cancels first) threw an unhandled rejection with the button silently doing nothing.
  Added a `respondToRequest` helper with `.catch` + toast, matching the file's own
  established pattern. New i18n key `friends.couldNotRespond` (5 locales).
- `src/components/profile/guest-profile.tsx` (`CloudProfile.saveName`) — username
  rename had no `.catch`; `setEditing(false)` fired unconditionally right after the
  fire-and-forget mutation. Since `convex/users.ts`'s `setUsername` was hardened in an
  earlier pass to *throw* on invalid/duplicate names (instead of silently substituting
  a random one), a normal user typing a taken name now got an unhandled rejection and
  the edit UI closed as if it had succeeded, with no explanation why the name didn't
  change. Now `await`s inside try/catch, only closes the editor on success, toasts on
  failure. New i18n key `profile.couldNotSaveName` (5 locales).

### Needs human review (11 issues — TODOs in code)

- `src/components/game/daily-client.tsx` + `src/components/challenge/challenge-client.tsx`
  (`handleComplete`) — unlike `SoloCloudSync`/`EnsureUser`/`FlagCloudSync` (which gate
  a `useEffect` on `isAuthenticated` and therefore re-run once it resolves), these are
  one-shot callbacks fired directly from game-end. A stale `isAuthenticated` read here
  permanently skips `submit`/`submitAttempt` — no retry, no error toast, silent loss of
  that day's/that challenge's result. Fix: submit from a `useEffect` keyed on
  `[isAuthenticated, isLoading]` instead of a direct check in the callback.
- `src/components/profile/guest-profile.tsx` (`AuthGate`) — no `isLoading` check: while
  Convex resolves the Clerk JWT, `GuestProfile` briefly renders `<LocalProfileView>`
  (wrong stats/data) for an actually-signed-in user before flipping to
  `<CloudProfile>`. Fix: render a loading skeleton while `isLoading` instead of
  choosing a real view.
- `src/components/maps/maps-client.tsx` (`canLike={isAuthenticated}`) — same missing
  `isLoading` check; a signed-in user landing on `/maps` can briefly see every Like
  button disabled with no explanation. Low severity (self-corrects in ~1s).
- `src/components/guest/guest-session-provider.tsx` (`provisionGuest`) +
  `src/components/multiplayer/room-client.tsx` (mount effect, the highest-traffic call
  site since invite links land here first) — same missing `isLoading` check; a
  signed-in user landing directly on `/room/CODE` before auth resolves can trip
  `!isAuthenticated` and provision a redundant ephemeral guest row. Harmless
  server-side (Clerk wins there) but wastes a mutation + DB row per race.
- `src/components/multiplayer/room-client.tsx` (auto-join effect) — `joinedRef.current`
  is claimed before `join()` resolves and its rejection is fully swallowed. A
  transient failure permanently strands the user rendering `RoomLobby` as a
  non-member, with every action silently no-op'ing — no retry, no way back short of a
  reload. Needs a bounded retry or a visible "couldn't join — retry" affordance.
- `convex/leaderboard.ts` (`topPeriod`) — only users with an `xpSnapshots` row for the
  period are considered; that row is only created by the weekly/monthly cron. Anyone
  who signs up after the last cron run is silently excluded from "This Week"/"This
  Month" for the rest of the period, even with huge XP gains — the opposite of the
  feature's own "new player can outrank a veteran" goal. Needs a decision: seed a 0-XP
  snapshot at account creation, or treat a missing snapshot as baseline 0.
- `convex/challenges.ts` (`submitAttempt`) — round validation checks range + no
  duplicates but never requires an unbroken prefix from round 1. A client can omit
  the round(s) it got wrong and submit only correct ones, inflating the recorded
  Survival "streak" past the true consecutive-from-start value.
- `convex/friends.ts` (`findPair`) — two separate index reads ((A,B) then (B,A)) don't
  overlap in Convex's OCC read-tracking; near-simultaneous mutual friend requests can
  both see "no existing pair" and both succeed, producing duplicate pending rows for
  the same pair (shows the same person in both "incoming" and "outgoing" for both
  users). Needs a design decision (auto-accept on reverse-pending hit, or canonicalize
  to one row per unordered pair).
- `src/components/game/match-results.tsx` (`mapStreak`) — keyed correctly by
  `game.mapId` (`"daily"` for Daily Challenge, kept distinct from `"world"`), but the
  card's label uses `mapNameKey(map.id)` where `map = getMapConfig(game.mapId)` falls
  back to `MAPS.world` for the unknown id `"daily"`. Result: after a Daily Challenge,
  the card reads "World streak" while showing the separate `countryByMap["daily"]`
  numbers, not the player's real World streak. Needs a decision: fold Daily into
  `countryByMap["world"]`, or keep it separate with its own label.
- `src/components/game/flag-cloud-sync.tsx` — duplicates the already-tracked
  "pending retry stranded on unmount" tradeoff from `solo-cloud-sync.tsx` (see that
  entry below): navigating away mid-backoff silently drops the Flags result.

### Reviewed clean (no new issues)

- `src/lib/**`, `src/components/maps/map-creator.tsx`, `src/components/preferences/**`,
  achievements/buildings data, i18n interpolation, `flags/pool.ts` + `flags/scoring.ts`.
- `convex/rooms.ts` duels/team/elimination logic, `solo.ts`/`dailyChallenge.ts`
  server-authoritative session flow, `gameLogic.ts`, `maps.ts`, `games.ts`, `chat.ts`,
  `parties.ts`, `presence.ts`, `rateLimit.ts`, `pushSend.ts`.
- `src/hooks/use-local-party-game.ts` + local-party UI, guest replay storage
  (`local-profile.ts`), level-up/streak-freeze toasts, `use-flag-game.ts` + Flags UI,
  `play-client.tsx`.
- `src/components/multiplayer/*` (except the two items above) — `duel-health-bar.tsx`,
  `party-client.tsx`, `room-game.tsx`, `room-lobby.tsx`, `room-results.tsx`,
  `scoreboard.tsx`, `team-scoreboard.tsx`, `chat-panel.tsx`, `reveal-map.tsx`,
  `multiplayer-entry.tsx`, `room-invite-notifier.tsx`, `avatar-picker.tsx`,
  `achievement-grid.tsx`, `public-profile.tsx`, `recent-games.tsx`, `stats-grid.tsx`,
  `replay-client.tsx`, `replay-view.tsx`.
- The other 12 `useConvexAuth()` call sites not listed above (`solo-cloud-sync.tsx`,
  `ensure-user.tsx`, `settings-menu.tsx`, `use-push-notifications.ts`, and the
  provisioning-gate effects in `guest-session-provider.tsx`/`room-client.tsx` not
  covered by the TODO above) either only gate an effect that safely re-runs once
  `isAuthenticated` resolves, or only skip/unskip a query — no visible-wrong-UI risk.

### Validation

- `tsc --noEmit` ✓ (0 errors)
- `eslint` ✓ (0 new errors; 3 pre-existing warnings unchanged)
- `vitest run` ✓ (208/208)

## Solo/Daily server-authoritative scoring — backend landed 2026-07-04 (client wiring deferred)

Addresses the "client-supplied `actual` coordinates" trust gap below (Needs-human-review
item under the 2026-07-03 hunt). Landed the **backend, isolated half** only, because the
working tree had large uncommitted parallel work (friend room-invites + custom-map
plays/likes) editing the exact files the client half touches (`recordSoloResult`,
`solo-cloud-sync.tsx`, `solo-game.tsx`). Full spec + remaining steps:
**`docs/solo-server-authoritative-scoring.md`**.

- ✅ `convex/schema.ts` — new `soloSessions` table (server-owned round locations, `consumedAt` idempotency).
- ✅ `convex/rateLimit.ts` — new `soloStart` bucket (300/day, mirrors `soloRecord`).
- ✅ `convex/solo.ts` (new) — `startGame` (mints session, resolves locations server-side via
  `pickMatchLocations`, returns them) + `submitGame` (re-derives each answer from
  `session.locations[round-1]`, never trusts client `actual`; rejects length/round/dup
  abuse; one submit per session). Self-contained; deployed but **unused** until wiring lands.
- ✅ `src/hooks/use-solo-game.ts` — `fixedOrder` opt: play injected locations verbatim/in-order
  (no resample, no easter-egg roll) so the server can re-derive answers by index. Also fixed
  the easter-egg gate to skip whenever locations are injected (prevents double-roll).
- ⛔ **Deferred (conflict with parallel work)** — client wiring: `play-client.tsx` mint a
  session for authed classic solo + pass `fixedOrder`; `solo-game.tsx` accept `sessionId`/
  `onPlayAgain`; `solo-cloud-sync.tsx` call `solo.submitGame`; `dailyChallenge.submit`
  re-derive from `pickMatchLocations(day)`; `daily-client.tsx` + `use-solo-game` daily path
  pass `fixedOrder`; consolidate `applySoloResults` to take `locations` and remove
  `recordSoloResult`. Custom-map `plays`-counter path (added by the parallel work to
  `recordSoloResult`) must be preserved during that consolidation.

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

## Bug Hunt — 2026-07-05 (pre-push review of 26 unpushed commits)

Reviewed the full diff between `origin/main` and local `HEAD` (backend leaderboard/test-user filtering, easter-egg rate changes, dark-map toggle, in-game settings access, Street View auth/coverage distinction, round-reveal pin occlusion fix, map-sheet redesign) via 5 parallel subagents split by area (Convex backend, core game components, flag/party/match games, multiplayer/profile/social, home/lib/i18n).

### Auto-fixed (1 issue)

- `src/components/game/map-sheet.tsx` — the mini-map's bottom action bar (Hint/Guess buttons) was recently made `absolute` over the map without `pointer-events-none`, silently blocking guess-clicks on the bottom ~56px band of the mini-map (regression vs. the previous below-map row layout). Added `pointer-events-none` to the footer row and `pointer-events-auto` to the two button-wrapper divs, matching the pattern already used in `game-hud.tsx`/`flag-game.tsx`.

### Needs human review (1 issue — TODO in code)

- `src/components/profile/all-avatars-view.tsx:70` — the new `AuthGate` has no `isLoading` guard, so a signed-in user briefly renders the guest (local-only) avatar grid before flipping to the cloud grid. Same latent flash already present in `guest-profile.tsx:170` (pre-existing pattern, not a regression from this diff) — both should be fixed together by gating on `isLoading` with a skeleton.

### Verified clean (no changes needed)

- Convex backend: `isTestUser` filtering applied consistently across every public leaderboard path (top, myRank, friends, topPeriod, daily challenge, flags regional); easter-egg roll math (10%/10%/80% partitions) is correct; daily/flag `{r,u}` join restructure keeps `mine.rank` consistent with the filtered/sliced rows.
- `flag-map.tsx` — `applyStatus`'s new `key: "status" | "pastStatus"` parameter is applied consistently at all 4 call sites (including on initial map `load`), so the muted past-rounds trail and current-round status coexist correctly.
- `guess-map.tsx` / `round-reveal.tsx` — the `bottomInset` prop (measured via `ResizeObserver` + `useLayoutEffect` on the result card) is correctly threaded into `fitBounds`/`flyTo` padding and cleaned up on unmount.
- `google-street-view.tsx` / `street-view-canvas.tsx` / `solo-game.tsx` — the new `"auth"` unavailable-reason (distinguishing `RefererNotAllowedMapError` from real no-coverage) is wired through the full chain: emitted only when `hasGoogleMapsAuthFailed()` is true, typed through `StreetViewUnavailableReason`, and handled explicitly in `solo-game.tsx`'s re-roll guard.
- i18n — all 5 locales (en/lt/pl/sv/uk) have exact key parity (430 keys each), including the new `settings.darkMap*` and `profile.*Avatars*` keys.
- `AvatarPicker`'s `limit !== undefined` strict check is correct (distinguishes `limit={0}` from "no limit"), dark-map wiring is correct across all 7 `mapStyleFor` call sites, `button.tsx`'s `transition-all` → explicit property list is a no-op for existing callers.

### CodeRabbit pass (8 findings — 7 fixed, 1 backlogged)

- `src/hooks/use-flag-game.ts` (MAJOR) — `next()`'s history merge (`{...s.history, ...buildStatus(s)}`) let a later round's decoy click on a country downgrade an earlier round's finalized `"correct"`/`"revealed"` entry, corrupting the muted past-rounds trail. Fixed: merge now skips any iso already finalized in history.
- `src/components/game/map-sheet.tsx` (MAJOR) — collapsing the mini-map did an early `return` that unmounted `GuessMap` entirely, recreating the maplibre-gl instance (losing pan/zoom, plus contributing to the known WebGL-context-leak issue) every toggle. Fixed: `GuessMap` now stays mounted; the collapsed/expanded panels toggle via `hidden`, relying on `GuessMap`'s existing `ResizeObserver` to re-`resize()` when shown again.
- `src/components/game/solo-game.tsx` (MAJOR) — the per-round reset effect cleared `forceDemo`/`forceDemoReason` unconditionally, so a session-wide `"auth"` failure (bad/blocked Google Maps key) got wiped every round, sending each new round back through a doomed real-Street-View attempt (flicker + wasted call) before falling back again. Fixed: `"auth"` now stays sticky across rounds; only transient `"load"`/`"coverage"` reasons reset.
- `src/components/profile/all-avatars-view.tsx` + `src/components/profile/guest-profile.tsx` (minor, same fix — this is the AuthGate flash already flagged in the bug-hunt above) — both `AuthGate`s now gate on `isLoading` and render a skeleton instead of briefly choosing the wrong (guest) view for a signed-in user.
- `src/components/preferences/settings-menu.tsx` (minor) — the settings trigger button's `aria-label` was always `t("settings.open")` even when `showLabel` renders visible text, so the accessible name didn't match the visible label (WCAG Label-in-Name). Fixed: `aria-label` is now `undefined` when the label is visible.
- `src/components/multiplayer/multiplayer-entry.tsx` (minor) — a single shared `creating` boolean showed a loading spinner on *both* the "create room" and "create duel" buttons whenever either was in flight. Fixed: `creating` is now `"room" | "duel" | null` so only the clicked button spins.
- `src/components/profile/stats-grid.tsx` (minor) — merging the Level/rating cards and the compact stat tiles into one `grid-cols-2 sm:grid-cols-3` shrank the Level card (which holds a progress bar) down to the same 1/3-width cell as a 2-line stat tile, losing its original `flex-1`-dominant sizing. Fixed: Level card now gets `col-span-2`.
- `convex/flags.ts` (minor, backlogged, not fixed) — the region leaderboard's `n + 20` over-fetch margin can still return fewer than `n` rows if more than 20 test accounts land in that window. Same accepted tradeoff already used by `leaderboard.ts`'s `top` (n + 150) and `dailyChallenge.ts`; a real fix means looping/expanding the fetch window until `n` non-test rows are found or a safe cap is hit. Left as a follow-up rather than an architecture change right before push.

### Validation

- `bun typecheck` ✓ (0 errors)
- `bun lint` ✓ (0 errors, 17 warnings — all pre-existing or the codebase's existing raw-`<img>` convention, none are regressions)
- `bun test:run` ✓ (230/230, 27 files)
- `bun run build` ✓ (production build succeeds; sandbox's local proxy briefly broke Next.js's font-fetch on the very first local attempt — not a code issue, confirmed by a clean retry with direct network)

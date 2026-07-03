# Code Review Backlog

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

### Needs human review (6 issues — TODOs in code)

- `convex/chat.ts:33` — `chat.list` has no auth/membership check; anyone resolving a room code can read a private room's chat (spectating may or may not be intended)
  - Suggested fix: mirror `send` — `requireUser` + `assertMember` (needs `QueryCtx` support)
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

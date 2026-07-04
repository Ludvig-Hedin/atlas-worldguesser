# Backlog

Deferred work surfaced during the UX assessment + bug hunt (2026-07-03). Ordered
roughly by value. Items here were intentionally NOT done in that pass because they
need a product decision, a schema/data migration, or a larger build.

## Anti-repeat location tracking follow-ups (added 2026-07-04)

Minor, non-blocking findings from the final review of the location-repeat fix
(`docs/superpowers/plans/2026-07-04-location-repeat-fix.md`). None affect
correctness of the shipped fix — deferred as polish.

- **Street View reroll doesn't dedup.** `src/components/game/solo-game.tsx:161`
  calls `pickLocations(mapId, 1)` with no `excludeKeys` when swapping in a
  replacement for a badly-covered panorama — the replacement can land on a
  recently-seen location. Rare path (only fires on Street View coverage
  misses); the replacement still gets recorded at game end via the normal
  finish-recording path. Area: `src/components/game/solo-game.tsx`.
- **Battle Royale eliminated members over-record exposure.** `finishMatch`
  (`convex/rooms.ts`) records all of `room.locations` for every match member,
  including someone eliminated before later rounds played out — unlike solo,
  which only records rounds actually shown
  (`prev.locations.slice(0, prev.round)` in `use-solo-game.ts`). Low impact
  (slightly more aggressive dedup for early-eliminated players, not a
  correctness bug). Area: `convex/rooms.ts` `finishMatch`.
- **Nordics exclusion test has an undocumented size dependency.** The
  `usesOfficialPool` exclusion test in `src/hooks/use-solo-game.test.ts` needs
  the Nordics pool to stay at or under `RECENT_LOCATIONS_CAP` (30) or the
  exclusion assertion goes flaky for reasons unrelated to the code under test
  (see the Task 7 review in the plan above for the full mechanism). Currently
  safe (~18 locations). Consider adding an explicit
  `expect(pool.length).toBeLessThanOrEqual(RECENT_LOCATIONS_CAP)` guard so a
  future seed-data or cap change fails loudly instead of silently flaking.
  Area: `src/hooks/use-solo-game.test.ts`.
- **Survival mode tracks locally even for signed-in users.** Signed-in classic
  solo dedups server-side (`convex/recentLocations.ts`); Survival mode always
  dedups via the client-only `src/lib/recent-locations.ts` localStorage
  mirror, even when signed in — the two histories never cross-inform for one
  user. Inherent to Survival's fully-client-side design (unchanged by this
  fix); would need a schema/product decision to unify. Area:
  `src/hooks/use-solo-game.ts`, `convex/recentLocations.ts`.

## Google Maps cost follow-ups (added 2026-07-04)

- **Pre-vet `src/data/locations.ts` for Street View coverage offline.** The
  pool is raw city-center coords from Natural Earth, never checked against
  Street View — low-coverage entries (e.g. some capitals) burn a reroll
  (billed lookup) every time they're drawn. Write a one-off script using
  `GOOGLE_MAPS_SERVER_KEY` (declared in `.env.example`, currently unused) to
  batch-resolve each entry once, drop uncovered ones, and populate the
  already-modeled-but-empty `panoId` field on `GameLocation`
  (`src/lib/types.ts`) so normal play skips the live metadata call entirely.
  Area: `src/data/locations.ts`, `src/lib/types.ts`. Impact: high — this plus
  the reroll cap (done) and localStorage cache (done) are the main levers on
  Street View spend.
- **Multiplayer: resolve panorama once per round, not once per player.**
  `convex/rooms.ts` already knows the round's location server-side, but each
  client in a room independently calls Google for the identical coordinate
  (N players × M rounds = N× the necessary lookups). Have one client report
  the resolved `panoId` back (or resolve server-side once
  `GOOGLE_MAPS_SERVER_KEY` exists) and broadcast it via room state. Area:
  `convex/rooms.ts`, `src/components/multiplayer/room-game.tsx`. Impact:
  medium, scales with concurrent room size.

## Guest multiplayer follow-ups (added 2026-07-04)

- **Ephemeral guest cleanup (TTL / cascade delete).** Guest accounts
  (`users` rows with `isGuest: true`) and everything they generate —
  `roomMembers`, `guesses`, `chatMessages`, `games` — persist forever; v1 only
  filters them out of the leaderboard/stats at read time. Build a prune cron
  (`crons.ts`, batched + self-rescheduling like `presence.prune`) that deletes
  guest users idle past a TTL and cascades to their child rows. Area:
  `convex/crons.ts`, `convex/users.ts`. Impact: storage growth only, low at
  current scale.
- **i18n for the guest CTA.** "Play as guest" is hardcoded English in
  `src/components/multiplayer/multiplayer-entry.tsx` and `room-client.tsx` (the
  `GuestGate`). Add an `mp.playAsGuest` key across `src/lib/i18n/*` and swap the
  literals. Deferred to avoid colliding with a concurrent i18n edit pass.
- **Guest rate-limit is best-effort.** `ensureGuestUser` is rate-limited per
  `guestId` (`rateLimit.guestProvision`), but a guest can rotate their
  localStorage id to bypass it. Accepted for v1 (Convex mutations have no
  caller-IP access). Revisit with IP/fingerprint limiting only if abused.

## Needs a product decision

- **Multiplayer: leaving mid-match forfeits your guesses.** `convex/rooms.ts`
  `leave` deletes the `roomMembers` row; `finishMatch` only records results for
  members still present, so a player who guesses then leaves before the match ends
  gets no game record / XP for that match. This may be *intended* (leave = forfeit).
  If we want to keep their partial result, soft-delete the member (add a `left`
  boolean to the `roomMembers` schema) and include left members in `finishMatch`.
  Area: `convex/rooms.ts`, `convex/schema.ts`. Impact: medium, edge-case only.

- **Friends leaderboard shows friends-relative rank while the Global tab pins a
  global rank.** Intended semantics (1st among friends vs #1234 globally), but if
  it reads as confusing we could label the friends tab ("Rank among friends") or
  show each row's global rank. Area: `src/components/leaderboard/leaderboard-client.tsx`,
  `convex/leaderboard.ts`.

## Larger builds (structural)

- **Map creator: pre-save preview.** Undo/delete/paste-coords/share were added;
  a "preview this map" step before saving is still missing. Area:
  `src/components/maps/map-creator.tsx`.

## i18n coverage gaps (2026-07-03)

Fixed this pass: marketing/landing page (`src/components/home-content.tsx`), map
names/taglines and movement presets (`src/lib/maps-config.ts` + every render site),
`resume-cta.tsx`, `live-stats.tsx`, and a few adjacent strings in files touched along
the way (`solo-game.tsx` toasts/loading text, `recent-games.tsx`, `replay-client.tsx`).
Verified in-browser (Playwright) that switching to Swedish translates the full
homepage and the `/play` setup screen with no console errors.

Still hardcoded English, found during the same sweep but out of scope for a
"fix the marketing page" pass — each is a real, separate chunk of translation work:

- **`src/lib/countries-meta.ts`** — `COUNTRY_NAMES` (~195 country names), read at 7+
  sites (round reveal, replay, room reveal, profile). Highest-visibility gap left:
  fires on every round reveal. Needs per-locale country name tables, not just UI
  strings — the biggest single chunk of remaining work.
- **`src/components/game/round-reveal.tsx`** — the post-round reveal card shown
  after every round in every game mode. No `useT` import.
- **`src/components/multiplayer/room-client.tsx`** — room join/error/gate screens
  ("Room not found", "Match in progress", "Multiplayer is disabled", etc).
- **`src/components/maps/map-creator.tsx`** — entire custom-map creation flow
  (toasts, placeholders, aria-labels, confirm dialog).
- **`src/components/profile/stats-grid.tsx`** — profile stat labels (Games/Wins/
  Best score/etc).
- **`src/components/game/play-client.tsx`** — the `/play` header ("New game", "Set
  it up, then guess where in the world you are.") and its embedded Daily Challenge
  teaser card (separate hardcoded strings from the real `/daily` page, which is
  already translated).
- **`src/lib/achievements.ts`**, **`src/lib/buildings.ts`** — achievement and avatar
  building name/description text, same "data literal bypasses `t()`" pattern as
  `maps-config.ts` had.
- **`src/lib/format.ts`** — `timeAgo()` ("just now", "5m ago", …) and `pluralize()`
  ("653 locations") return hardcoded English regardless of locale.
- **`src/components/convex-gate.tsx`** — plus every `label=` prop passed to it from
  ~10 route `page.tsx` files.
- **Smaller/scattered**: hardcoded `toast()` calls in `solo-cloud-sync.tsx`,
  `ensure-user.tsx`; a default `"Cancel"` label in `ui/confirm-dialog.tsx` that's
  never overridden by callers; `keyboard-legend.tsx`, `map-sheet.tsx`,
  `panorama-controls.tsx`, `demo-panorama.tsx`.

Area: `src/lib/i18n/*` (add keys) + each file above. Recommend tackling
`countries-meta.ts` as its own pass (translation volume, not just wiring) before the
rest, since it's the highest-visibility remaining gap.

## Notes

- `src/app/opengraph-image.tsx` had a Satori build error (a `<div>` with multiple
  children lacking `display:flex`) introduced by a concurrent SEO pass; fixed on
  2026-07-03 so `next build` passes. Kept out of the UX commit.

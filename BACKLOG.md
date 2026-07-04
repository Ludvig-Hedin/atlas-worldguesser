# Backlog

Deferred work surfaced during the UX assessment + bug hunt (2026-07-03). Ordered
roughly by value. Items here were intentionally NOT done in that pass because they
need a product decision, a schema/data migration, or a larger build.

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

- **Web push notifications (real background push, not just in-tab toasts) for
  friend requests / accepts / room + party invites.** Requested as phase 2
  after transactional email (2026-07-04): needs a service worker, VAPID keys,
  a `pushSubscriptions` table keyed by user, and a permission-prompt UX. Email
  (`convex/email.ts`) ships first; wire push the same way — schedule from the
  same mutations (`friends.sendRequest`/`respond`, `rooms.inviteFriend`,
  `parties.invite`) alongside the existing `internal.email.send` calls.

- **`src/components/guest/guest-session-provider.tsx` calls a mutation that
  doesn't exist** — `api.users.ensureGuestUser` (only `ensureUser` exists in
  `convex/users.ts`). Fails `tsc --noEmit`. Found 2026-07-04 while typechecking
  an unrelated change; the file is untracked (never committed), so this is
  in-progress/abandoned guest-mode work, not a regression from that change.
  Needs whoever owns that feature to either implement `ensureGuestUser` or
  finish wiring it to `ensureUser`.

- **Replay for guests + shareable replay links.** Guest (localStorage) games have
  no `replayId`, so guests can't review past games and replays aren't shareable.
  Needs local replay storage and/or a public replay route. Area: `src/lib/local-profile.ts`,
  `src/components/replay/*`, `convex/`.

- **Time-scoped leaderboards (this week / this month).** Current XP is cumulative
  only; a weekly board needs per-window XP tracking (e.g. a periodic aggregate or a
  games-in-window scan). Area: `convex/leaderboard.ts`, `convex/schema.ts`.

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

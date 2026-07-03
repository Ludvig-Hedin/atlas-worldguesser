# Backlog

Deferred work surfaced during the UX assessment + bug hunt (2026-07-03). Ordered
roughly by value. Items here were intentionally NOT done in that pass because they
need a product decision, a schema/data migration, or a larger build.

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

## Notes

- `src/app/opengraph-image.tsx` had a Satori build error (a `<div>` with multiple
  children lacking `display:flex`) introduced by a concurrent SEO pass; fixed on
  2026-07-03 so `next build` passes. Kept out of the UX commit.

# Atlas

A fast, beautiful geography guessing game inspired by GeoGuessr / WorldGuessr.
Get dropped into a random street, read the clues, and pin your guess on the map.

Built with **Next.js 16, React 19, TypeScript, Tailwind v4, MapLibre, Motion,
Convex, and Clerk**. Designed to boot and be playable with **zero configuration**,
then light up real Street View + realtime multiplayer as keys are added.

## Quick start

```bash
bun install
bun dev
```

Open http://localhost:3000. Click **Quick play** — you're in a game in seconds.

With no environment variables the app runs in **demo mode**: solo play works
end-to-end using deterministic demo panoramas, and stats are saved locally in
your browser. Add keys (below) to unlock real Street View, accounts, and
multiplayer.

## Scripts

| Command | Description |
| --- | --- |
| `bun dev` | Start the dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` / `test:run` | Vitest (watch / once) |
| `bun run build:geo` | Regenerate bundled geo data from Natural Earth |

## Configuration

Copy `.env.example` to `.env.local` and fill in what you want to enable. Every
integration is optional and independent:

- **Google Maps** (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`) — real Street View.
  Without it, demo panoramas are used.
- **Convex** (`NEXT_PUBLIC_CONVEX_URL`, via `npx convex dev`) — realtime backend
  for multiplayer, profiles, leaderboards, friends, and saved stats.
- **Clerk** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, …) — authentication. Solo play
  never requires an account.

## Architecture

- **Solo** runs entirely client-side: a deterministic, seedable engine
  (`src/hooks/use-solo-game.ts`) using shared pure utilities for scoring
  (`src/lib/scoring.ts`), country lookup (`src/lib/geo.ts` + bundled polygons),
  and progression (`src/lib/xp.ts`). Guest stats live in `localStorage`.
- **Multiplayer** (in progress) is server-authoritative on Convex: reactive
  queries for live room/scoreboard state and scheduled functions for
  synchronized round timing.
- **Panorama** is unified behind `StreetViewCanvas`, which uses Google Street
  View when available and falls back to a procedural demo panorama otherwise.
- **Guess map** is MapLibre GL over a free, key-less CARTO dark basemap.

### Data

`src/data/` holds generated, provenance-tracked geo data (country polygons and
a curated seed of ~650 real-world coordinates with country codes). Regenerate
with `bun run build:geo` (downloads public-domain Natural Earth sources).

## Status

- ✅ Core solo gameplay — modes (World / Europe / USA / Countries), difficulty
  (Moving / No Move / NMPZ), rounds, timer, scoring, reveal, match results,
  XP/levels, achievements, streaks, guest history.
- ⏳ Auth + cloud profiles, realtime multiplayer, social, replays, leaderboards.

## Notes

- Scoring is computed authoritatively (server-side for multiplayer); a
  determined client can still inspect panorama data — an inherent tradeoff of
  rendering Street View in the browser.
- Contact: ludvig@ludvighedin.com

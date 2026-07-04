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

## Deploy (Vercel + Convex)

1. Provision Convex: `npx convex dev` once locally (creates `convex/_generated`
   and a dev deployment), then `npx convex deploy` for production.
2. On Vercel, set the build command so Convex deploys alongside the frontend:
   ```
   npx convex deploy --cmd 'next build'
   ```
3. Add env vars in Vercel: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, the
   Clerk keys, and (optionally) the Google Maps browser key. In the Convex
   dashboard set `CLERK_JWT_ISSUER_DOMAIN` and add a JWT template named `convex`.

The app deploys and runs without any of these — it simply serves solo demo mode
until the keys are present.

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

Flag SVGs in `public/flags/` (used by the Flags game mode) are copied from
[flag-icons](https://github.com/lipis/flag-icons) (MIT; the flag artwork is
public domain) with `bun run build:flags`.

Building-avatar art in `public/buildings/` is AI-generated (Nano Banana /
Gemini image API) flat-illustration icons, one per curated country in
`src/lib/buildings.ts`, rendered on a solid white background and chroma-keyed
to a transparent PNG with ImageMagick. No regeneration script yet — regenerate
by re-running the same prompt template per country code and re-keying.

## Status

- ✅ Core solo gameplay — modes (World / Europe / USA / Countries), difficulty
  (Moving / No Move / NMPZ), rounds, timer, scoring, reveal, match results,
  XP/levels, achievements, streaks, guest history.
- ✅ Auth (Clerk) + cloud profiles, stats sync, global leaderboard.
- ✅ Realtime multiplayer — private rooms (code + invite link), lobby with
  host controls & ready status, synchronized live rounds, server-authoritative
  scoring, live scoreboard, chat, match results, rematch.
- ✅ Social — friends (requests / accept / remove), recent players, per-user profiles.
- ✅ Unlockable avatars — 145 curated iconic-building avatars (~69% of all 209
  countries), unlocked by correctly guessing that country in any game mode.
  Free background-color customization. Cloud accounts persist unlocks
  server-side (`convex/users.setAvatar`); guests track locally and merge into
  their account on sign-in. Art generated via Nano Banana, chroma-keyed to
  transparent PNGs (`public/buildings/`, catalog in `src/lib/buildings.ts`).
- ✅ Custom maps — build a map by dropping pins, share it public/private, play it solo.
  The community browser (`/maps`) has Trending/Newest/Most Played sort tabs and a
  like button per map (`convex/maps.ts` `toggleLike`, denormalized `likes`/`plays`
  counters on the `maps` table). Plays are counted once per finished game on a
  public/private custom map via an optional `customMapId` on `recordSoloResult`.
- ✅ Replays — every finished game is replayable round-by-round.
- ✅ Flags mode (`/flags`, `/countries`) — Seterra-style: see a country's flag (or
  its name), then click that country on a blank world map. Play the World or a
  single continent, retry-until-correct with escalating amber→orange→red feedback,
  a 🔥 streak counter, XP into the shared pool, and a per-region best-score
  leaderboard. Flag SVGs are bundled locally (`public/flags/`) so they render on
  every platform and work offline.
- ✅ Sound effects — synthesized (Web Audio, no assets, offline) right/wrong/finish
  cues across every mode plus menu clicks; toggleable in Settings.
- ✅ In-product clue reference ("What gives it away?") — every round reveal shows
  the actual country's driving side (`src/data/country-clues.ts`,
  `DRIVING_SIDE_BY_COUNTRY`, covering all 168 recognized country codes) plus a
  "Learn more" button opening a static reference sheet
  (`src/components/game/clues-reference-sheet.tsx`) covering bollards, utility
  poles, license plates, Street View camera generations, and driving side —
  the community-wiki "meta" knowledge taught in-product instead of only on
  third-party sites. Text-only for v1; reference photos/diagrams per category
  are a nice-to-have follow-up once assets are sourced.

> Replays capture each round's guess vs. actual location and score. Recording the
> live camera path within a "moving" round is a planned enhancement.

Auth, multiplayer, leaderboards, friends and replays require Convex + Clerk
(see Configuration); the app degrades gracefully to solo play without them.

## Notes

- Scoring is computed authoritatively (server-side for multiplayer); a
  determined client can still inspect panorama data — an inherent tradeoff of
  rendering Street View in the browser.
- Contact: ludvig@ludvighedin.com
# atlas-worldguesser

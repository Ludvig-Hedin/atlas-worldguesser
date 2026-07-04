# Atlas vs. GeoGuessr vs. WorldGuessr — Competitive Analysis

*Written 2026-07-04. Scope: product/feature comparison only, no code changes made.*

## 1. What Atlas actually has today (code-verified)

Stack: Next.js 16, React 19, TypeScript, Tailwind v4, MapLibre GL (key-less basemaps), Convex, Clerk.

- **Modes**: Solo Classic (3/5/10 rounds), Solo Survival (endless, dies on first wrong country), Daily Challenge (server-seeded, one attempt/day, per-day leaderboard), Flags (Seterra-style click-the-country, 6 regions), real-time multiplayer Rooms (FFA or 2-4v4 Team, private code + invite link), Custom Maps (user-built pools, 5-200 pins, public/private).
- **Maps**: 13 pools (World, 6 regions, Countries, Custom) with per-map score scaling. ~650 curated world locations (`src/data/locations.ts`).
- **Difficulty**: Moving / No Move / NMPZ, enforced client-side per map config.
- **Scoring**: GeoGuessr-style exponential decay (`5000·e^-d/scale`), server-authoritative in multiplayer, **client-authoritative in solo/daily** (acknowledged gap, see below).
- **Progression**: XP (score/5 + pinpoint bonus), quadratic level curve, 10 achievement badges, daily/win/country streaks, cumulative-XP-only global + friends leaderboards (no ranked/ELO, no time-scoped boards).
- **Cosmetics**: 30 unlockable AI-generated landmark-building avatars (unlock = correctly guess that country once) + 8 free color swatches. No paid cosmetics, no other unlock system.
- **Social**: Friends (add/accept), recent players, public profiles, room chat, persistent parties (auto-join leader's room).
- **Replays**: Full per-round replay for signed-in users (`/replay/[gameId]`); **guests get none** (open gap).
- **Panorama**: Google Street View when an API key is configured, else falls back to a **procedurally-drawn fake horizon** — i.e. without a key the whole game has no real imagery.
- **Monetization**: None. Zero paywall, zero payment code anywhere in the repo.
- **i18n**: 5 locales (EN/SV/PL/UK/LT), but large in-game surfaces are still hardcoded English per `BACKLOG.md` (country names on reveal, the reveal card itself, room error states, map creator, achievement/avatar copy).
- **Known open bugs relevant to trust/fairness**: solo/daily scoring has no server-side location validation (XP/leaderboard farming possible via modified client); multiplayer round scores leak to opponents before reveal; custom maps aren't validated in multiplayer room creation (silent fallback to World); Google Street View leaks WebGL contexts on remount.

**Bottom line**: Atlas already has real-time multiplayer, custom maps, a cosmetic-unlock loop, and a daily challenge — a broader base feature set than a typical clone. It has **no ranked ladder, no ELO, no streak-vs-friends async challenge, and no paid tier** (the last one is currently an advantage, not a gap).

## 2. Why GeoGuessr/WorldGuessr are sticky

- **Core loop**: pattern-recognition + instant feedback = a compounding "I'm getting better at reading the world" feeling. The skill ceiling is the retention engine, not the map art.
- **The meta-game has real depth**: bollards, utility poles, license plates, driving side, and — most powerful — **Street View camera generation** (Gen 1-4, each with distinct visual tells) let skilled players near-instantly narrow a guess before even reading text. This is taught through a mature community wiki ecosystem (Plonk It, Geometas, GeoGuessrGuide) that GeoGuessr itself does nothing to build — the community built it for them.
- **Ranked ladder (Duels)**: Elo-based, Bronze→Champion divisions, hidden rating below Gold (reduces early tilt), January 2026 added 7 more divisions specifically to fix rank-bouncing. This is the single strongest retention mechanic in the product — it's *why* players open the app daily.
- **Battle Royale + Duels + Streaks** give three structurally different multiplayer tensions (elimination, 1v1 health combat, solo endurance) rather than one mode reskinned.
- **Community maps at scale**: "A Community World" alone has 105K locations, 20M+ plays, 68K likes — user-generated content is doing GeoGuessr's content-treadmill work for free.
- **Free alternative pull**: WorldGuessr (open-source, MIT-adjacent license, no login required, real multiplayer via WebSockets) exists specifically because GeoGuessr pulled Street View gameplay behind a paywall in 2024. Its own forum shows real infrastructure strain (lag threads, dev firefighting) — it wins on price/access, not polish.
- **What players hate**: GeoGuessr's 2025 Steam launch got "Overwhelmingly Negative" reviews (~15% positive) specifically for gating ranks/content behind a subscription that wasn't disclosed clearly at purchase; current pricing is $4.99-$10.99/mo (or $2.99-$5.99/mo annual); an account is now required even for the free Daily Challenge. Direct quote from Steam review coverage: players note *"you can literally just hop into similar browser versions and play for free"* — they already think of free clones as the escape valve.

## 3. Feature Gap Table

| Feature | GeoGuessr | WorldGuessr | Atlas | Gap |
|---|---|---|---|---|
| Free to play, full features | No (paywalled since 2024) | Yes | **Yes** | Atlas advantage |
| No login required | No | Yes (guest play) | Partial — guest solo works, but no replay/leaderboard persistence | Small gap |
| Real Street View imagery | Yes | Yes (Embed API) | Yes, if `GOOGLE_MAPS_BROWSER_KEY` set; else fake panorama | Deployment risk, not a code gap |
| Ranked ladder / ELO | Yes (Duels, divisions) | Unconfirmed/likely absent | **No** | **Biggest gap** |
| 1v1 competitive (Duels-style) | Yes | Casual multiplayer only | No (only FFA/Team room, no head-to-head damage format) | Gap |
| Battle Royale (elimination) | Yes (2 variants) | No evidence | No | Gap |
| Country/City/State Streaks | Yes, 3 variants, async challenge-link vs friends | Yes (country streak) | Yes, but solo-only (Survival), no async friend-vs-friend challenge link | Partial gap |
| Daily Challenge | Yes (only free mode) | Unconfirmed | **Yes**, server-seeded, fair | Atlas parity |
| Custom/community maps | Yes, huge ecosystem + Map Maker | No evidence | **Yes**, own creator tool | Atlas advantage (smaller catalog) |
| XP / levels | Yes, reworked 2026 with visible rewards roadmap | Unconfirmed | Yes, quadratic curve + 10 achievements | Parity |
| Cosmetic unlocks | Yes (Elite-tier items, titles/borders) | No | **Yes**, unique landmark-avatar unlock tied to actually guessing that country correctly | **Atlas differentiator** — ties cosmetic to skill, not payment |
| Party/private lobby | Yes, link-based, spectator "Game Master Mode" | Yes (friend challenge) | Yes, room code + invite link + persistent parties | Parity |
| Replays | Limited | Unconfirmed | Yes for signed-in users; **none for guests** | Gap for guest UX |
| Meta-game skill layer (bollards/poles/plates/camera-gen) | Deep, community-taught | Same underlying imagery, same meta applies | Same imagery available, **zero in-product teaching of the meta** | Gap — pure content/UX opportunity |
| Monetization / paywall | Yes, actively causing backlash | No | **No** | **Atlas advantage — lean into this explicitly** |
| Server-authoritative scoring | Yes | Unknown | Multiplayer yes; **solo/daily no** | Trust/fairness gap |
| Languages | English-first, some localization | English only (assumed) | 5 locales, but partial coverage | Partial advantage, needs finishing |

## 4. Conversion Roadmap

### Table-stakes (must-have to be taken seriously as an alternative)
1. **Fix solo/daily server-side score validation** — a modified client can currently fabricate perfect scores. If Atlas positions itself as "the fair free alternative," a leaderboard-integrity bug undercuts the entire pitch on day one. Effort: **M**. Lives in `convex/users.ts` (`recordSoloResult`) + needs a server-side distance recompute against the true stored location, mirroring what `convex/rooms.ts` already does correctly for multiplayer.
2. **Fix the multiplayer mid-round score leak** (`convex/rooms.ts:612-615`) — competitive players will notice and stop trusting ranked-adjacent play immediately. Effort: **S**.
3. **Finish i18n coverage** — country names on every reveal card and the reveal component itself are still hardcoded English; this is the highest-visibility gap for non-English users. Effort: **S-M**, mechanical `useT` wiring across the files already listed in `BACKLOG.md`.
4. **Guest replays** — GeoGuessr's own weakness is requiring login; Atlas's no-login pitch is undercut if guests who *do* try it hit a dead end at "review your game." Effort: **M**, localStorage-backed replay + a client-side replay route variant.

### Differentiators (where Atlas can win — free + no-login + instant-play + real-time)
5. **Explicit "no paywall, ever" positioning on the homepage/marketing** — directly target the exact players GeoGuessr's Steam backlash and 2024 web paywall alienated. Effort: **S** (copy + landing page section), lives in `src/app/(marketing)` / homepage content already built for SEO in the previous session.
6. **Async streak-challenge links** (GeoGuessr's Country/City/State Streak "compare with a friend" link) — Atlas has Survival mode but no shareable async challenge. Cheap virality lever: "beat my streak of 14." Effort: **S-M**, reuse the existing seeded-Survival buffer + a shareable result URL, similar in shape to the existing replay-share pattern.
7. **In-product meta-game teaching** — a lightweight "learn the clues" panel (bollards/poles/plates/camera-gen primer, or post-round "here's what gave it away" tooltip) that GeoGuessr leaves entirely to third-party wikis. This is a genuine content differentiator no competitor product-side has built. Effort: **M**, content-heavy but no new architecture — hook into the existing `round-reveal.tsx` component.
8. **1v1 "Duel"-style room preset** — Atlas's room engine already supports FFA/Team with server-authoritative scoring; a scoped 1v1 preset with a simple health/damage visual (reusing existing per-round score) gives GeoGuessr's single strongest mode a free equivalent. Effort: **M**, mostly UI + room-config work on top of `convex/rooms.ts`, which already has the hard multiplayer plumbing (timing fences, server scoring, early-advance) done.

### Retention hooks (what keeps them coming back)
9. **Lightweight ranked rating (not full ELO ladder)** — even a simple visible rating number + 3-4 tiers (no need to match GeoGuessr's division complexity) gives players a reason to return daily that pure cumulative XP doesn't. Effort: **L**, needs a rating-update function on multiplayer/duel results and a new leaderboard view; can start on top of the existing `convex/leaderboard.ts` infra.
10. **Time-scoped leaderboards (weekly/monthly)** — already an explicit `BACKLOG.md` gap; cumulative-only XP leaderboards mean new players can never catch up, which kills exactly the "keep coming back" incentive a leaderboard should provide. Effort: **S-M**.
11. **Streak-freeze / makeup mechanic** — GeoGuessr itself lacks this and it's an active player complaint (a Canny feature request exists); Atlas could ship it first as a small, cheap differentiator on top of the existing daily-streak tracking in `src/lib/progression.ts`. Effort: **S**.
12. **Community map discovery/trending surface** — Atlas's custom-map creator exists but has no browse/trending/like mechanism comparable to GeoGuessr's community map catalog; even a small curated "Map of the Week" pull from `convex/maps.ts` `listPublic` would start the same user-generated content flywheel that gives GeoGuessr's map ecosystem its scale. Effort: **M**.

## 5. Priority call

If only three things ship next: **(1)** fix the solo/daily scoring-integrity bug — it's a landmine under the "fair, free alternative" pitch — **(2)** finish i18n on the reveal card + country names, since that's the cheapest, highest-visibility polish gap, and **(3)** ship the async streak-challenge link, since it's the lowest-effort, highest-virality item on this list and reuses code that already exists (`use-solo-game.ts` survival engine).

# Solo & Daily server-authoritative scoring

**Status:** backend landed 2026-07-04; client wiring deferred (see "Why partial").

## The problem

Solo and Daily Challenge scoring trusted the **client's claimed answer location**
(`results[i].actual`). `applySoloResults` recomputed distance/score/countryCorrect from
guess-vs-actual, but `actual` itself came from the client and was only range-checked, never
verified against a server-known truth. A modified client could send `guess === actual` to
fabricate perfect rounds — inflating XP and topping the global + per-day leaderboards.

Multiplayer never had this hole: `rooms.createRoomForUser` resolves the match locations once
(server-side, via `pickMatchLocations(mapId, rounds, seed)`), stores them hidden on the room,
and `submitGuess` scores against the **stored** location. This work brings solo/daily up to
that standard.

## What landed (backend — isolated, additive)

| File | Change |
| --- | --- |
| `convex/schema.ts` | New `soloSessions` table: `{ userId, mapId, settings, seed, locations[], consumedAt?, createdAt }`, `by_user`. Server owns the round locations; `consumedAt` = one-submit-per-session idempotency. |
| `convex/rateLimit.ts` | New `soloStart` bucket (300/day, mirrors `soloRecord`). |
| `convex/solo.ts` (new) | `startGame` mints a session (resolves + stores locations, returns `{ sessionId, mapId, settings, locations }`). `submitGame` re-derives each round's answer from `session.locations[round-1]`, folds progression, writes the games row, marks the session consumed. |
| `src/hooks/use-solo-game.ts` | New `fixedOrder` opt (below) + easter-egg gate fix. |

### Server trust model (`solo.submitGame`)

Trusted from the client: only the per-round **guess** `{lat,lng}|null` and the ISO country it
names (`guessCountryCode`, for the country bonus — same as `rooms.submitGuess`). Everything
else is server-derived:

- `actual` = `session.locations[round-1]` (never from the client).
- `distanceMeters` / `score` = recomputed via `computeGuessScore`.
- `countryCorrect` = recomputed against the server's answer country.

Rejected: `results.length !== locations.length`; any `round` not an integer in
`[1, locations.length]`; any repeated `round` (blocks resubmitting one easy round to multiply
XP); out-of-range guess coordinates; a second submit on a consumed session; a session owned by
another user.

### `fixedOrder` — the correctness-critical client invariant

`use-solo-game`'s `sampleLocations(customLocations, …)` **reshuffles** injected locations with
a fresh client seed. Under server re-derivation that would desync client round order from
`session.locations`, scoring each guess against the wrong answer. `fixedOrder: true` makes the
engine play the injected locations **verbatim, in order** (no resample, no easter-egg roll), so
client round `i` always maps to `session.locations[i-1]`.

> **Any flow that feeds server-owned locations MUST set `fixedOrder`.** This applies to both
> the cloud-solo path and Daily. Index-trust alternatives are unsafe: the client receives all
> locations up front, so letting it choose the round→location mapping would let it map each
> guess to its nearest real location for near-perfect scores. The binding must be
> server-fixed.

## Why partial

When this work started, the working tree held large **uncommitted parallel work** (friend
room-invites + custom-map plays/likes + country-clues) actively editing the exact files the
client half needs — most importantly it had just *extended* `recordSoloResult` with a
`customMapId` plays-counter. Removing/rewriting those files would have clobbered unrecoverable
uncommitted work, so only the additive backend + the isolated `use-solo-game` change landed.
`convex/solo.ts` is deployed but **unused**; `users.recordSoloResult` remains the live
solo-sync path until wiring lands.

## Remaining work (do once the parallel feature is committed)

1. **`play-client.tsx`** — for `features.convex && isAuthenticated && mode === "classic"`, mint a
   session via `solo.startGame` before rendering `SoloGame`; pass its `locations` as
   `customLocations`, plus `fixedOrder` and `sessionId`. Show the existing "Dropping you
   somewhere…" beat while minting. Guests / keyless / survival keep today's fully client-side
   path untouched (zero pre-game round-trip). "Play Again" mints a **new** session (orchestrate
   above `useSoloGame.restart`).
2. **`solo-game.tsx`** — accept `sessionId?` + `onPlayAgain?`; render `SoloCloudSync` only when
   `sessionId` present; route "Play Again" to `onPlayAgain` when provided.
3. **`solo-cloud-sync.tsx`** — call `api.solo.submitGame({ sessionId, results: [{round, guess,
   guessCountryCode}] })` instead of `recordSoloResult`. Treat an "Already submitted" error as
   success (don't retry/error-toast — server idempotency already saved it).
4. **`dailyChallenge.submit`** — compute `pickMatchLocations(DAILY_MAP, DAILY_ROUNDS, day)` and
   score against it (stop trusting client `actual`).
5. **`daily-client.tsx`** — pass `fixedOrder` to `SoloGame`; trim the submitted payload to
   `{round, guess, guessCountryCode}`.
6. **Consolidate** `users.applySoloResults` to accept a `locations: MatchLocation[]` array
   (drop `actual`/`distanceMeters`/`score`/`countryCorrect` from `roundArg`); route Daily +
   `solo.submitGame` through it; fold `solo.ts`'s `persistSoloGame` back in; **remove**
   `recordSoloResult`. **Preserve** the custom-map `plays`-counter path the parallel work added
   to `recordSoloResult` (route it through the new submit flow, or keep a dedicated
   plays-increment mutation).
7. Update `README.md` Status + note the removed `recordSoloResult` API surface.

## Explicit non-goals

- No anti-cheat beyond location validation (no fingerprinting, no timing heuristics).
  `guessCountryCode` stays client-trusted — matches `rooms.submitGuess`.
- Custom maps (`convex/maps.ts`) stream their full location pool to the client — a different
  (owner-uploaded, non-leaderboard) trust model. Not converted here.
- Survival mode has no Convex persistence today; not made server-authoritative.

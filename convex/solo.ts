import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { settingsValidator } from "./schema";
import { rateLimit } from "./rateLimit";
import {
  clampSettings,
  computeGuessScore,
  pickMatchLocations,
  type MatchLocation,
} from "./gameLogic";
import { foldGame, resolveCountryByMap } from "../src/lib/progression";
import { requireUser } from "./users";
import type { RoundResult } from "../src/lib/types";

/**
 * Server-authoritative solo scoring (classic solo — distance maps — and Daily
 * Challenge, which calls `persistSoloGame` directly from `dailyChallenge.ts`).
 *
 * `startGame` mints a session whose round locations the SERVER owns: resolved
 * once via the same `pickMatchLocations` rooms + daily already use, stored hidden
 * on `soloSessions`. `submitGame`/`persistSoloGame` re-derive each round's answer
 * from the server-owned locations array — the client's claimed answer
 * coordinates are never trusted. Only its guess and the ISO country it names
 * (for the country bonus) come from the client, exactly matching the
 * multiplayer reference (`rooms.submitGuess`). This closes the score-stuffing
 * gap where a modified client could send `guess === actual` to farm XP and top
 * leaderboards.
 *
 * Wired client-side via: `use-solo-game`'s `fixedOrder` (plays injected
 * locations verbatim, in order — required whenever the server owns round
 * order), `play-client.tsx` (mints a session before rendering `SoloGame` for
 * signed-in classic play), `daily-client.tsx` (same, for Daily), and
 * `solo-cloud-sync.tsx` (calls `submitGame` when a `sessionId` is present).
 *
 * Custom maps (`convex/maps.ts`) are NOT covered — they stream their full
 * owner-uploaded location pool to the client already (a different, accepted
 * trust model, not leaderboard-critical the same way). They keep using the
 * legacy `users.recordSoloResult` path, unchanged.
 */

// Trimmed round payload: the server owns `actual` (via session.locations) and
// recomputes distance/score/countryCorrect, so the client sends only its guess
// and the country it named for that round.
export const soloRoundArg = v.object({
  round: v.number(),
  guess: v.union(v.object({ lat: v.number(), lng: v.number() }), v.null()),
  guessCountryCode: v.union(v.string(), v.null()),
});

type SoloRoundArg = {
  round: number;
  guess: { lat: number; lng: number } | null;
  guessCountryCode: string | null;
};

const validGuess = (p: { lat: number; lng: number } | null) =>
  p === null ||
  (Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180);

/**
 * Fold a finished solo game into the user's profile and write the games-history
 * row, scoring each round against the server-owned `locations`. Mirrors
 * `users.applySoloResults` but takes the authoritative locations instead of
 * trusting client-submitted `actual` coordinates. Shared by `submitGame` below
 * and `dailyChallenge.submit`.
 */
export async function persistSoloGame(
  ctx: MutationCtx,
  user: Doc<"users">,
  mapId: string,
  settings: Doc<"soloSessions">["settings"],
  rawResults: SoloRoundArg[],
  locations: MatchLocation[],
  now: number,
) {
  const n = locations.length;
  // Exactly one result per server-issued round, each round referenced once — a
  // client can't pad the array, skip rounds, or resubmit an easy round to
  // multiply its XP contribution.
  if (rawResults.length !== n) throw new Error("Invalid game");
  const seen = new Set<number>();
  for (const r of rawResults) {
    if (!Number.isInteger(r.round) || r.round < 1 || r.round > n) {
      throw new Error("Invalid game");
    }
    if (seen.has(r.round)) throw new Error("Invalid game");
    seen.add(r.round);
    if (!validGuess(r.guess)) throw new Error("Invalid game");
  }

  const clamped = clampSettings(settings);
  const owned = await ctx.db
    .query("achievements")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const ownedIds = owned.map((a) => a.achievementId);

  // Score in round order (foldGame walks results in array order for the country
  // streak) against the SERVER's answer for each round.
  const results: RoundResult[] = [...rawResults]
    .sort((a, b) => a.round - b.round)
    .map((r) => {
      const actual = locations[r.round - 1];
      const answerCC = actual.countryCode.toUpperCase();
      const { distanceMeters, score } = computeGuessScore(r.guess, actual, mapId);
      // Only a plausible ISO alpha-2 code counts toward the country bonus.
      const guessCC =
        r.guessCountryCode && /^[A-Za-z]{2}$/.test(r.guessCountryCode)
          ? r.guessCountryCode.toUpperCase()
          : null;
      return {
        round: r.round,
        actual: { lat: actual.lat, lng: actual.lng, countryCode: answerCC },
        guess: r.guess,
        distanceMeters,
        score,
        timeMs: 0,
        guessCountryCode: guessCC,
        countryCorrect: !!guessCC && guessCC === answerCC,
      };
    });

  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: { ...user.streaks, countryByMap: resolveCountryByMap(user.streaks) },
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
    mapId,
  });

  const { xp, ...statsNoXp } = out.stats;
  const unlockedBuildings = out.newBuildings.length
    ? [...new Set([...(user.unlockedBuildings ?? []), ...out.newBuildings])]
    : undefined;
  await ctx.db.patch(user._id, {
    xp,
    stats: statsNoXp,
    streaks: out.streaks,
    lastActiveAt: now,
    ...(unlockedBuildings ? { unlockedBuildings } : {}),
  });

  for (const id of out.newAchievements) {
    await ctx.db.insert("achievements", { userId: user._id, achievementId: id, unlockedAt: now });
  }

  const maxScore = results.length * 5000;
  await ctx.db.insert("games", {
    userId: user._id,
    mode: "solo",
    mapId,
    settings: clamped,
    totalScore: out.totalScore,
    maxScore,
    rounds: results.length,
    avgDistanceMeters: out.avgDistanceMeters,
    perfectRounds: out.perfectRounds,
    won: out.won,
    replay: results.map((r) => ({
      round: r.round,
      actual: r.actual,
      guess: r.guess,
      distanceMeters: r.distanceMeters,
      score: r.score,
      guessCountryCode: r.guessCountryCode,
      countryCorrect: r.countryCorrect,
    })),
    createdAt: now,
  });

  return { out, results };
}

/**
 * Mint a solo session: resolve + store the round locations server-side and hand
 * them back to the client to play. The client renders these exact locations, in
 * order, then calls `submitGame` with only its per-round guesses.
 */
export const startGame = mutation({
  args: { mapId: v.string(), settings: settingsValidator },
  handler: async (ctx, { mapId, settings }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "soloStart", user._id);
    const clamped = clampSettings(settings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    const locations = pickMatchLocations(mapId, clamped.rounds, seed);
    const now = Date.now();
    const sessionId = await ctx.db.insert("soloSessions", {
      userId: user._id,
      mapId,
      settings: clamped,
      seed,
      locations,
      createdAt: now,
    });
    return { sessionId, mapId, settings: clamped, locations };
  },
});

/**
 * Score a finished solo session against its server-owned locations, fold it into
 * the profile, and mark the session consumed (one submit per session).
 */
export const submitGame = mutation({
  args: { sessionId: v.id("soloSessions"), results: v.array(soloRoundArg) },
  handler: async (ctx, { sessionId, results }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "soloRecord", user._id);
    const session = await ctx.db.get(sessionId);
    // Only the owner may submit, and only once (server-side idempotency — a
    // replayed/duplicate call can't double-count XP or insert a second history row).
    if (!session || session.userId !== user._id) throw new Error("Session not found");
    if (session.consumedAt) throw new Error("Already submitted");
    const now = Date.now();
    const { out } = await persistSoloGame(
      ctx,
      user,
      session.mapId,
      session.settings,
      results,
      session.locations,
      now,
    );
    await ctx.db.patch(sessionId, { consumedAt: now });
    return {
      xpGained: out.xpGained,
      newAchievements: out.newAchievements,
      newBuildings: out.newBuildings,
      leveledUp: out.leveledUp,
      won: out.won,
      totalScore: out.totalScore,
    };
  },
});

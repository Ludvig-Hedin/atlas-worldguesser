import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { settingsValidator, latLng } from "./schema";
import { rateLimit } from "./rateLimit";
import { computeGuessScore, pickMatchLocations, SURVIVAL_BUFFER } from "./gameLogic";
import { applySoloResults, currentUser, requireUser } from "./users";

/**
 * Async streak-challenge links: a friend attempts to beat a Survival-mode
 * streak on the EXACT same sequence of locations. Reuses the same
 * server-owned seed -> deterministic locations pipeline as Daily Challenge
 * (`pickMatchLocations`). The resolved locations are never persisted — `get`
 * and `submitAttempt` both recompute them fresh from `mapId`+`rounds`+`seed`,
 * so there's never a client-supplied locations array to trust.
 */

/** Mint a shareable challenge from a just-finished Survival run. */
export const create = mutation({
  args: {
    mapId: v.string(),
    settings: settingsValidator,
    creatorStreak: v.number(),
    creatorScore: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "challengeCreate", user._id);
    const seed = Math.floor(Math.random() * 0xffffffff);
    const challengeId = await ctx.db.insert("challenges", {
      creatorId: user._id,
      mapId: args.mapId,
      // Always the full buffer, not however far the creator actually got —
      // a challenger who survives further than the creator still needs a
      // real location waiting for them. Pinned at creation time so a future
      // change to SURVIVAL_BUFFER can't desync an already-shared link.
      rounds: SURVIVAL_BUFFER,
      settings: args.settings,
      seed,
      creatorStreak: Math.max(0, Math.floor(args.creatorStreak) || 0),
      creatorScore: Math.max(0, Math.floor(args.creatorScore) || 0),
      attemptCount: 0,
      createdAt: Date.now(),
    });
    return challengeId;
  },
});

/**
 * Public, unauthenticated read — same normalizeId-graceful pattern as
 * games.getReplay. Includes the caller's own saved attempt (if any and if
 * signed in) so a revisit shows the comparison instead of offering a
 * (blocked) replay.
 */
export const get = query({
  args: { challengeId: v.string() },
  handler: async (ctx, args) => {
    const challengeId = ctx.db.normalizeId("challenges", args.challengeId);
    if (!challengeId) return null;
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) return null;
    const creator = await ctx.db.get(challenge.creatorId);
    const locations = pickMatchLocations(challenge.mapId, challenge.rounds, challenge.seed);

    const me = await currentUser(ctx);
    let myAttempt: { streak: number; score: number } | null = null;
    if (me) {
      const existing = await ctx.db
        .query("challengeAttempts")
        .withIndex("by_challenge_user", (q) =>
          q.eq("challengeId", challengeId).eq("userId", me._id),
        )
        .unique();
      if (existing) myAttempt = { streak: existing.streak, score: existing.score };
    }

    return {
      _id: challenge._id,
      mapId: challenge.mapId,
      settings: challenge.settings,
      locations,
      creator: creator
        ? {
            username: creator.username,
            avatarUrl: creator.avatarUrl,
            avatarBuildingId: creator.avatarBuildingId,
            avatarColor: creator.avatarColor,
          }
        : null,
      creatorStreak: challenge.creatorStreak,
      creatorScore: challenge.creatorScore,
      attemptCount: challenge.attemptCount,
      myAttempt,
    };
  },
});

/**
 * Save a signed-in attempt at an existing challenge. One save per (challenge,
 * user) — a signed-out guest can still PLAY via SoloGame client-side, just
 * can't reach this mutation (requireUser) to persist it.
 *
 * Never trusts a client-claimed `actual`: only `guess`/`guessCountryCode`
 * cross the wire per round. `actual` is always re-derived server-side from
 * the recomputed `locations[round-1]`, then handed to `applySoloResults` —
 * which recomputes distance/score from guess-vs-actual anyway, so overriding
 * `actual` before calling it closes the "client claims its own answer" hole
 * documented in docs/solo-server-authoritative-scoring.md without needing
 * that migration to land first.
 */
export const submitAttempt = mutation({
  args: {
    challengeId: v.id("challenges"),
    results: v.array(
      v.object({
        round: v.number(),
        guess: v.union(latLng, v.null()),
        guessCountryCode: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "challengeAttempt", user._id);

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const existing = await ctx.db
      .query("challengeAttempts")
      .withIndex("by_challenge_user", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", user._id),
      )
      .unique();
    if (existing) throw new Error("You've already attempted this challenge.");

    const locations = pickMatchLocations(challenge.mapId, challenge.rounds, challenge.seed);
    if (args.results.length === 0 || args.results.length > locations.length) {
      throw new Error("Invalid attempt");
    }

    const seenRounds = new Set<number>();
    const rawResults = args.results
      .map((r) => {
        if (!Number.isInteger(r.round) || r.round < 1 || r.round > locations.length) {
          throw new Error("Invalid attempt");
        }
        if (seenRounds.has(r.round)) throw new Error("Invalid attempt");
        seenRounds.add(r.round);

        const actual = locations[r.round - 1];
        const { distanceMeters, score } = computeGuessScore(r.guess, actual, challenge.mapId);
        const guessCC =
          r.guessCountryCode && /^[A-Za-z]{2}$/.test(r.guessCountryCode)
            ? r.guessCountryCode.toUpperCase()
            : null;
        return {
          round: r.round,
          actual,
          guess: r.guess,
          distanceMeters,
          score,
          guessCountryCode: guessCC,
          countryCorrect: !!guessCC && guessCC === actual.countryCode.toUpperCase(),
        };
      })
      .sort((a, b) => a.round - b.round);

    const { out } = await applySoloResults(
      ctx,
      user,
      challenge.mapId,
      challenge.settings,
      rawResults,
      Date.now(),
      { maxRounds: locations.length },
    );

    // TODO(bug-hunt): round validation above only checks 1<=round<=locations.length
    // and no duplicates — it never requires the submitted rounds to be a
    // contiguous prefix starting at 1. A client can omit the round(s) it got
    // wrong and submit only the correct ones (e.g. 1,2,3,7,9 instead of 1-4),
    // inflating this "streak" past the true consecutive-from-start Survival
    // streak. Fix: require an unbroken prefix and stop counting at the first
    // countryCorrect === false, rather than filtering all of them.
    const streak = rawResults.filter((r) => r.countryCorrect).length;
    await ctx.db.insert("challengeAttempts", {
      challengeId: args.challengeId,
      userId: user._id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      streak,
      score: out.totalScore,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.challengeId, { attemptCount: challenge.attemptCount + 1 });

    return { streak, score: out.totalScore };
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rateLimit } from "./rateLimit";
import { pickMatchLocations } from "./gameLogic";
import { currentUser, isTestUser, requireUser } from "./users";
import { persistSoloGame, soloRoundArg } from "./solo";

/**
 * Daily Challenge: the same set of world locations for everyone each UTC day,
 * one attempt per player, ranked on a per-day leaderboard.
 *
 * The server owns the day's locations (derived deterministically from the day
 * number) so every player faces identical rounds — `submit` re-derives that
 * same location set itself (`pickMatchLocations(DAILY_MAP, DAILY_ROUNDS, day)`)
 * and scores against it via `persistSoloGame`, the same server-authoritative
 * path `solo.submitGame` uses. The client never gets to claim an `actual`
 * answer location — only its guess and the named country cross the wire.
 */

const DAY_MS = 86_400_000;
const dayNumber = (ts: number) => Math.floor(ts / DAY_MS);

const DAILY_MAP = "world";
const DAILY_ROUNDS = 5;
const DAILY_SETTINGS = {
  rounds: DAILY_ROUNDS,
  timeLimitSec: 0,
  movement: "moving" as const,
};

/** Today's challenge: fixed locations + whether the signed-in user has played. */
export const today = query({
  args: {},
  handler: async (ctx) => {
    const day = dayNumber(Date.now());
    const locations = pickMatchLocations(DAILY_MAP, DAILY_ROUNDS, day);
    const me = await currentUser(ctx);
    let played = false;
    if (me) {
      const existing = await ctx.db
        .query("dailyResults")
        .withIndex("by_day_user", (q) => q.eq("day", day).eq("userId", me._id))
        .unique();
      played = !!existing;
    }
    return { day, mapId: DAILY_MAP, settings: DAILY_SETTINGS, locations, played };
  },
});

/** Submit a finished daily run. One per (day, user); rejects stale/foreign days. */
export const submit = mutation({
  args: {
    day: v.number(),
    results: v.array(soloRoundArg),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "dailyRecord", user._id);
    const now = Date.now();
    const day = dayNumber(now);
    // Only today's challenge counts — no back-filling past days for easy points.
    if (args.day !== day) {
      throw new Error("This challenge has expired. Refresh for today's challenge.");
    }
    const existing = await ctx.db
      .query("dailyResults")
      .withIndex("by_day_user", (q) => q.eq("day", day).eq("userId", user._id))
      .unique();
    if (existing) throw new Error("You've already played today's challenge.");

    // Re-derive the day's answer locations ourselves — never trust a
    // client-claimed `actual`. Must match `today`'s query exactly (same
    // map/rounds/seed) so round i always scores against the same location
    // every player saw.
    const locations = pickMatchLocations(DAILY_MAP, DAILY_ROUNDS, day);
    const { out, results } = await persistSoloGame(
      ctx,
      user,
      DAILY_MAP,
      DAILY_SETTINGS,
      args.results,
      locations,
      now,
    );
    const correctCount = results.filter((r) => r.countryCorrect).length;
    await ctx.db.insert("dailyResults", {
      day,
      userId: user._id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      score: out.totalScore,
      correctCount,
      avgDistanceMeters: out.avgDistanceMeters,
      createdAt: now,
    });
    return { score: out.totalScore, correctCount };
  },
});

/** Ranked board for a day (default today) + the caller's own row. */
export const leaderboard = query({
  args: { day: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { day, limit }) => {
    const d = day ?? dayNumber(Date.now());
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    // Over-fetch a small margin beyond n so dropping test accounts doesn't
    // shrink the board below its requested size.
    const pool = await ctx.db
      .query("dailyResults")
      .withIndex("by_day_score", (q) => q.eq("day", d))
      .order("desc")
      .take(Math.min(n + 20, 200));
    // Live-joined for avatarBuildingId/avatarColor (not denormalized like
    // avatarUrl/username above) so a color change shows up immediately
    // instead of only on the next daily run — also doubles as the test-account
    // check below. A row whose user was since deleted is kept (never a test
    // account, since it no longer exists) rather than silently dropped.
    const rows = (
      await Promise.all(pool.map(async (r) => ({ r, u: await ctx.db.get(r.userId) })))
    )
      .filter(({ u }) => !u || !isTestUser(u))
      .slice(0, n);

    const me = await currentUser(ctx);
    let mine: { rank: number; score: number; correctCount: number } | null = null;
    if (me) {
      const inTop = rows.findIndex(({ r }) => r.userId === me._id);
      if (inTop >= 0) {
        mine = { rank: inTop + 1, score: rows[inTop].r.score, correctCount: rows[inTop].r.correctCount };
      } else {
        const own = await ctx.db
          .query("dailyResults")
          .withIndex("by_day_user", (q) => q.eq("day", d).eq("userId", me._id))
          .unique();
        // Below the top N: report score without an exact rank (avoids a full scan).
        if (own) mine = { rank: 0, score: own.score, correctCount: own.correctCount };
      }
    }
    const entries = rows.map(({ r, u }, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      avatarUrl: r.avatarUrl,
      avatarBuildingId: u?.avatarBuildingId,
      avatarColor: u?.avatarColor,
      score: r.score,
      correctCount: r.correctCount,
    }));
    return { day: d, entries, mine };
  },
});

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rateLimit } from "./rateLimit";
import { pickMatchLocations } from "./gameLogic";
import { applySoloResults, currentUser, requireUser, roundArg } from "./users";

/**
 * Daily Challenge: the same set of world locations for everyone each UTC day,
 * one attempt per player, ranked on a per-day leaderboard.
 *
 * The server owns the day's locations (derived deterministically from the day
 * number) so every player faces identical rounds. Scoring is still recomputed
 * server-side in applySoloResults; solo remains client-authoritative for the
 * `actual` coordinates, so this is a casual board, not an anti-cheat system.
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
    results: v.array(roundArg),
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

    const { out, results } = await applySoloResults(
      ctx,
      user,
      DAILY_MAP,
      DAILY_SETTINGS,
      args.results,
      now,
      { maxRounds: DAILY_ROUNDS },
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
    const rows = await ctx.db
      .query("dailyResults")
      .withIndex("by_day_score", (q) => q.eq("day", d))
      .order("desc")
      .take(n);
    const me = await currentUser(ctx);
    let mine: { rank: number; score: number; correctCount: number } | null = null;
    if (me) {
      const inTop = rows.findIndex((r) => r.userId === me._id);
      if (inTop >= 0) {
        mine = { rank: inTop + 1, score: rows[inTop].score, correctCount: rows[inTop].correctCount };
      } else {
        const own = await ctx.db
          .query("dailyResults")
          .withIndex("by_day_user", (q) => q.eq("day", d).eq("userId", me._id))
          .unique();
        // Below the top N: report score without an exact rank (avoids a full scan).
        if (own) mine = { rank: 0, score: own.score, correctCount: own.correctCount };
      }
    }
    // Live-joined for avatarBuildingId/avatarColor (not denormalized like
    // avatarUrl/username above) so a color change shows up immediately
    // instead of only on the next daily run.
    const entries = await Promise.all(
      rows.map(async (r, i) => {
        const u = await ctx.db.get(r.userId);
        return {
          rank: i + 1,
          userId: r.userId,
          username: r.username,
          avatarUrl: r.avatarUrl,
          avatarBuildingId: u?.avatarBuildingId,
          avatarColor: u?.avatarColor,
          score: r.score,
          correctCount: r.correctCount,
        };
      }),
    );
    return { day: d, entries, mine };
  },
});

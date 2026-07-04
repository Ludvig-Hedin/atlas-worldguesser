import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rateLimit } from "./rateLimit";
import { currentUser, requireUser } from "./users";
import { FLAG_MAX_WRONG, flagRunScore, flagXpForRun } from "../src/lib/flags/scoring";

/**
 * Flags mode persistence: XP into the shared pool + an all-time best-score board
 * per region. Score and XP are recomputed server-side from the per-flag wrong
 * counts — the client's own numbers are never trusted (mirrors applySoloResults).
 */

// Region ids are hardcoded (regions.ts uses the `@/` alias, which the Convex
// bundler doesn't resolve). Kept in sync with src/lib/flags/regions.ts.
const REGIONS = new Set(["world", "europe", "asia", "africa", "americas", "oceania"]);
const MAX_FLAGS = 10;

export const submit = mutation({
  args: { region: v.string(), perFlagWrong: v.array(v.number()) },
  handler: async (ctx, { region, perFlagWrong }) => {
    const user = await requireUser(ctx);
    if (!REGIONS.has(region)) throw new Error("Invalid game");
    if (perFlagWrong.length < 1 || perFlagWrong.length > MAX_FLAGS) throw new Error("Invalid game");
    for (const w of perFlagWrong) {
      if (!Number.isInteger(w) || w < 0 || w > FLAG_MAX_WRONG) throw new Error("Invalid game");
    }
    await rateLimit(ctx, "flagRecord", user._id);

    const now = Date.now();
    const score = flagRunScore(perFlagWrong);
    const xpGained = flagXpForRun(perFlagWrong);
    const correctCount = perFlagWrong.filter((w) => w < FLAG_MAX_WRONG).length;

    // Award XP directly — no foldGame / games row (flags aren't distance games).
    const prev = user.flagStats ?? { gamesPlayed: 0, bestScore: 0 };
    await ctx.db.patch(user._id, {
      xp: user.xp + xpGained,
      lastActiveAt: now,
      flagStats: {
        gamesPlayed: prev.gamesPlayed + 1,
        bestScore: Math.max(prev.bestScore, score),
      },
    });

    // Upsert the region's best-per-user row.
    const existing = await ctx.db
      .query("flagResults")
      .withIndex("by_region_user", (q) => q.eq("region", region).eq("userId", user._id))
      .unique();
    if (!existing) {
      await ctx.db.insert("flagResults", {
        region,
        userId: user._id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bestScore: score,
        flagCount: perFlagWrong.length,
        correctCount,
        updatedAt: now,
      });
    } else if (score > existing.bestScore) {
      await ctx.db.patch(existing._id, {
        bestScore: score,
        flagCount: perFlagWrong.length,
        correctCount,
        username: user.username,
        avatarUrl: user.avatarUrl,
        updatedAt: now,
      });
    }

    return { score, xpGained, best: Math.max(existing?.bestScore ?? 0, score) };
  },
});

/** Ranked best-score board for a region + the caller's own row. */
export const leaderboard = query({
  args: { region: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { region, limit }) => {
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    const rows = await ctx.db
      .query("flagResults")
      .withIndex("by_region_score", (q) => q.eq("region", region))
      .order("desc")
      .take(n);

    const me = await currentUser(ctx);
    let mine: { rank: number; bestScore: number } | null = null;
    if (me) {
      const inTop = rows.findIndex((r) => r.userId === me._id);
      if (inTop >= 0) {
        mine = { rank: inTop + 1, bestScore: rows[inTop].bestScore };
      } else {
        const own = await ctx.db
          .query("flagResults")
          .withIndex("by_region_user", (q) => q.eq("region", region).eq("userId", me._id))
          .unique();
        // Below the top N: report the score without an exact rank (avoids a scan).
        if (own) mine = { rank: 0, bestScore: own.bestScore };
      }
    }

    // Live-join avatar building/color so a change shows immediately.
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
          bestScore: r.bestScore,
          correctCount: r.correctCount,
          flagCount: r.flagCount,
        };
      }),
    );
    return { region, entries, mine };
  },
});

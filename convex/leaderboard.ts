import { v } from "convex/values";
import { query } from "./_generated/server";
import { levelForXp } from "../src/lib/xp";

/** Global leaderboard by XP. */
export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = Math.min(limit ?? 50, 100);
    const users = await ctx.db.query("users").withIndex("by_xp").order("desc").take(n);
    return users.map((u, i) => ({
      rank: i + 1,
      _id: u._id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      xp: u.xp,
      level: levelForXp(u.xp),
      gamesPlayed: u.stats.gamesPlayed,
      wins: u.stats.wins,
    }));
  },
});

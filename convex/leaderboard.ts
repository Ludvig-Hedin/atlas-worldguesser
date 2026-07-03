import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { levelForXp } from "../src/lib/xp";
import { currentUser } from "./users";

function row(u: Doc<"users">, rank: number) {
  return {
    rank,
    _id: u._id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    xp: u.xp,
    level: levelForXp(u.xp),
    gamesPlayed: u.stats.gamesPlayed,
    wins: u.stats.wins,
  };
}

/** Global leaderboard by XP. */
export const top = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const n = Math.min(limit ?? 50, 100);
    const users = await ctx.db.query("users").withIndex("by_xp").order("desc").take(n);
    return users.map((u, i) => row(u, i + 1));
  },
});

/**
 * The signed-in user's own leaderboard row + global rank, so players outside
 * the top N still see where they stand. Null for guests / unranked users.
 * Rank = (# of users with strictly higher XP) + 1.
 */
export const myRank = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return null;
    const higher = await ctx.db
      .query("users")
      .withIndex("by_xp", (q) => q.gt("xp", me.xp))
      .collect();
    return row(me, higher.length + 1);
  },
});

/** Leaderboard scoped to the signed-in user's accepted friends (plus themselves). */
export const friends = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return [];
    const [asUser, asFriend] = await Promise.all([
      ctx.db.query("friends").withIndex("by_user", (q) => q.eq("userId", me._id)).collect(),
      ctx.db.query("friends").withIndex("by_friend", (q) => q.eq("friendId", me._id)).collect(),
    ]);
    const ids = new Set<Id<"users">>([me._id]);
    for (const r of [...asUser, ...asFriend]) {
      if (r.status !== "accepted") continue;
      ids.add(r.userId === me._id ? r.friendId : r.userId);
    }
    const users = (await Promise.all([...ids].map((id) => ctx.db.get(id)))).filter(
      (u): u is Doc<"users"> => u !== null,
    );
    users.sort((a, b) => b.xp - a.xp);
    return users.map((u, i) => row(u, i + 1));
  },
});

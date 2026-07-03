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
    avatarBuildingId: u.avatarBuildingId,
    avatarColor: u.avatarColor,
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
    // Clamp both ends — a client-sent negative/NaN limit would make .take() throw.
    const n = Math.max(1, Math.min(Math.floor(limit ?? 50) || 50, 100));
    const users = await ctx.db.query("users").withIndex("by_xp").order("desc").take(n);
    // Competition ranking (ties share a rank) so this list agrees with
    // myRank's "(# strictly higher) + 1" for tied XP values.
    const rows: ReturnType<typeof row>[] = [];
    for (let i = 0; i < users.length; i++) {
      const rank = i > 0 && users[i].xp === users[i - 1].xp ? rows[i - 1].rank : i + 1;
      rows.push(row(users[i], rank));
    }
    return rows;
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
    // Bounded read: `.collect()` would materialize every higher-XP user and
    // can blow Convex's per-query read limits for low-ranked players. Past
    // the cap the rank is reported as RANK_CAP + 1 ("you're way down there").
    // TODO(bug-hunt): switch to a maintained count (@convex-dev/aggregate)
    // if the user base outgrows this.
    const RANK_CAP = 5000;
    const higher = await ctx.db
      .query("users")
      .withIndex("by_xp", (q) => q.gt("xp", me.xp))
      .take(RANK_CAP);
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

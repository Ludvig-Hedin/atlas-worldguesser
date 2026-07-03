import { v } from "convex/values";
import { query } from "./_generated/server";
import { currentUser } from "./users";

/** A full game replay (public — anyone with the id can watch). */
export const getReplay = query({
  // The id comes straight from the URL — accept any string and normalize, so
  // /replay/garbage renders the "not found" state instead of crashing.
  args: { gameId: v.string() },
  handler: async (ctx, args) => {
    const gameId = ctx.db.normalizeId("games", args.gameId);
    if (!gameId) return null;
    const g = await ctx.db.get(gameId);
    if (!g) return null;
    const owner = await ctx.db.get(g.userId);
    return {
      _id: g._id,
      mapId: g.mapId,
      mode: g.mode,
      settings: g.settings,
      totalScore: g.totalScore,
      maxScore: g.maxScore,
      rounds: g.rounds,
      replay: g.replay,
      createdAt: g.createdAt,
      owner: owner ? { username: owner.username, avatarUrl: owner.avatarUrl } : null,
    };
  },
});

/** The signed-in user's recent games. */
export const myGames = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const games = await ctx.db
      .query("games")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
    return games.map((g) => ({
      _id: g._id,
      mapId: g.mapId,
      mode: g.mode,
      totalScore: g.totalScore,
      maxScore: g.maxScore,
      rounds: g.rounds,
      avgDistanceMeters: g.avgDistanceMeters,
      won: g.won,
      createdAt: g.createdAt,
    }));
  },
});

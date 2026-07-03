import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { settingsValidator } from "./schema";
import { rateLimit } from "./rateLimit";
import { ANTIPODE_METERS, clampSettings } from "./gameLogic";
import { foldGame } from "../src/lib/progression";
import { levelForXp } from "../src/lib/xp";
import { ACHIEVEMENTS } from "../src/lib/achievements";
import type { RoundResult } from "../src/lib/types";

const VALID_ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const statsShape = {
  gamesPlayed: v.number(),
  roundsPlayed: v.number(),
  wins: v.number(),
  bestScore: v.number(),
  totalDistanceMeters: v.number(),
  countryCorrect: v.number(),
  countryTotal: v.number(),
};
const streaksShape = {
  daily: v.number(),
  lastPlayedDay: v.number(),
  win: v.number(),
  bestWin: v.number(),
  country: v.number(),
  bestCountry: v.number(),
};
const clampInt = (n: number, max: number) =>
  Math.max(0, Math.min(Math.floor(Number.isFinite(n) ? n : 0), max));

const EMPTY_STATS = {
  gamesPlayed: 0,
  roundsPlayed: 0,
  wins: 0,
  bestScore: 0,
  totalDistanceMeters: 0,
  countryCorrect: 0,
  countryTotal: 0,
};
const EMPTY_STREAKS = {
  daily: 0,
  lastPlayedDay: 0,
  win: 0,
  bestWin: 0,
  country: 0,
  bestCountry: 0,
};

export async function currentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Throw unless authenticated + provisioned. */
export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

function publicProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    xp: user.xp,
    level: levelForXp(user.xp),
    stats: user.stats,
    streaks: user.streaks,
    createdAt: user.createdAt,
  };
}

export type PublicProfile = ReturnType<typeof publicProfile>;

function sanitizeUsername(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `player${Math.floor(Math.random() * 100000)}`;
}

async function uniqueUsername(ctx: MutationCtx, base: string): Promise<string> {
  let candidate = sanitizeUsername(base);
  for (let i = 0; i < 20; i++) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("usernameLower", candidate.toLowerCase()))
      .unique();
    if (!existing) return candidate;
    candidate = `${sanitizeUsername(base).slice(0, 15)}${Math.floor(Math.random() * 10000)}`;
  }
  return `player${Math.floor(Math.random() * 1_000_000)}`;
}

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return user ? publicProfile(user) : null;
  },
});

/** Idempotently provision the current Clerk user in Convex. */
export const ensureUser = mutation({
  args: { username: v.optional(v.string()), avatarUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
        ...(args.avatarUrl ? { avatarUrl: args.avatarUrl } : {}),
      });
      return existing._id;
    }

    const base =
      args.username ||
      (identity.nickname as string | undefined) ||
      (identity.name as string | undefined) ||
      (identity.email ? identity.email.split("@")[0] : "player");
    const username = await uniqueUsername(ctx, base);

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      username,
      usernameLower: username.toLowerCase(),
      avatarUrl: args.avatarUrl ?? (identity.pictureUrl as string | undefined),
      xp: 0,
      createdAt: now,
      lastActiveAt: now,
      stats: EMPTY_STATS,
      streaks: EMPTY_STREAKS,
    });
  },
});

export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await requireUser(ctx);
    // Reject invalid input instead of silently swapping in sanitizeUsername's
    // random `playerNNNNN` fallback (that fallback is for provisioning only).
    const cleaned = username.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    if (cleaned.length < 3) {
      throw new Error("Username must be 3–20 letters, numbers, or underscores");
    }
    const clean = cleaned;
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("usernameLower", clean.toLowerCase()))
      .unique();
    if (taken && taken._id !== user._id) throw new Error("That username is taken");
    // TODO(bug-hunt): renaming leaves denormalized copies stale — maps.ownerName
    // and roomMembers.username keep the old name. Patch those here (or read the
    // live username at query time) if rename-consistency matters.
    await ctx.db.patch(user._id, { username: clean, usernameLower: clean.toLowerCase() });
    return clean;
  },
});

export const profileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("usernameLower", username.toLowerCase()))
      .unique();
    if (!user) return null;

    const [achievements, recent] = await Promise.all([
      ctx.db.query("achievements").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("games").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(12),
    ]);

    return {
      profile: publicProfile(user),
      achievements: achievements.map((a) => ({ id: a.achievementId, unlockedAt: a.unlockedAt })),
      recent: recent.map((g) => ({
        _id: g._id,
        mapId: g.mapId,
        mode: g.mode,
        totalScore: g.totalScore,
        maxScore: g.maxScore,
        rounds: g.rounds,
        avgDistanceMeters: g.avgDistanceMeters,
        won: g.won,
        createdAt: g.createdAt,
      })),
    };
  },
});

const roundArg = v.object({
  round: v.number(),
  actual: v.object({ lat: v.number(), lng: v.number(), countryCode: v.string() }),
  guess: v.union(v.object({ lat: v.number(), lng: v.number() }), v.null()),
  distanceMeters: v.number(),
  score: v.number(),
  guessCountryCode: v.union(v.string(), v.null()),
  countryCorrect: v.boolean(),
});

/** Sync a finished solo game to the cloud profile (stats, streaks, XP, achievements, history). */
export const recordSoloResult = mutation({
  args: {
    mapId: v.string(),
    settings: settingsValidator,
    results: v.array(roundArg),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "soloRecord", user._id);
    if (args.results.length === 0 || args.results.length > 20) {
      throw new Error("Invalid game");
    }
    // Clients can send arbitrary numbers (validators accept NaN/Infinity), and
    // these feed XP + the global leaderboard. Reject anything a real round
    // can't produce — mirrors the clamping importGuestProfile already does.
    for (const r of args.results) {
      const validLatLng = (p: { lat: number; lng: number } | null) =>
        p === null ||
        (Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
      if (
        !validLatLng(r.actual) ||
        !validLatLng(r.guess) ||
        !Number.isFinite(r.distanceMeters) ||
        r.distanceMeters < 0 ||
        r.distanceMeters > ANTIPODE_METERS * 1.01 ||
        !Number.isFinite(r.score) ||
        r.score < 0 ||
        r.score > 5000
      ) {
        throw new Error("Invalid game");
      }
    }
    const settings = clampSettings(args.settings);
    const now = Date.now();

    const owned = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const ownedIds = owned.map((a) => a.achievementId);

    const results: RoundResult[] = args.results.map((r) => ({
      round: r.round,
      actual: { lat: r.actual.lat, lng: r.actual.lng, countryCode: r.actual.countryCode },
      guess: r.guess,
      distanceMeters: r.distanceMeters,
      score: Math.round(r.score),
      timeMs: 0,
      guessCountryCode: r.guessCountryCode,
      countryCorrect: r.countryCorrect,
    }));

    const out = foldGame({
      stats: { ...user.stats, xp: user.xp },
      streaks: user.streaks,
      ownedAchievements: ownedIds,
      results,
      now,
    });

    const { xp, ...statsNoXp } = out.stats;
    await ctx.db.patch(user._id, { xp, stats: statsNoXp, streaks: out.streaks, lastActiveAt: now });

    for (const id of out.newAchievements) {
      await ctx.db.insert("achievements", { userId: user._id, achievementId: id, unlockedAt: now });
    }

    // Derive from the actual results so the stored game can't self-contradict
    // when the claimed settings.rounds differs from the rounds submitted.
    const maxScore = results.length * 5000;
    await ctx.db.insert("games", {
      userId: user._id,
      mode: "solo",
      mapId: args.mapId,
      settings,
      totalScore: out.totalScore,
      maxScore,
      rounds: results.length,
      avgDistanceMeters: out.avgDistanceMeters,
      perfectRounds: out.perfectRounds,
      won: out.won,
      replay: args.results,
      createdAt: now,
    });

    return {
      xpGained: out.xpGained,
      newAchievements: out.newAchievements,
      leveledUp: out.leveledUp,
      won: out.won,
      totalScore: out.totalScore,
    };
  },
});

/**
 * One-time import of a guest's on-device (localStorage) progress into a
 * freshly-created cloud account. To keep this from being abused as a stat
 * injector, it ONLY applies when the account has never recorded a game
 * (gamesPlayed === 0 && xp === 0). Values are clamped to sane bounds and
 * achievement ids validated against the known set. Idempotent: a second call
 * (or a call on a non-fresh account) is a no-op that returns { merged: false }.
 */
export const importGuestProfile = mutation({
  args: {
    xp: v.number(),
    stats: v.object(statsShape),
    streaks: v.object(streaksShape),
    achievements: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.stats.gamesPlayed > 0 || user.xp > 0) return { merged: false };
    if (args.stats.gamesPlayed <= 0) return { merged: false };

    const stats = {
      gamesPlayed: clampInt(args.stats.gamesPlayed, 1_000_000),
      roundsPlayed: clampInt(args.stats.roundsPlayed, 10_000_000),
      wins: clampInt(args.stats.wins, 1_000_000),
      bestScore: clampInt(args.stats.bestScore, 50_000),
      totalDistanceMeters: clampInt(args.stats.totalDistanceMeters, Number.MAX_SAFE_INTEGER),
      countryCorrect: clampInt(args.stats.countryCorrect, 10_000_000),
      countryTotal: clampInt(args.stats.countryTotal, 10_000_000),
    };
    const streaks = {
      daily: clampInt(args.streaks.daily, 100_000),
      lastPlayedDay: clampInt(args.streaks.lastPlayedDay, Number.MAX_SAFE_INTEGER),
      win: clampInt(args.streaks.win, 100_000),
      bestWin: clampInt(args.streaks.bestWin, 100_000),
      country: clampInt(args.streaks.country, 10_000_000),
      bestCountry: clampInt(args.streaks.bestCountry, 10_000_000),
    };
    const now = Date.now();
    await ctx.db.patch(user._id, {
      xp: clampInt(args.xp, Number.MAX_SAFE_INTEGER),
      stats,
      streaks,
      lastActiveAt: now,
    });

    const owned = new Set(
      (
        await ctx.db
          .query("achievements")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect()
      ).map((a) => a.achievementId),
    );
    let importedAchievements = 0;
    for (const id of args.achievements) {
      if (!VALID_ACHIEVEMENT_IDS.has(id) || owned.has(id)) continue;
      owned.add(id);
      await ctx.db.insert("achievements", { userId: user._id, achievementId: id, unlockedAt: now });
      importedAchievements++;
    }

    return { merged: true, gamesPlayed: stats.gamesPlayed, importedAchievements };
  },
});

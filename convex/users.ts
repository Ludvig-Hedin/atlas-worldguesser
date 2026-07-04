import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { settingsValidator } from "./schema";
import { rateLimit } from "./rateLimit";
import { ANTIPODE_METERS, clampSettings, computeGuessScore } from "./gameLogic";
import { foldGame, resolveCountryByMap } from "../src/lib/progression";
import { levelForXp } from "../src/lib/xp";
import { DEFAULT_RATING, tierForRating } from "../src/lib/rating";
import { ACHIEVEMENTS } from "../src/lib/achievements";
import { BUILDINGS, AVATAR_COLORS } from "../src/lib/buildings";
import type { RoundResult } from "../src/lib/types";

const VALID_ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((a) => a.id));
const VALID_BUILDING_IDS = new Set(Object.keys(BUILDINGS));
const statsShape = {
  gamesPlayed: v.number(),
  roundsPlayed: v.number(),
  wins: v.number(),
  bestScore: v.number(),
  totalDistanceMeters: v.number(),
  countryCorrect: v.number(),
  countryTotal: v.number(),
};
// Shape of the streaks payload a client (guest → cloud import) sends. The
// client always normalizes to the current shape before sending (see
// loadProfile in src/lib/local-profile.ts) — legacy country/bestCountry are
// never sent, only the DB-side schema.ts still carries them for old rows.
const streaksShape = {
  daily: v.number(),
  lastPlayedDay: v.number(),
  win: v.number(),
  bestWin: v.number(),
  countryByMap: v.optional(
    v.record(v.string(), v.object({ current: v.number(), best: v.number() })),
  ),
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
  countryByMap: {},
};

/**
 * Resolve the acting user. Clerk identity ALWAYS wins: only when there is no
 * Clerk session AND a non-empty `guestId` is supplied do we fall back to the
 * ephemeral guest account keyed by that id. This ordering means a device that
 * later signs in never has to clear a leftover guest id, and — crucially — only
 * callers that explicitly thread `guestId` (rooms.ts, chat.ts) opt into guest
 * access; every other Clerk-only caller passes no arg and stays Clerk-only.
 */
export async function currentUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();
  }
  const trimmed = guestId?.trim();
  if (!trimmed) return null;
  // `.first()` (not `.unique()`): a rare double-provision race across two tabs
  // could leave two rows for one guest id; the read path must degrade to the
  // earliest row rather than throw and break the guest's whole session.
  return await ctx.db
    .query("users")
    .withIndex("by_guest_session", (q) => q.eq("guestSessionId", trimmed))
    .first();
}

/** Throw unless authenticated + provisioned (Clerk, or a provisioned guest). */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  guestId?: string,
): Promise<Doc<"users">> {
  const user = await currentUser(ctx, guestId);
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Increment the denormalized total-users counter. Called only when a brand-new
 * user row is inserted (see appStats in schema.ts). Read by presence.homeStats.
 */
async function bumpUserCount(ctx: MutationCtx): Promise<void> {
  // .first() (not .unique()) so a stray duplicate counter row can't make every
  // new-user signup throw; matches presence.homeStats' defensive read.
  const stat = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .first();
  if (stat) await ctx.db.patch(stat._id, { totalUsers: stat.totalUsers + 1 });
  else await ctx.db.insert("appStats", { key: "global", totalUsers: 1 });
}

function publicProfile(user: Doc<"users">) {
  return {
    _id: user._id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    avatarBuildingId: user.avatarBuildingId,
    avatarColor: user.avatarColor,
    unlockedBuildings: user.unlockedBuildings ?? [],
    xp: user.xp,
    level: levelForXp(user.xp),
    // Ranked rating (ELO-lite): undefined = never played rated, reads as the
    // default 1000. ratingGamesPlayed drives the "Unranked until placed" UI.
    rating: user.rating ?? DEFAULT_RATING,
    ratingGamesPlayed: user.ratingGamesPlayed ?? 0,
    tier: tierForRating(user.rating ?? DEFAULT_RATING).key,
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
    const email = identity.email as string | undefined;
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
        ...(args.avatarUrl ? { avatarUrl: args.avatarUrl } : {}),
        // Keep in sync in case the user changes their email in Clerk.
        ...(email && email !== existing.email ? { email } : {}),
      });
      return existing._id;
    }

    const base =
      args.username ||
      (identity.nickname as string | undefined) ||
      (identity.name as string | undefined) ||
      (email ? email.split("@")[0] : "player");
    const username = await uniqueUsername(ctx, base);

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      username,
      usernameLower: username.toLowerCase(),
      email,
      avatarUrl: args.avatarUrl ?? (identity.pictureUrl as string | undefined),
      xp: 0,
      createdAt: now,
      lastActiveAt: now,
      stats: EMPTY_STATS,
      streaks: EMPTY_STREAKS,
    });
    await bumpUserCount(ctx);
    return userId;
  },
});

/**
 * Idempotently provision an EPHEMERAL guest account keyed by a client-generated
 * session id (localStorage "atlas.guestId"), giving signed-out visitors full
 * multiplayer parity. Deliberately does NOT call bumpUserCount — guests must
 * not inflate the all-time total-players counter (presence.homeStats) — and
 * they are kept off the persistent leaderboard by the isGuest filter in
 * convex/leaderboard.ts.
 *
 * Ephemeral cleanup is intentionally DEFERRED for v1: guest rows (and the
 * roomMembers/guesses/chat/games they generate) persist until manually pruned.
 * A TTL / cascading-delete cron is a documented follow-up (see BACKLOG.md),
 * not built here — unnecessary complexity at current scale.
 */
export const ensureGuestUser = mutation({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    const trimmed = guestId.trim().slice(0, 64);
    // A real client id (crypto.randomUUID / fallback) is always ≥ 8 chars;
    // reject shorter values so a stray "" or "x" can't mint an account.
    if (trimmed.length < 8) throw new Error("Invalid guest session");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_guest_session", (q) => q.eq("guestSessionId", trimmed))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastActiveAt: now });
      return existing._id;
    }

    // Rate-limit only genuine creation (each id creates at most one row), so a
    // legit guest reconnecting is never locked out — see rateLimit.guestProvision.
    await rateLimit(ctx, "guestProvision", trimmed);

    const username = await uniqueUsername(ctx, "Guest");
    const userId = await ctx.db.insert("users", {
      // clerkId omitted — guests have no Clerk identity.
      isGuest: true,
      guestSessionId: trimmed,
      username,
      usernameLower: username.toLowerCase(),
      xp: 0,
      createdAt: now,
      lastActiveAt: now,
      stats: EMPTY_STATS,
      streaks: EMPTY_STREAKS,
    });
    return userId;
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

export const roundArg = v.object({
  round: v.number(),
  actual: v.object({ lat: v.number(), lng: v.number(), countryCode: v.string() }),
  guess: v.union(v.object({ lat: v.number(), lng: v.number() }), v.null()),
  distanceMeters: v.number(),
  score: v.number(),
  guessCountryCode: v.union(v.string(), v.null()),
  countryCorrect: v.boolean(),
});

type SoloRoundArg = {
  round: number;
  actual: { lat: number; lng: number; countryCode: string };
  guess: { lat: number; lng: number } | null;
  distanceMeters: number;
  score: number;
  guessCountryCode: string | null;
  countryCorrect: boolean;
};
type SoloSettings = {
  rounds: number;
  timeLimitSec: number;
  movement: "moving" | "noMove" | "noMoveNoPanZoom";
};

/**
 * Shared core for finishing a solo-style game (classic solo + daily challenge):
 * validates untrusted rounds, recomputes distance/score server-side, folds
 * progression (stats/streaks/XP/achievements), and writes the games history row.
 * Returns the fold output + normalized results so callers can build extras
 * (e.g. a daily leaderboard row). Does NOT rate-limit — each caller does that.
 */
export async function applySoloResults(
  ctx: MutationCtx,
  user: Doc<"users">,
  mapId: string,
  settings: SoloSettings,
  rawResults: SoloRoundArg[],
  now: number,
  opts?: { maxRounds?: number },
) {
  const maxRounds = opts?.maxRounds ?? 20;
  if (rawResults.length === 0 || rawResults.length > maxRounds) {
    throw new Error("Invalid game");
  }
  // Clients can send arbitrary numbers (validators accept NaN/Infinity), and
  // these feed XP + the global leaderboard. Reject anything a real round
  // can't produce — mirrors the clamping importGuestProfile already does.
  for (const r of rawResults) {
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
      r.score > 5000 ||
      // "" is legal (custom-map locations without a resolved country).
      !/^([A-Za-z]{2})?$/.test(r.actual.countryCode)
    ) {
      throw new Error("Invalid game");
    }
  }
  const clamped = clampSettings(settings);

  const owned = await ctx.db
    .query("achievements")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();
  const ownedIds = owned.map((a) => a.achievementId);

  // Recompute distance + score server-side from guess/actual instead of
  // trusting the client's numbers (XP + the global leaderboard hang off these).
  const results: RoundResult[] = rawResults.map((r) => {
    const { distanceMeters, score } = computeGuessScore(r.guess, r.actual, mapId);
    // Only a plausible ISO alpha-2 code is stored / counted for the bonus.
    const guessCC =
      r.guessCountryCode && /^[A-Za-z]{2}$/.test(r.guessCountryCode)
        ? r.guessCountryCode.toUpperCase()
        : null;
    return {
      round: r.round,
      actual: {
        lat: r.actual.lat,
        lng: r.actual.lng,
        countryCode: r.actual.countryCode.toUpperCase(),
      },
      guess: r.guess,
      distanceMeters,
      score,
      timeMs: 0,
      guessCountryCode: guessCC,
      countryCorrect: !!guessCC && guessCC === r.actual.countryCode.toUpperCase(),
    };
  });

  const out = foldGame({
    stats: { ...user.stats, xp: user.xp },
    streaks: user.streaks,
    ownedAchievements: ownedIds,
    unlockedBuildings: user.unlockedBuildings ?? [],
    results,
    now,
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

  // Derive from the actual results so the stored game can't self-contradict
  // when the claimed settings.rounds differs from the rounds submitted.
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
    // Store the server-recomputed rounds, not the client's claimed numbers.
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

  return { out, results, maxScore };
}

/** Sync a finished solo game to the cloud profile (stats, streaks, XP, achievements, history). */
export const recordSoloResult = mutation({
  args: {
    mapId: v.string(),
    // Real Convex id of the custom map being played, when applicable. `mapId`
    // above stays the literal "custom" sentinel the game engine uses for
    // scoring/location-pool lookups (see src/components/maps/custom-play.tsx)
    // — this is a separate, optional channel just for the plays counter.
    customMapId: v.optional(v.id("maps")),
    settings: settingsValidator,
    results: v.array(roundArg),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "soloRecord", user._id);
    const { out } = await applySoloResults(
      ctx,
      user,
      args.mapId,
      args.settings,
      args.results,
      Date.now(),
    );
    if (args.customMapId) {
      const map = await ctx.db.get(args.customMapId);
      if (map) await ctx.db.patch(args.customMapId, { plays: (map.plays ?? 0) + 1 });
    }
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

/**
 * Equip a building avatar and/or set the background color. buildingId is
 * authorized against the user's own historical unlockedBuildings (not the
 * live BUILDINGS catalog) so a building removed from the catalog later
 * doesn't retroactively block someone who legitimately earned it — the
 * client-side IdentityAvatar falls back to the default gradient if the id
 * is no longer recognized. clearBuilding is explicit rather than relying on
 * patch-with-undefined semantics for "reset to default".
 */
export const setAvatar = mutation({
  args: {
    buildingId: v.optional(v.string()),
    clearBuilding: v.optional(v.boolean()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { buildingId, clearBuilding, color }) => {
    const user = await requireUser(ctx);
    const patch: Record<string, unknown> = {};

    if (clearBuilding) {
      patch.avatarBuildingId = undefined;
    } else if (buildingId !== undefined) {
      if (!(user.unlockedBuildings ?? []).includes(buildingId)) {
        throw new Error("Building not unlocked yet");
      }
      patch.avatarBuildingId = buildingId;
    }

    if (color !== undefined) {
      if (!AVATAR_COLORS.includes(color)) throw new Error("Invalid color");
      patch.avatarColor = color;
    }

    if (Object.keys(patch).length) await ctx.db.patch(user._id, patch);
    return { avatarBuildingId: patch.avatarBuildingId, avatarColor: patch.avatarColor };
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
    unlockedBuildings: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.stats.gamesPlayed > 0 || user.xp > 0) return { merged: false };
    // Nothing to import unless the guest earned distance games or Flags XP.
    if (args.stats.gamesPlayed <= 0 && args.xp <= 0) return { merged: false };

    const stats = {
      gamesPlayed: clampInt(args.stats.gamesPlayed, 1_000_000),
      roundsPlayed: clampInt(args.stats.roundsPlayed, 10_000_000),
      wins: clampInt(args.stats.wins, 1_000_000),
      bestScore: clampInt(args.stats.bestScore, 100_000), // 20-round max = 20 × 5000
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

    const unlockedBuildings = [
      ...new Set((args.unlockedBuildings ?? []).filter((id) => VALID_BUILDING_IDS.has(id))),
    ];
    if (unlockedBuildings.length) {
      await ctx.db.patch(user._id, { unlockedBuildings });
    }

    return { merged: true, gamesPlayed: stats.gamesPlayed, importedAchievements };
  },
});

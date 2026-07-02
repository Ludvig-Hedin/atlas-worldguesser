import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { settingsValidator, latLng } from "./schema";
import { requireUser, currentUser } from "./users";
import {
  ANTIPODE_METERS,
  computeGuessScore,
  pickMatchLocations,
  randomRoomCode,
} from "./gameLogic";
import { foldGame } from "../src/lib/progression";
import type { RoundResult } from "../src/lib/types";

const REVEAL_MS = 6000;
const DEFAULT_ROUND_CAP_SEC = 90;

function roundDurationMs(settings: Doc<"rooms">["settings"]): number {
  const sec = settings.timeLimitSec > 0 ? settings.timeLimitSec : DEFAULT_ROUND_CAP_SEC;
  return sec * 1000;
}

async function memberOf(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  userId: Id<"users">,
): Promise<Doc<"roomMembers"> | null> {
  return await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
    .unique();
}

async function membersOf(ctx: QueryCtx | MutationCtx, roomId: Id<"rooms">) {
  return await ctx.db
    .query("roomMembers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
}

// ── Lobby ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: { mapId: v.string(), settings: settingsValidator },
  handler: async (ctx, { mapId, settings }) => {
    const user = await requireUser(ctx);
    const now = Date.now();

    let code = randomRoomCode();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db.query("rooms").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (!clash) break;
      code = randomRoomCode();
    }

    const seed = Math.floor(Math.random() * 0xffffffff);
    const locations = pickMatchLocations(mapId, settings.rounds, seed);

    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: user._id,
      status: "lobby",
      mapId,
      settings,
      currentRound: 0,
      locations,
      createdAt: now,
    });

    await ctx.db.insert("roomMembers", {
      roomId,
      userId: user._id,
      username: user.username,
      ready: false,
      connected: true,
      totalScore: 0,
      joinedAt: now,
      lastSeenAt: now,
    });

    return { roomId, code };
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) throw new Error("Room not found");

    const existing = await memberOf(ctx, room._id, user._id);
    if (existing) {
      await ctx.db.patch(existing._id, { connected: true, lastSeenAt: Date.now() });
      return { roomId: room._id, code: room.code };
    }
    if (room.status !== "lobby") throw new Error("This match has already started");

    await ctx.db.insert("roomMembers", {
      roomId: room._id,
      userId: user._id,
      username: user.username,
      ready: false,
      connected: true,
      totalScore: 0,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    return { roomId: room._id, code: room.code };
  },
});

export const setReady = mutation({
  args: { roomId: v.id("rooms"), ready: v.boolean() },
  handler: async (ctx, { roomId, ready }) => {
    const user = await requireUser(ctx);
    const member = await memberOf(ctx, roomId, user._id);
    if (!member) throw new Error("Not in this room");
    await ctx.db.patch(member._id, { ready, lastSeenAt: Date.now() });
  },
});

export const heartbeat = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await currentUser(ctx);
    if (!user) return;
    const member = await memberOf(ctx, roomId, user._id);
    if (member) await ctx.db.patch(member._id, { connected: true, lastSeenAt: Date.now() });
  },
});

export const leave = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const member = await memberOf(ctx, roomId, user._id);
    if (!member) return;
    await ctx.db.delete(member._id);

    const room = await ctx.db.get(roomId);
    if (!room) return;
    const remaining = await membersOf(ctx, roomId);
    if (remaining.length === 0) {
      await ctx.db.patch(roomId, { status: "finished" });
    } else if (room.hostId === user._id) {
      await ctx.db.patch(roomId, { hostId: remaining[0].userId });
    }
  },
});

export const updateSettings = mutation({
  args: { roomId: v.id("rooms"), mapId: v.string(), settings: settingsValidator },
  handler: async (ctx, { roomId, mapId, settings }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can change settings");
    if (room.status !== "lobby") throw new Error("Match already started");
    const seed = Math.floor(Math.random() * 0xffffffff);
    await ctx.db.patch(roomId, {
      mapId,
      settings,
      locations: pickMatchLocations(mapId, settings.rounds, seed),
    });
  },
});

// ── Match flow ───────────────────────────────────────────────────────────

async function startRound(ctx: MutationCtx, roomId: Id<"rooms">, round: number) {
  const room = await ctx.db.get(roomId);
  if (!room) return;
  const now = Date.now();
  const durationMs = roundDurationMs(room.settings);
  await ctx.db.patch(roomId, {
    status: "active",
    currentRound: round,
    roundStartedAt: now,
    roundEndsAt: now + durationMs,
  });
  await ctx.scheduler.runAfter(durationMs, internal.rooms.endRound, { roomId, round });
}

export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can start");
    if (room.status !== "lobby") throw new Error("Already started");
    const members = await membersOf(ctx, roomId);
    for (const m of members) await ctx.db.patch(m._id, { totalScore: 0 });
    await startRound(ctx, roomId, 1);
  },
});

async function enterRoundResult(ctx: MutationCtx, roomId: Id<"rooms">, round: number) {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "active" || room.currentRound !== round) return;
  await ctx.db.patch(roomId, { status: "roundResult" });
  await ctx.scheduler.runAfter(REVEAL_MS, internal.rooms.advance, { roomId, round });
}

export const submitGuess = mutation({
  args: {
    roomId: v.id("rooms"),
    guess: v.union(latLng, v.null()),
    guessCountryCode: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { roomId, guess, guessCountryCode }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "active") throw new Error("No active round");
    const member = await memberOf(ctx, roomId, user._id);
    if (!member) throw new Error("Not in this room");

    const round = room.currentRound;
    const already = await ctx.db
      .query("guesses")
      .withIndex("by_room_round_user", (q) =>
        q.eq("roomId", roomId).eq("round", round).eq("userId", user._id),
      )
      .unique();
    if (already) return; // one guess per round

    const actual = room.locations[round - 1];
    const { distanceMeters, score } = computeGuessScore(guess, actual, room.mapId);
    const countryCorrect = !!guessCountryCode && guessCountryCode === actual.countryCode;

    await ctx.db.insert("guesses", {
      roomId,
      round,
      userId: user._id,
      guessed: guess !== null,
      lat: guess?.lat ?? 0,
      lng: guess?.lng ?? 0,
      distanceMeters,
      score,
      guessCountryCode,
      countryCorrect,
      createdAt: Date.now(),
    });
    await ctx.db.patch(member._id, { totalScore: member.totalScore + score, lastSeenAt: Date.now() });

    // Advance early once everyone has guessed.
    const members = await membersOf(ctx, roomId);
    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_room_round", (q) => q.eq("roomId", roomId).eq("round", round))
      .collect();
    if (guesses.length >= members.length) {
      await enterRoundResult(ctx, roomId, round);
    }
  },
});

export const endRound = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    await enterRoundResult(ctx, roomId, round);
  },
});

export const advance = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number() },
  handler: async (ctx, { roomId, round }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "roundResult" || room.currentRound !== round) return;
    if (round >= room.settings.rounds) {
      await finishMatch(ctx, room);
    } else {
      await startRound(ctx, roomId, round + 1);
    }
  },
});

async function finishMatch(ctx: MutationCtx, room: Doc<"rooms">) {
  const members = await membersOf(ctx, room._id);
  const maxScore = members.reduce((m, x) => Math.max(m, x.totalScore), 0);
  const competitive = members.length > 1;
  const now = Date.now();

  for (const member of members) {
    const won = competitive && member.totalScore === maxScore;

    const results: RoundResult[] = [];
    for (let r = 1; r <= room.settings.rounds; r++) {
      const actual = room.locations[r - 1];
      const g = await ctx.db
        .query("guesses")
        .withIndex("by_room_round_user", (q) =>
          q.eq("roomId", room._id).eq("round", r).eq("userId", member.userId),
        )
        .unique();
      results.push({
        round: r,
        actual: { lat: actual.lat, lng: actual.lng, countryCode: actual.countryCode },
        guess: g && g.guessed ? { lat: g.lat, lng: g.lng } : null,
        distanceMeters: g?.distanceMeters ?? ANTIPODE_METERS,
        score: g?.score ?? 0,
        timeMs: 0,
        guessCountryCode: g?.guessCountryCode ?? null,
        countryCorrect: g?.countryCorrect ?? false,
      });
    }

    const user = await ctx.db.get(member.userId);
    if (user) {
      const owned = await ctx.db
        .query("achievements")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const out = foldGame({
        stats: { ...user.stats, xp: user.xp },
        streaks: user.streaks,
        ownedAchievements: owned.map((a) => a.achievementId),
        results,
        now,
        wonOverride: won,
      });
      const { xp, ...statsNoXp } = out.stats;
      await ctx.db.patch(user._id, { xp, stats: statsNoXp, streaks: out.streaks, lastActiveAt: now });
      for (const id of out.newAchievements) {
        await ctx.db.insert("achievements", { userId: user._id, achievementId: id, unlockedAt: now });
      }
      await ctx.db.insert("games", {
        userId: user._id,
        mode: "multi",
        mapId: room.mapId,
        settings: room.settings,
        totalScore: member.totalScore,
        maxScore: room.settings.rounds * 5000,
        rounds: room.settings.rounds,
        avgDistanceMeters: out.avgDistanceMeters,
        perfectRounds: out.perfectRounds,
        won,
        roomId: room._id,
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
    }
  }

  await ctx.db.patch(room._id, { status: "finished" });
}

export const rematch = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can start a rematch");

    // Clear guesses from the previous match.
    for (let r = 1; r <= room.settings.rounds; r++) {
      const gs = await ctx.db
        .query("guesses")
        .withIndex("by_room_round", (q) => q.eq("roomId", roomId).eq("round", r))
        .collect();
      for (const g of gs) await ctx.db.delete(g._id);
    }
    const members = await membersOf(ctx, roomId);
    for (const m of members) await ctx.db.patch(m._id, { totalScore: 0, ready: false });

    const seed = Math.floor(Math.random() * 0xffffffff);
    await ctx.db.patch(roomId, {
      status: "lobby",
      currentRound: 0,
      roundStartedAt: undefined,
      roundEndsAt: undefined,
      locations: pickMatchLocations(room.mapId, room.settings.rounds, seed),
    });
  },
});

// ── Reactive public state ────────────────────────────────────────────────

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .unique();
    if (!room) return null;

    const me = await currentUser(ctx);
    const members = await membersOf(ctx, room._id);
    const round = room.currentRound;

    // Per-member guess status for the current round.
    const guesses =
      round > 0
        ? await ctx.db
            .query("guesses")
            .withIndex("by_room_round", (q) => q.eq("roomId", room._id).eq("round", round))
            .collect()
        : [];
    const guessByUser = new Map(guesses.map((g) => [g.userId, g]));

    const standings = members
      .map((m) => ({
        userId: m.userId,
        username: m.username,
        totalScore: m.totalScore,
        ready: m.ready,
        connected: m.connected,
        isHost: m.userId === room.hostId,
        hasGuessed: guessByUser.has(m.userId),
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    const revealing = room.status === "roundResult" || room.status === "finished";
    const actual = round > 0 ? room.locations[round - 1] : null;

    const base = {
      _id: room._id,
      code: room.code,
      status: room.status,
      mapId: room.mapId,
      settings: room.settings,
      currentRound: round,
      totalRounds: room.settings.rounds,
      roundEndsAt: room.roundEndsAt ?? null,
      hostId: room.hostId,
      amHost: me ? room.hostId === me._id : false,
      amMember: me ? members.some((m) => m.userId === me._id) : false,
      myUserId: me?._id ?? null,
      standings,
    };

    // During an active round, expose only the panorama location (no country).
    if (room.status === "active" && actual) {
      return { ...base, panorama: { lat: actual.lat, lng: actual.lng }, reveal: null };
    }

    // At reveal, expose the full answer + everyone's guesses for this round.
    if (revealing && actual) {
      return {
        ...base,
        panorama: null,
        reveal: {
          actual: { lat: actual.lat, lng: actual.lng, countryCode: actual.countryCode },
          guesses: members.map((m) => {
            const g = guessByUser.get(m.userId);
            return {
              userId: m.userId,
              username: m.username,
              guess: g && g.guessed ? { lat: g.lat, lng: g.lng } : null,
              score: g?.score ?? 0,
              distanceMeters: g && g.guessed ? g.distanceMeters : null,
              countryCorrect: g?.countryCorrect ?? false,
            };
          }),
        },
      };
    }

    return { ...base, panorama: null, reveal: null };
  },
});

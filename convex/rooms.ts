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
  clampSettings,
  computeGuessScore,
  pickMatchLocations,
  randomRoomCode,
} from "./gameLogic";
import { rateLimit } from "./rateLimit";
import { areFriends } from "./friends";
import { foldGame } from "../src/lib/progression";
import type { RoundResult } from "../src/lib/types";

const REVEAL_MS = 6000;
const DEFAULT_ROUND_CAP_SEC = 90;
/** Extra server-side slack past the displayed deadline so a client auto-submit
 * fired exactly at 0s (plus country lookup + RTT) still lands in the round. */
const GUESS_GRACE_MS = 2500;
/** A member is considered connected if a heartbeat landed this recently. */
const CONNECTED_WINDOW_MS = 45_000;
/** Room capacity + per-team cap (supports up to 4v4). */
const MAX_MEMBERS = 8;
const MAX_TEAM = 4;

type Team = "A" | "B";

/** Sum of each team's members' scores (0 for unassigned/FFA members). */
function teamTotalsOf(members: Doc<"roomMembers">[]): { A: number; B: number } {
  const totals = { A: 0, B: 0 };
  for (const m of members) if (m.team) totals[m.team] += m.totalScore;
  return totals;
}

export function assertMultiplayerEnabled() {
  if (process.env.DISABLE_MULTIPLAYER === "true") {
    throw new Error("Multiplayer is temporarily disabled");
  }
}

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

/** Consume (delete) a pending ad-hoc invite once its target has joined the room. */
async function clearInvite(ctx: MutationCtx, roomId: Id<"rooms">, toUserId: Id<"users">) {
  const invite = await ctx.db
    .query("roomInvites")
    .withIndex("by_room_and_to", (q) => q.eq("roomId", roomId).eq("toUserId", toUserId))
    .unique();
  if (invite) await ctx.db.delete(invite._id);
}

// ── Lobby ────────────────────────────────────────────────────────────────

/**
 * Allocate a room (unique code, hidden answers, host member). Shared by
 * rooms.create and parties.startRoom so the code-alloc + insert logic lives once.
 */
export async function createRoomForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  mapId: string,
  rawSettings: Doc<"rooms">["settings"],
  teamMode?: boolean,
): Promise<{ roomId: Id<"rooms">; code: string }> {
  const settings = clampSettings(rawSettings);
  const now = Date.now();

  let code = randomRoomCode();
  for (let i = 0; ; i++) {
    const clash = await ctx.db.query("rooms").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (!clash) break;
    // Never insert a duplicate code — `.unique()` readers would throw for both rooms.
    if (i >= 4) throw new Error("Could not allocate a room code — please try again");
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
    teamMode: teamMode ?? false,
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
    // In team mode the host seeds team A; others balance in as they join.
    team: teamMode ? "A" : undefined,
    joinedAt: now,
    lastSeenAt: now,
  });

  return { roomId, code };
}

export const create = mutation({
  args: { mapId: v.string(), settings: settingsValidator, teamMode: v.optional(v.boolean()) },
  handler: async (ctx, { mapId, settings, teamMode }) => {
    assertMultiplayerEnabled();
    const user = await requireUser(ctx);
    await rateLimit(ctx, "roomCreate", user._id);
    return await createRoomForUser(ctx, user, mapId, settings, teamMode);
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    assertMultiplayerEnabled();
    const user = await requireUser(ctx);
    await rateLimit(ctx, "roomJoin", user._id);
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

    // Capacity only blocks new joiners — reconnects (handled above) always get
    // back in even at capacity.
    const members = await membersOf(ctx, room._id);
    if (members.length >= MAX_MEMBERS) throw new Error("This room is full");
    let team: Team | undefined;
    if (room.teamMode) {
      const a = members.filter((m) => m.team === "A").length;
      const b = members.filter((m) => m.team === "B").length;
      team = a <= b ? "A" : "B";
    }

    await ctx.db.insert("roomMembers", {
      roomId: room._id,
      userId: user._id,
      username: user.username,
      ready: false,
      connected: true,
      totalScore: 0,
      team,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    await clearInvite(ctx, room._id, user._id);
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
      return;
    }
    if (room.hostId === user._id) {
      await ctx.db.patch(roomId, { hostId: remaining[0].userId });
    }
    // If the leaver was the only one still guessing, advance the round early.
    if (room.status === "active" && room.currentRound > 0) {
      const guesses = await ctx.db
        .query("guesses")
        .withIndex("by_room_round", (q) => q.eq("roomId", roomId).eq("round", room.currentRound))
        .collect();
      const guessed = new Set(guesses.map((g) => g.userId));
      if (remaining.every((m) => guessed.has(m.userId))) {
        await enterRoundResult(ctx, roomId, room.currentRound);
      }
    }
  },
});

export const updateSettings = mutation({
  args: { roomId: v.id("rooms"), mapId: v.string(), settings: settingsValidator },
  handler: async (ctx, { roomId, mapId, settings: rawSettings }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can change settings");
    if (room.status !== "lobby") throw new Error("Match already started");
    const settings = clampSettings(rawSettings);
    const seed = Math.floor(Math.random() * 0xffffffff);
    await ctx.db.patch(roomId, {
      mapId,
      settings,
      locations: pickMatchLocations(mapId, settings.rounds, seed),
    });
  },
});

export const setTeamMode = mutation({
  args: { roomId: v.id("rooms"), teamMode: v.boolean() },
  handler: async (ctx, { roomId, teamMode }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can change teams");
    if (room.status !== "lobby") throw new Error("Match already started");
    const members = await membersOf(ctx, roomId);
    if (teamMode) {
      // Balance existing members into A/B by join order (alternating).
      members.sort((a, b) => a.joinedAt - b.joinedAt);
      for (let i = 0; i < members.length; i++) {
        await ctx.db.patch(members[i]._id, { team: i % 2 === 0 ? "A" : "B" });
      }
    } else {
      // Clear team assignments (patch to undefined unsets the optional field).
      for (const m of members) await ctx.db.patch(m._id, { team: undefined });
    }
    await ctx.db.patch(roomId, { teamMode });
  },
});

export const setTeam = mutation({
  args: { roomId: v.id("rooms"), team: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { roomId, team }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.status !== "lobby") throw new Error("Match already started");
    if (!room.teamMode) throw new Error("This match isn't in team mode");
    const member = await memberOf(ctx, roomId, user._id);
    if (!member) throw new Error("Not in this room");
    if (member.team === team) return;
    const members = await membersOf(ctx, roomId);
    const onTeam = members.filter((m) => m.team === team && m.userId !== user._id).length;
    if (onTeam >= MAX_TEAM) throw new Error(`Team ${team} is full`);
    await ctx.db.patch(member._id, { team, lastSeenAt: Date.now() });
  },
});

/** Bounded read cap for a user's pending room invites (guards a spammed inbox). */
const MAX_MY_INVITES = 20;

/**
 * Ad-hoc invite: any member of a lobby can invite one accepted friend directly
 * into that specific room — lighter than the persistent parties flow. Gated
 * on membership, friendship, and the room still being joinable.
 */
export const inviteFriend = mutation({
  args: { roomCode: v.string(), friendId: v.id("users") },
  handler: async (ctx, { roomCode, friendId }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "roomInvite", user._id);
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", roomCode.toUpperCase()))
      .unique();
    if (!room) throw new Error("Room not found");
    if (room.status !== "lobby") throw new Error("This match has already started");
    if (!(await memberOf(ctx, room._id, user._id))) throw new Error("You're not in this room");
    if (!(await areFriends(ctx, user._id, friendId))) throw new Error("You can only invite friends");
    const friend = await ctx.db.get(friendId);
    if (!friend) throw new Error("Player not found");

    const existing = await ctx.db
      .query("roomInvites")
      .withIndex("by_room_and_to", (q) => q.eq("roomId", room._id).eq("toUserId", friendId))
      .unique();
    if (existing) return; // already invited

    await ctx.db.insert("roomInvites", {
      roomId: room._id,
      roomCode: room.code,
      fromUserId: user._id,
      fromUsername: user.username,
      toUserId: friendId,
      createdAt: Date.now(),
    });

    if (friend.email) {
      await ctx.scheduler.runAfter(0, internal.email.send, {
        kind: "roomInvite",
        to: friend.email,
        toUsername: friend.username,
        fromUsername: user.username,
        roomCode: room.code,
      });
    }
  },
});

/** The caller's pending room invites, filtered live to rooms still in "lobby"
 * so an invite to an already-started or finished match silently stops
 * offering a Join button instead of sending the invitee into a dead room. */
export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const me = await currentUser(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("roomInvites")
      .withIndex("by_to", (q) => q.eq("toUserId", me._id))
      .order("desc")
      .take(MAX_MY_INVITES);

    const invites: { _id: Id<"roomInvites">; roomCode: string; fromUsername: string }[] = [];
    for (const row of rows) {
      const room = await ctx.db.get(row.roomId);
      if (room && room.status === "lobby") {
        invites.push({ _id: row._id, roomCode: row.roomCode, fromUsername: row.fromUsername });
      }
    }
    return invites;
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
  // `startedAt` fences the timer to THIS round instance: after a rematch the
  // round counter restarts, so {roomId, round} alone would let a stale job from
  // the previous match force-end the new match's round. The grace window lets
  // deadline auto-submits from clients land before the round is closed.
  await ctx.scheduler.runAfter(durationMs + GUESS_GRACE_MS, internal.rooms.endRound, {
    roomId,
    round,
    startedAt: now,
  });
}

export const start = mutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const user = await requireUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room || room.hostId !== user._id) throw new Error("Only the host can start");
    if (room.status !== "lobby") throw new Error("Already started");
    const members = await membersOf(ctx, roomId);
    if (room.teamMode) {
      const hasA = members.some((m) => m.team === "A");
      const hasB = members.some((m) => m.team === "B");
      if (!hasA || !hasB) throw new Error("Both teams need at least one player to start");
    }
    for (const m of members) await ctx.db.patch(m._id, { totalScore: 0 });
    await startRound(ctx, roomId, 1);
  },
});

async function enterRoundResult(ctx: MutationCtx, roomId: Id<"rooms">, round: number) {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "active" || room.currentRound !== round) return;
  // Repoint roundEndsAt at the reveal deadline so the client's "Next round in
  // Xs" countdown matches when `advance` will actually fire.
  await ctx.db.patch(roomId, { status: "roundResult", roundEndsAt: Date.now() + REVEAL_MS });
  await ctx.scheduler.runAfter(REVEAL_MS, internal.rooms.advance, {
    roomId,
    round,
    startedAt: room.roundStartedAt,
  });
}

export const submitGuess = mutation({
  args: {
    roomId: v.id("rooms"),
    guess: v.union(latLng, v.null()),
    guessCountryCode: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { roomId, guess, guessCountryCode }) => {
    const user = await requireUser(ctx);
    await rateLimit(ctx, "guess", user._id);
    if (
      guess &&
      (!Number.isFinite(guess.lat) ||
        !Number.isFinite(guess.lng) ||
        Math.abs(guess.lat) > 90 ||
        Math.abs(guess.lng) > 180)
    ) {
      throw new Error("Invalid guess coordinates");
    }
    // Only a plausible ISO alpha-2 code counts toward the country bonus.
    const countryCode =
      guessCountryCode && /^[A-Za-z]{2}$/.test(guessCountryCode)
        ? guessCountryCode.toUpperCase()
        : null;
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
    const countryCorrect = !!countryCode && countryCode === actual.countryCode;

    const now = Date.now();
    await ctx.db.insert("guesses", {
      roomId,
      round,
      userId: user._id,
      guessed: guess !== null,
      lat: guess?.lat ?? 0,
      lng: guess?.lng ?? 0,
      distanceMeters,
      score,
      guessCountryCode: countryCode,
      countryCorrect,
      createdAt: now,
    });
    await ctx.db.patch(member._id, { totalScore: member.totalScore + score, lastSeenAt: now });

    // Advance early once every connected member has guessed — abandoned tabs
    // (no recent heartbeat) shouldn't force the full round timer on everyone.
    const members = await membersOf(ctx, roomId);
    const guesses = await ctx.db
      .query("guesses")
      .withIndex("by_room_round", (q) => q.eq("roomId", roomId).eq("round", round))
      .collect();
    const guessed = new Set(guesses.map((g) => g.userId));
    const stillPlaying = members.filter(
      (m) => m.userId === user._id || now - m.lastSeenAt < CONNECTED_WINDOW_MS,
    );
    if (stillPlaying.every((m) => guessed.has(m.userId))) {
      await enterRoundResult(ctx, roomId, round);
    }
  },
});

export const endRound = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number(), startedAt: v.optional(v.number()) },
  handler: async (ctx, { roomId, round, startedAt }) => {
    // Ignore timers scheduled for an earlier match in the same room (rematch).
    if (startedAt !== undefined) {
      const room = await ctx.db.get(roomId);
      if (!room || room.roundStartedAt !== startedAt) return;
    }
    await enterRoundResult(ctx, roomId, round);
  },
});

export const advance = internalMutation({
  args: { roomId: v.id("rooms"), round: v.number(), startedAt: v.optional(v.number()) },
  handler: async (ctx, { roomId, round, startedAt }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "roundResult" || room.currentRound !== round) return;
    if (startedAt !== undefined && room.roundStartedAt !== startedAt) return;
    if (round >= room.settings.rounds) {
      await finishMatch(ctx, room);
    } else {
      await startRound(ctx, roomId, round + 1);
    }
  },
});

async function finishMatch(ctx: MutationCtx, room: Doc<"rooms">) {
  const members = await membersOf(ctx, room._id);
  const now = Date.now();

  // Winner determination differs by mode. Teams: highest team total (sum of
  // members); every member of the winning team wins. FFA: highest individual.
  // Both guard against all-zero / non-competitive matches so idle games don't
  // inflate win streaks.
  let wonFor: (m: Doc<"roomMembers">) => boolean;
  if (room.teamMode) {
    const totals = teamTotalsOf(members);
    const winningTeam: Team | null = totals.A === totals.B ? null : totals.A > totals.B ? "A" : "B";
    // Require BOTH teams still present so a walkover (the opposing team all
    // left) can't hand a phantom win + inflated streak — mirrors the FFA
    // members>1 guard.
    const hasA = members.some((m) => m.team === "A");
    const hasB = members.some((m) => m.team === "B");
    const competitive = winningTeam !== null && hasA && hasB;
    wonFor = (m) => competitive && m.team === winningTeam;
  } else {
    const maxScore = members.reduce((m, x) => Math.max(m, x.totalScore), 0);
    const competitive = members.length > 1 && maxScore > 0;
    wonFor = (m) => competitive && m.totalScore === maxScore;
  }

  for (const member of members) {
    const won = wonFor(member);

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
        unlockedBuildings: user.unlockedBuildings ?? [],
        results,
        now,
        wonOverride: won,
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
    if (room.status !== "finished") throw new Error("Match still in progress");

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

    // Clear stale ad-hoc invites — the room reuses this same roomId/code, so
    // without this a rematch would resurrect old invites: re-toasting people
    // already in the room, and silently no-opping genuine new invites for
    // anyone who left (the dedup index still sees their old row).
    const staleInvites = await ctx.db
      .query("roomInvites")
      .withIndex("by_room_and_to", (q) => q.eq("roomId", roomId))
      .take(50);
    for (const inv of staleInvites) await ctx.db.delete(inv._id);

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

    // Nothing ever writes `connected: false`, so derive liveness from the
    // heartbeat timestamp instead of trusting the stored flag.
    // TODO(bug-hunt): totalScore is patched the instant a player guesses, so
    // during an active round opponents can see your round score (standings
    // re-sort live) before the reveal. If unintended, report round-start
    // totals while status === "active" by subtracting this round's guesses.
    const now = Date.now();
    // Live-joined (not denormalized onto roomMembers) so avatar/color changes
    // mid-room show immediately, matching "free to change anytime".
    const standings = (
      await Promise.all(
        members.map(async (m) => {
          const u = await ctx.db.get(m.userId);
          return {
            userId: m.userId,
            username: m.username,
            avatarUrl: u?.avatarUrl,
            avatarBuildingId: u?.avatarBuildingId,
            avatarColor: u?.avatarColor,
            totalScore: m.totalScore,
            ready: m.ready,
            connected: now - m.lastSeenAt < CONNECTED_WINDOW_MS,
            isHost: m.userId === room.hostId,
            hasGuessed: guessByUser.has(m.userId),
            team: m.team ?? null,
          };
        }),
      )
    ).sort((a, b) => b.totalScore - a.totalScore);

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
      teamMode: room.teamMode ?? false,
      teamTotals: teamTotalsOf(members),
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

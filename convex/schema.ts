import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Reusable validators mirroring src/lib/types.ts. */
export const movement = v.union(
  v.literal("moving"),
  v.literal("noMove"),
  v.literal("noMoveNoPanZoom"),
);

export const settingsValidator = v.object({
  rounds: v.number(),
  timeLimitSec: v.number(),
  movement,
});

export const latLng = v.object({ lat: v.number(), lng: v.number() });

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    usernameLower: v.string(),
    avatarUrl: v.optional(v.string()),
    xp: v.number(),
    createdAt: v.number(),
    lastActiveAt: v.number(),
    stats: v.object({
      gamesPlayed: v.number(),
      roundsPlayed: v.number(),
      wins: v.number(),
      bestScore: v.number(),
      totalDistanceMeters: v.number(),
      countryCorrect: v.number(),
      countryTotal: v.number(),
    }),
    streaks: v.object({
      daily: v.number(),
      lastPlayedDay: v.number(),
      win: v.number(),
      bestWin: v.number(),
      country: v.number(),
      bestCountry: v.number(),
    }),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_username", ["usernameLower"])
    .index("by_xp", ["xp"]),

  achievements: defineTable({
    userId: v.id("users"),
    achievementId: v.string(),
    unlockedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_achievement", ["userId", "achievementId"]),

  // Finished games (solo synced + completed multiplayer) for history/profiles.
  games: defineTable({
    userId: v.id("users"),
    mode: v.union(v.literal("solo"), v.literal("multi")),
    mapId: v.string(),
    settings: settingsValidator,
    totalScore: v.number(),
    maxScore: v.number(),
    rounds: v.number(),
    avgDistanceMeters: v.number(),
    perfectRounds: v.number(),
    won: v.boolean(),
    roomId: v.optional(v.id("rooms")),
    // Full per-round detail for replays.
    replay: v.array(
      v.object({
        round: v.number(),
        actual: v.object({ lat: v.number(), lng: v.number(), countryCode: v.string() }),
        guess: v.union(latLng, v.null()),
        distanceMeters: v.number(),
        score: v.number(),
        guessCountryCode: v.union(v.string(), v.null()),
        countryCorrect: v.boolean(),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_room", ["roomId"]),

  // Live multiplayer rooms.
  rooms: defineTable({
    code: v.string(),
    hostId: v.id("users"),
    status: v.union(
      v.literal("lobby"),
      v.literal("active"),
      v.literal("roundResult"),
      v.literal("finished"),
    ),
    mapId: v.string(),
    settings: settingsValidator,
    currentRound: v.number(),
    // Hidden answers for the whole match, resolved at creation. Never exposed
    // to clients while a round is active (see rooms.publicState).
    locations: v.array(
      v.object({ lat: v.number(), lng: v.number(), countryCode: v.string() }),
    ),
    roundStartedAt: v.optional(v.number()),
    roundEndsAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    username: v.string(),
    ready: v.boolean(),
    connected: v.boolean(),
    totalScore: v.number(),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_user", ["roomId", "userId"])
    .index("by_user", ["userId"]),

  // One guess per (room, round, user). Answer detail attached at reveal.
  guesses: defineTable({
    roomId: v.id("rooms"),
    round: v.number(),
    userId: v.id("users"),
    lat: v.number(),
    lng: v.number(),
    distanceMeters: v.number(),
    score: v.number(),
    guessCountryCode: v.union(v.string(), v.null()),
    countryCorrect: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_room_round", ["roomId", "round"])
    .index("by_room_round_user", ["roomId", "round", "userId"]),

  chatMessages: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    username: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_room", ["roomId"]),

  friends: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted")),
    // The user who sent the request (for pending direction).
    requestedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_friend", ["friendId"])
    .index("by_pair", ["userId", "friendId"]),
});

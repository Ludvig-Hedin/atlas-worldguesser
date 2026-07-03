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
    // Iconic-building avatar customization. avatarBuildingId is a curated
    // country code (see src/lib/buildings.ts); unlockedBuildings is the
    // permanent, server-verified record of every country ever correctly
    // guessed that has a building. avatarColor is always free to change.
    avatarBuildingId: v.optional(v.string()),
    avatarColor: v.optional(v.string()),
    unlockedBuildings: v.optional(v.array(v.string())),
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
    // Team play (A vs B). Absent/false = free-for-all (the default).
    teamMode: v.optional(v.boolean()),
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
    // Team assignment when the room is in team mode; absent = unassigned/FFA.
    team: v.optional(v.union(v.literal("A"), v.literal("B"))),
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
    /** Whether an actual pin was placed (false = timed out without guessing). */
    guessed: v.boolean(),
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

  // User-created custom maps.
  maps: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    ownerName: v.string(),
    isPublic: v.boolean(),
    locationCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_public", ["isPublic"]),

  mapLocations: defineTable({
    mapId: v.id("maps"),
    lat: v.number(),
    lng: v.number(),
    countryCode: v.string(),
  }).index("by_map", ["mapId"]),

  // Fixed-window rate limiting per (action, subject).
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_key", ["key"]),

  // Anonymous heartbeat presence — one row per open browser tab (guests too),
  // keyed by a client-generated sessionId. Powers the "X playing now" count.
  // Stale rows are pruned by the hourly cron in crons.ts.
  presence: defineTable({
    sessionId: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_lastSeen", ["lastSeenAt"]),

  // Singleton denormalized counters (row key "global"). Avoids counting rows
  // with `.collect().length`; maintained incrementally in mutations.
  appStats: defineTable({
    key: v.string(),
    totalUsers: v.number(),
  }).index("by_key", ["key"]),

  // Daily Challenge results — one row per (day, user). `day` is the UTC day
  // number (floor(ms / 86_400_000)). One attempt per day is enforced by a
  // by_day_user lookup in dailyChallenge.submit; by_day_score drives the board.
  dailyResults: defineTable({
    day: v.number(),
    userId: v.id("users"),
    username: v.string(),
    avatarUrl: v.optional(v.string()),
    score: v.number(),
    correctCount: v.number(),
    avgDistanceMeters: v.number(),
    createdAt: v.number(),
  })
    .index("by_day", ["day"])
    .index("by_day_user", ["day", "userId"])
    .index("by_day_score", ["day", "score"]),

  // Persistent friend groups that stay together across matches. The leader
  // starts a room (activeRoomCode) which the whole party one-click-joins.
  parties: defineTable({
    leaderId: v.id("users"),
    activeRoomCode: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_leader", ["leaderId"]),

  partyMembers: defineTable({
    partyId: v.id("parties"),
    userId: v.id("users"),
    username: v.string(),
    status: v.union(v.literal("invited"), v.literal("joined")),
    invitedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_party", ["partyId"])
    .index("by_user", ["userId"])
    .index("by_party_user", ["partyId", "userId"]),
});

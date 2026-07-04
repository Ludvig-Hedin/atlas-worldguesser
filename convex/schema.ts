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
    // Clerk identity — absent for ephemeral guest accounts (see isGuest).
    // Optional widening is non-breaking: every existing row already has one.
    clerkId: v.optional(v.string()),
    // Guest accounts: signed-out players who get full multiplayer parity but
    // never persist long-term (filtered out of the all-time leaderboard, and
    // never counted in appStats.totalUsers). guestSessionId is the client id
    // from localStorage ("atlas.guestId"), resolved via by_guest_session.
    isGuest: v.optional(v.boolean()),
    guestSessionId: v.optional(v.string()),
    username: v.string(),
    usernameLower: v.string(),
    // Synced from the Clerk identity on every ensureUser call (login).
    // Optional/additive: pre-existing rows lack it until their next login.
    // Used to send transactional emails (see convex/email.ts) — never shown
    // to other users.
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    // Iconic-building avatar customization. avatarBuildingId is a curated
    // country code (see src/lib/buildings.ts); unlockedBuildings is the
    // permanent, server-verified record of every country ever correctly
    // guessed that has a building. avatarColor is always free to change.
    avatarBuildingId: v.optional(v.string()),
    avatarColor: v.optional(v.string()),
    unlockedBuildings: v.optional(v.array(v.string())),
    xp: v.number(),
    // Ranked rating (ELO-lite) accrued from competitive multiplayer rooms
    // (FFA, Team, Duels). Optional = additive, no backfill: undefined means
    // "never played rated" and reads as DEFAULT_RATING (1000) at query time
    // (see src/lib/rating.ts). ratingGamesPlayed is the placement-period
    // counter that widens the K-factor for a player's first few rated games.
    rating: v.optional(v.number()),
    ratingGamesPlayed: v.optional(v.number()),
    // Flags mode: lightweight aggregate (optional = additive, no migration).
    flagStats: v.optional(v.object({ gamesPlayed: v.number(), bestScore: v.number() })),
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
      // Deprecated: the old flat, cross-map country streak (implicitly the
      // "world" map). Convex can't drop a field existing rows still hold, so
      // this stays optional-and-unwritten going forward; new writes only set
      // countryByMap. Folded into countryByMap.world on read — see
      // resolveCountryByMap in src/lib/progression.ts.
      country: v.optional(v.number()),
      bestCountry: v.optional(v.number()),
      countryByMap: v.optional(
        v.record(v.string(), v.object({ current: v.number(), best: v.number() })),
      ),
      // Banked daily-streak "freezes": each auto-bridges exactly one missed
      // day so a single skipped day doesn't reset the daily play streak (see
      // foldGame in src/lib/progression.ts). Earned at every 7-day milestone,
      // capped at 3. Optional/additive — absent on pre-feature rows, read as 0.
      freezesAvailable: v.optional(v.number()),
    }),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_username", ["usernameLower"])
    .index("by_guest_session", ["guestSessionId"])
    .index("by_xp", ["xp"])
    .index("by_rating", ["rating"]),

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
    // 1v1 Duels — capacity is capped at 2 instead of MAX_MEMBERS (see
    // rooms.ts join/start). Mutually exclusive with teamMode; enforced in
    // rooms.ts (create/setTeamMode/setDuelsMode), not the schema.
    duelsMode: v.optional(v.boolean()),
    // Battle Royale: worst scorer(s) each round are cut until one survivor
    // remains (see rooms.ts enterRoundResult/advance/finishMatch). Mutually
    // exclusive with teamMode and duelsMode; enforced in rooms.ts
    // (create/setTeamMode/setElimination), not the schema.
    elimination: v.optional(v.boolean()),
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
    // Ranked-rating change from the finished match, written once by
    // rooms.finishMatch and read back by getByCode's standings so the results
    // screen shows it with no extra query. Absent = this member didn't accrue
    // rating this match (guest, non-competitive room, or <2 signed-in players).
    // Cleared on rematch so a stale delta never leaks into the next match.
    ratingDelta: v.optional(v.number()),
    // Team assignment when the room is in team mode; absent = unassigned/FFA.
    team: v.optional(v.union(v.literal("A"), v.literal("B"))),
    // Battle Royale: true once cut (worst score of eliminatedAtRound).
    // Absent/false = still alive.
    eliminated: v.optional(v.boolean()),
    eliminatedAtRound: v.optional(v.number()),
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

  // Web Push subscriptions (one row per browser/device that opted in). A user
  // can have several (multiple devices/browsers); `endpoint` is unique per
  // registration and doubles as the natural id for unsubscribe/cleanup.
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    keys: v.object({ p256dh: v.string(), auth: v.string() }),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  // User-created custom maps.
  maps: defineTable({
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    ownerName: v.string(),
    isPublic: v.boolean(),
    locationCount: v.number(),
    // Denormalized social counters (optional = additive, no migration; reads
    // as 0 for pre-existing rows). Same convention as appStats/presence.
    plays: v.optional(v.number()),
    likes: v.optional(v.number()),
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

  // One row per (map, user) like — prevents double-likes and supports
  // un-liking. `likes` on `maps` is the denormalized count kept in sync by
  // convex/maps.ts's toggleLike mutation.
  mapLikes: defineTable({
    mapId: v.id("maps"),
    userId: v.id("users"),
  })
    .index("by_map_user", ["mapId", "userId"])
    .index("by_map", ["mapId"])
    .index("by_user", ["userId"]),

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

  // Server-minted solo game sessions. The server owns the round locations
  // (resolved once at startGame, exactly like rooms.locations) so scoring at
  // submitGame re-derives each round's answer from `locations[round-1]` instead
  // of trusting client-claimed coordinates. `consumedAt` enforces one submit per
  // session (server-side idempotency). Guests / keyless deploys never mint these.
  soloSessions: defineTable({
    userId: v.id("users"),
    mapId: v.string(),
    settings: settingsValidator,
    seed: v.number(),
    locations: v.array(
      v.object({ lat: v.number(), lng: v.number(), countryCode: v.string() }),
    ),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

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

  // Flags mode — all-time best score per (region, mode, user). One row per
  // player per region+mode, upserted only when a run beats the stored best.
  // by_region_mode_score drives each region+mode's leaderboard.
  flagResults: defineTable({
    region: v.string(),
    // Stimulus shown: the flag image or the country's name. Optional =
    // additive, no migration — undefined reads as "flag" (the original mode).
    mode: v.optional(v.union(v.literal("flag"), v.literal("name"))),
    userId: v.id("users"),
    username: v.string(),
    avatarUrl: v.optional(v.string()),
    bestScore: v.number(),
    flagCount: v.number(),
    correctCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_region_mode", ["region", "mode"])
    .index("by_region_mode_user", ["region", "mode", "userId"])
    .index("by_region_mode_score", ["region", "mode", "bestScore"]),

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

  // Ad-hoc, one-off invites to join a specific room right now — lighter than
  // the persistent parties system above. A room member invites one friend
  // directly; rooms.myInvites only surfaces a row while its room is still in
  // "lobby", so an invite naturally stops being actionable once the match
  // starts or finishes (no explicit read/dismiss state needed).
  roomInvites: defineTable({
    roomId: v.id("rooms"),
    roomCode: v.string(),
    fromUserId: v.id("users"),
    fromUsername: v.string(),
    toUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_to", ["toUserId"])
    .index("by_room_and_to", ["roomId", "toUserId"]),

  // Async streak-challenge links — beat a friend's Survival-mode round
  // sequence. mapId+rounds+seed pin the exact deterministic sequence (see
  // gameLogic.pickMatchLocations); the resolved locations are never stored —
  // both the challenge page and submitAttempt recompute them fresh from the
  // seed each time, so there's never a client-supplied locations array to
  // trust or not trust.
  challenges: defineTable({
    creatorId: v.id("users"),
    mapId: v.string(),
    rounds: v.number(),
    settings: settingsValidator,
    seed: v.number(),
    // Cosmetic display only on the invite card — NOT re-verified. The
    // creator's own stats already went through the normal progression fold
    // separately when their survival run finished.
    creatorStreak: v.number(),
    creatorScore: v.number(),
    // Denormalized count of saved attempts (same convention as maps.plays).
    attemptCount: v.number(),
    createdAt: v.number(),
  }).index("by_creator", ["creatorId"]),

  // One saved attempt per (challenge, user) — first attempt wins, mirrors
  // Daily Challenge's one-per-day rule. Denormalizes username/avatar for a
  // cheap head-to-head render without an extra join.
  challengeAttempts: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    username: v.string(),
    avatarUrl: v.optional(v.string()),
    streak: v.number(),
    score: v.number(),
    createdAt: v.number(),
  })
    .index("by_challenge", ["challengeId"])
    .index("by_challenge_user", ["challengeId", "userId"]),
});

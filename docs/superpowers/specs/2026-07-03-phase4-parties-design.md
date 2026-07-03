# Phase 4 — Parties (persistent groups)

## Context
Final roadmap phase (`~/.claude/plans/add-more-maps-and-temporal-raven.md`). A **party** is a
persistent group of friends that stays together across matches: the leader starts a room and
the whole party one-click-joins, so they land in the same lobby (and can pick teams — Phase 3).
Built on the existing friends system (`convex/friends.ts` — `list` gives accepted friends).
Kept mostly to NEW files to avoid the heavy concurrent editing of social/friends components.

Party chat is out of scope for this MVP (follow-up) — the value is "play together."

## Schema (`convex/schema.ts`) — additive
```
parties: defineTable({
  leaderId: v.id("users"),
  activeRoomCode: v.optional(v.string()),   // set by startRoom so members can join
  createdAt: v.number(),
}).index("by_leader", ["leaderId"]),

partyMembers: defineTable({
  partyId: v.id("parties"),
  userId: v.id("users"),
  username: v.string(),
  status: v.union(v.literal("invited"), v.literal("joined")),
  invitedBy: v.optional(v.id("users")),
  createdAt: v.number(),
}).index("by_party", ["partyId"]).index("by_user", ["userId"]).index("by_party_user", ["partyId","userId"]),
```
A user is `joined` to at most one party; `invited` rows are pending invitations. `MAX_PARTY = 8`.

## Backend
- **Refactor `convex/rooms.ts`**: extract `export async function createRoomForUser(ctx, user, mapId, settings, teamMode?)` (the code-alloc + room + host-member insert currently inline in `create`). `rooms.create` calls it; `parties.startRoom` reuses it — no duplicated room-creation/race logic.
- **New `convex/parties.ts`**:
  - `mine` (query): `{ party | null, invites[], myUserId }`. `party` = my joined party with members (joined + pending invited), `amLeader`, `activeRoomCode`.
  - `create` (mutation): if already joined a party, return it; else create party (self = leader + joined).
  - `invite` (mutation, leader-only, rate-limited `partyInvite`): target must be an accepted friend, not already in the party; enforce `MAX_PARTY`; insert an `invited` row.
  - `respond` (mutation): accept → leave any other party, set my row `joined`; decline → delete my `invited` row.
  - `leave` (mutation): delete my membership; if I was leader, reassign to another joined member, else delete the party + all its rows.
  - `startRoom` (mutation, leader-only, rate-limited `roomCreate`): `createRoomForUser` → patch `party.activeRoomCode` → return `{ code }`.
- **`convex/rateLimit.ts`**: add `partyInvite: { max: 60, windowMs: MINUTE }`.

## Client
- **New `src/app/party/page.tsx`**: `SiteHeader` + `ConvexGate` + `PartyClient` (mirrors `/leaderboard`).
- **New `src/components/multiplayer/party-client.tsx`**:
  - No party + invites → list invites (Accept/Decline) + "Create a party".
  - In a party → member list (joined + pending), leader invites from a friends picker (`api.friends.list`, filtered to non-members), Leave button.
  - Leader "Start room" → `startRoom` → `router.push('/room/CODE')`. Members see "Join room" when
    `activeRoomCode` is set → `router.push('/room/CODE')` (existing room auto-join takes over; they
    pick teams in the lobby).
- **`multiplayer-entry.tsx`** (hot, minimal): add a small "Party" link → `/party`.

## Correctness watch-list
- One joined party per user: `respond`/`create` clear prior joined rows first.
- Leader leaving reassigns leadership or tears down the party (no orphaned parties).
- `invite` verifies an *accepted* friendship (reuse the `findPair` accepted check pattern) so you
  can't invite arbitrary users.
- `activeRoomCode` can go stale (room started/finished) — joining a non-lobby room fails the same
  way a normal late join does; acceptable. Show Join while it's fresh.
- Convex OCC covers the "one joined party" and `MAX_PARTY` checks (broad reads + in-range writes).

## Verification
- `convex codegen`, `bun run typecheck`, `bunx eslint <changed>`, `bunx vitest run`.
- Manual: create party → invite a friend → friend accepts → leader Start room → both land in the
  same lobby → (optionally) toggle Teams and pick sides → play.
- Adversarial review after implementation.

## Out of scope
- Party chat, party matchmaking queue, >leader invites (any-member invite).

# Phase 3 — Team Play in Rooms (2v2 / 3v3 / 4v4)

## Context
Multiplayer rooms are flat FFA today (`convex/rooms.ts`): each player has an individual
`roomMembers.totalScore`, winner = highest individual. No teams, no player cap. This phase
adds two-team play (A vs B) on top of the existing server-authoritative state machine,
fully backward-compatible (absent `teamMode` = FFA). Roadmap:
`~/.claude/plans/add-more-maps-and-temporal-raven.md`. Team score model = **sum of members**.

## Schema (`convex/schema.ts`) — additive/optional (safe migration)
- `rooms`: add `teamMode: v.optional(v.boolean())` (absent/false = FFA).
- `roomMembers`: add `team: v.optional(v.union(v.literal("A"), v.literal("B")))`.

Keeps the shared `settingsValidator` (solo/games) untouched — `teamMode` is a room column,
not a game setting.

## Backend (`convex/rooms.ts`)
Constants: `MAX_MEMBERS = 8`, `MAX_TEAM = 4`.

- **`create`**: accept `teamMode?: boolean`; store it; if team mode, creator → team `"A"`.
- **`join`**: enforce `members.length < MAX_MEMBERS` (new cap — none exists today). In team
  mode, auto-assign the new member to the smaller team (tie → `"A"`). Reconnect path
  (existing member) is exempt from the cap.
- **`setTeamMode`** (new, host + lobby only): set `rooms.teamMode`. On → balance existing
  members A/B by join order (alternating). Off → clear every member's `team` (`patch(id,{team:undefined})`).
- **`setTeam`** (new, member + lobby + teamMode only): move self to a team; reject if the
  target team already has `MAX_TEAM`.
- **`start`**: team mode requires **both teams non-empty**, else throw.
- **`finishMatch`**: team mode → team total = sum of members' `totalScore`; winner = higher
  team total; `won` per member = their team is the winning team. Ties or all-zero →
  non-competitive (nobody wins), same guard as FFA. FFA path unchanged. Individual
  progression/XP unchanged (each member folds their own rounds).
- **`getByCode`**: add `team` to each standing; add `teamMode` and `teamTotals:{A,B}` to the
  base payload. Keep the individual desc sort (UI groups by team).

`RoomState` (via `FunctionReturnType`) picks up the new fields automatically.

## UI
- **`scoreboard.tsx`**: extend `Standing` with `team?: "A"|"B"|null`; add optional
  `teamMode`/`teamTotals` props. When team mode, render two grouped sections (Team A / Team B)
  each with a subtotal; else the current flat list.
- **`room-lobby.tsx`** (host): a FFA/Teams `Segmented` (→ `setTeamMode`). When team mode:
  team A/B pick buttons for the current player (→ `setTeam`), grouped scoreboard, and
  "Start match" disabled unless both teams have ≥1 member.
- **`room-results.tsx`**: team mode → winning-team banner ("Team A wins" + team totals) and
  players grouped by team; FFA unchanged.
- **`room-game.tsx`**: already renders `Scoreboard`; it inherits team grouping. No deep
  reveal changes.

## Correctness watch-list
- `patch(memberId, { team: undefined })` must actually clear the optional field (Convex unset).
- Auto-balance + `setTeam` must respect `MAX_TEAM`; `start` must block empty-team matches so a
  team can't win by walkover with 0 members.
- Backward compat: existing FFA rooms (no `teamMode`) behave exactly as before; `getByCode`
  additions are optional so old clients/readers don't break.
- Cap only blocks *new* joiners, never reconnects (a reconnecting member must always get back in).

## Verification
- `bun run typecheck` (+ `convex codegen`), `bunx eslint <changed>`, `bunx vitest run`.
- Pure unit: a `teamTotals`/winner helper (sum + higher-team + tie=none) if extracted.
- Manual: create room → toggle Teams → two clients pick A/B → start blocked with an empty
  team → both teams filled → play → winning-team banner; confirm an FFA room is unchanged.
- Adversarial review between phases before Phase 4.

## Out of scope
- >2 teams, per-team chat, auto-fill matchmaking (Phase 4 parties handle grouping).

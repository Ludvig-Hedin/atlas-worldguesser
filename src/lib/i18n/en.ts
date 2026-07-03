/**
 * English UI strings — the source of truth for every other locale.
 *
 * Keys are flat, dotted namespaces. `satisfies Record<string, string>` keeps the
 * literal key union (so `TKey = keyof typeof en` stays precise) while checking
 * every value is a string. Other locales are typed against these keys.
 *
 * Use `{name}`-style placeholders for interpolation (see `translate`).
 */
export const en = {
  // Navigation / header
  "nav.maps": "Maps",
  "nav.leaderboard": "Leaderboard",
  "nav.friends": "Friends",
  "nav.stats": "Stats",
  "nav.play": "Play",

  // Auth
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.signOut": "Sign out",
  "auth.signInTooltip": "Save your progress, climb the leaderboard, and play with friends",

  // Settings menu
  "settings.title": "Settings",
  "settings.open": "Settings",
  "settings.theme": "Theme",
  "settings.theme.system": "System",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.language": "Language",
  "settings.mapType": "Map type",
  "settings.mapType.normal": "Normal",
  "settings.mapType.satellite": "Satellite",
  "settings.mapType.terrain": "Terrain",
  "settings.mapType.hybrid": "Hybrid",

  // Game
  "round.counter": "Round {current} of {total}",

  // Friends
  "friends.title": "Friends",
  "friends.subtitle": "Add players and start private matches",
  "friends.signInToManage": "Sign in to manage friends.",
  "friends.signIn": "Sign in",
  "friends.removed": "Removed",
  "friends.couldNotRemove": "Could not remove friend",
  "friends.requestSentTo": "Request sent to {name}",
  "friends.couldNotSendRequest": "Could not send request",
  "friends.requestWithdrawn": "Request withdrawn",
  "friends.couldNotWithdrawRequest": "Could not withdraw request",
  "friends.usernamePlaceholder": "e.g. mapmaster",
  "friends.add": "Add",
  "friends.requests": "Requests",
  "friends.accept": "Accept",
  "friends.decline": "Decline",
  "friends.yourFriends": "Your friends",
  "friends.noFriends": "No friends yet — add someone above.",
  "friends.remove": "Remove",
  "friends.pendingSent": "Pending sent",
  "friends.pending": "Pending…",
  "friends.cancel": "Cancel",
  "friends.recentPlayers": "Recent players",
  "friends.removeConfirmTitle": "Remove friend?",
  "friends.removeConfirmDescription": "You'll need to send a new request to add them again.",

  // Maps
  "maps.byAuthor": "by {author}",
  "maps.private": "Private",
  "maps.play": "Play",
  "maps.deleteMap": "Delete map",
  "maps.mapDeleted": "Map deleted",
  "maps.deleteFailed": "Could not delete map",
  "maps.title": "Custom maps",
  "maps.subtitle": "Play community maps or craft your own",
  "maps.create": "Create",
  "maps.yourMaps": "Your maps",
  "maps.communityMaps": "Community maps",
  "maps.noCommunityMaps": "No community maps yet — be the first to create one.",
  "maps.deleteDialogTitle": "Delete map?",
  "maps.deleteDialogDescription": "This permanently deletes this map and its locations. This can't be undone.",
  "maps.deleteConfirm": "Delete",
  "maps.mapUnavailable": "Map unavailable",
  "maps.mapUnavailableDescription": "This map is private or doesn't have enough locations.",
  "maps.browseMaps": "Browse maps",

  // Leaderboard
  "leaderboard.title": "Leaderboard",
  "leaderboard.rankedByXp": "Ranked by XP",
  "leaderboard.global": "Global",
  "leaderboard.friends": "Friends",
  "leaderboard.scopeAria": "Leaderboard scope",
  "leaderboard.you": "You",
  "leaderboard.levelGames": "Level {level} · {games} games",
  "leaderboard.noFriendsRanked": "No ranked friends yet. Add friends to see them here.",
  "leaderboard.friendsSignedOut": "Sign in and add friends to see them ranked here.",
  "leaderboard.noPlayersRanked": "No ranked players yet. Be the first.",
  "leaderboard.yourRank": "Your rank",

  // Profile
  "profile.saveName": "Save name",
  "profile.editName": "Edit name",
  "profile.statsOnDevice": "Stats saved on this device",
  "profile.recentGames": "Recent games",
  "profile.playerNotFound": "Player not found",
  "profile.noPlayerNamed": "No one plays under “{username}”.",
  "profile.levelJoined": "Level {level} · joined {joined}",
  "profile.avatarTitle": "Avatar",
  "profile.avatarUseDefault": "Use default",
  "profile.avatarColor": "Color",
  "profile.buildingLocked": "Guess {country} correctly to unlock",
  "profile.avatarGuestHint": "Sign in to claim these as your avatar",

  // Multiplayer
  "mp.host": "Host",
  "mp.disconnected": "Disconnected",
  "mp.ready": "Ready",
  "mp.notReady": "Not ready",
  "mp.movementMoving": "Moving",
  "mp.hintToast": "Search area shown on the map · {continent}",
  "mp.waitingForPlayers": "Waiting for other players…",
  "mp.nextRoundIn": "Next round in {seconds}s",
  "mp.noGuess": "No guess",
  "mp.finalResults": "Final results",
  "mp.wins": "wins",
  "mp.pointsValue": "{points} points",
  "mp.rematch": "Rematch",
  "mp.leave": "Leave",
  "mp.waitingForHost": "Waiting for the host to start a rematch…",
  "mp.signInForMultiplayer": "Sign in for multiplayer",
  "mp.createPrivateRoom": "Create private room",
  "mp.orJoin": "or join",
  "mp.roomCodeOrLink": "Room code or link",
  "mp.playWithParty": "Play with a party",
  "mp.couldNotCreateRoom": "Could not create room",

  // Game HUD
  "hud.menu": "Menu",
  "hud.backToMenu": "Back to menu",
  "hud.roundOf": "{current}/{total}",
  "hud.streak": "Streak {count}",

  // Solo setup
  "setup.chooseMap": "Choose a map",
  "setup.rules": "Rules",
  "setup.rounds": "Rounds",
  "setup.roundTimer": "Round timer",
  "setup.startGame": "Start game",
  "setup.survivalStreak": "Survival streak",
  "setup.survivalExplainer": "Survival: name the correct country to keep going — one miss ends the run.",
  "setup.timeNone": "None",
  "setup.time30": "30s",
  "setup.time60": "1m",
  "setup.time120": "2m",

  // Solo match results
  "match.greatRun": "Great run",
  "match.matchComplete": "Match complete",
  "match.survivalBadge": "Survival · {count} in a row",
  "match.level": "Level {level}",
  "match.playAgain": "Play again",
  "match.newGame": "New game",
  "match.home": "Home",
  "match.newBuilding": "New building unlocked: {name}",
  "match.setAsAvatar": "Set as avatar",
  "match.signInToClaim": "Sign in to claim",

  // Team play
  "team.format": "Format",
  "team.ffa": "Free-for-all",
  "team.teams": "Teams",
  "team.yourTeam": "Your team",
  "team.teamA": "Team A",
  "team.teamB": "Team B",
  "team.noPlayersYet": "No players yet",
  "team.unassigned": "Unassigned",
  "team.bothTeamsNeeded": "Both teams need at least one player before you can start.",
  "team.wins": "Team {team} wins",
  "team.draw": "It's a draw",
  "team.pointsVs": "{a} vs {b} points",
  "team.couldNotSwitch": "Could not switch team",
  "team.couldNotChangeFormat": "Could not change format",

  // Multiplayer lobby
  "lobby.roomCode": "Room code",
  "lobby.copyInviteAria": "Copy invite link",
  "lobby.inviteCopied": "Invite link copied",
  "lobby.map": "Map",
  "lobby.timer": "Timer",
  "lobby.hostControlsNote": "Host controls · only the host can change these",
  "lobby.roundsSuffix": "Rounds: {n}",
  "lobby.timerSuffix": "Timer: {label}",
  "lobby.imReady": "I'm ready",
  "lobby.readyTooltip": "Let the host know you're set — they can start anytime.",
  "lobby.startMatch": "Start match",
  "lobby.waitingForHostToStart": "Waiting for the host to start… Mark yourself ready so they know you're set.",
  "lobby.players": "Players",
  "lobby.readyCount": "Ready: {ready}/{total}",
  "lobby.chat": "Chat",
  "lobby.couldNotStart": "Could not start",
  "lobby.couldNotUpdate": "Could not update settings",

  // Party
  "party.title": "Party",
  "party.subtitle": "Group up with friends and drop into the same room together.",
  "party.signInPrompt": "Sign in to create a party and invite friends.",
  "party.invitationsTitle": "Invitations",
  "party.invitedYou": "{name} invited you to their party",
  "party.declineAria": "Decline",
  "party.createPrompt": "Start a party, invite friends, and play together.",
  "party.createButton": "Create a party",
  "party.yourParty": "Your party",
  "party.inCount": "{joined} in",
  "party.inCountInvited": "{joined} in · {invited} invited",
  "party.leader": "Leader",
  "party.invited": "Invited",
  "party.inviteFriendsTitle": "Invite friends",
  "party.noFriendsLeft": "No friends left to invite.",
  "party.addFriends": "Add friends",
  "party.invite": "Invite",
  "party.rejoinRoom": "Rejoin room",
  "party.startRoomTogether": "Start room together",
  "party.joinRoom": "Join room",
  "party.waitingForLeader": "Waiting for the leader to start a room…",
  "party.roomLive": "Room {code} is live — your party can join now.",
  "party.invitedToast": "Invited {name}",
  "party.couldNotInvite": "Could not invite",
  "party.couldNotJoinParty": "Could not join",
  "party.couldNotCreate": "Could not create party",
  "party.couldNotStartRoom": "Could not start room",

  // Chat
  "chat.noMessages": "No messages yet — say hello.",
  "chat.placeholder": "Message…",
  "chat.sendAria": "Send",
  "chat.notSent": "Message not sent — try again in a moment",

  // Daily Challenge
  "daily.solo": "Solo",
  "daily.badge": "Daily Challenge",
  "daily.heading": "Same five places. Everyone. Once a day.",
  "daily.subheading": "One shot at today's five locations. Come back tomorrow for a new set.",
  "daily.playedBanner": "You've played today's challenge. See how you rank below — a new challenge drops tomorrow.",
  "daily.playButton": "Play today's challenge",
  "daily.signInNudge": "Sign in to save your score and join the leaderboard.",
  "daily.leaderboardTitle": "Today's leaderboard",
  "daily.youScore": "You: {score}",
  "daily.youScoreRank": "You: {score} · #{rank}",
  "daily.noScoresYet": "No scores yet today. Be the first to set the pace.",
  "daily.countriesOf5": "{count}/5 countries",
  "daily.submitSuccess": "Daily submitted — {score} pts · {correct}/5 countries",
  "daily.submitErrorFallback": "Couldn't submit your daily score.",

  // Generic / shared
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.join": "Join",
} satisfies Record<string, string>;

export type EnDictionary = typeof en;

/** Every translatable UI key (from the English source of truth). */
export type TKey = keyof EnDictionary;

/** A locale dictionary; keys may be omitted during rollout (English fallback). */
export type LocaleDictionary = Partial<Record<TKey, string>>;

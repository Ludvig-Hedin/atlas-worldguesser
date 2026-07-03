/** Core domain types shared across the client engine, Convex, and UI. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Point of view for a Street View panorama. */
export interface Pov {
  heading: number;
  pitch: number;
  zoom?: number;
}

export type GameModeId =
  | "world"
  | "europe"
  | "asia"
  | "africa"
  | "northamerica"
  | "southamerica"
  | "oceania"
  | "usa"
  | "countries"
  | "custom";

/** Movement restriction, ordered from easiest to hardest. */
export type Movement = "moving" | "noMove" | "noMoveNoPanZoom";

export interface GameSettings {
  rounds: number;
  /** Seconds per round; 0 = untimed. */
  timeLimitSec: number;
  movement: Movement;
}

/** A curated place with confirmed panorama coverage. */
export interface GameLocation extends LatLng {
  /** ISO 3166-1 alpha-2, uppercase. */
  countryCode: string;
  heading?: number;
  pitch?: number;
  /** Cached Google panorama id, when resolved server-side. */
  panoId?: string;
}

/** A single sampled camera/position frame, for replays of "moving" rounds. */
export interface PovFrame extends LatLng {
  heading: number;
  pitch: number;
  /** ms since round start. */
  t: number;
}

export interface RoundResult {
  round: number;
  actual: GameLocation;
  guess: LatLng | null;
  distanceMeters: number;
  score: number;
  timeMs: number;
  guessCountryCode: string | null;
  countryCorrect: boolean;
  path?: PovFrame[];
}

export type SoloGamePhase = "guessing" | "reveal" | "finished";

export interface SoloGameState {
  id: string;
  mapId: GameModeId | string;
  settings: GameSettings;
  locations: GameLocation[];
  results: RoundResult[];
  currentRound: number;
  phase: SoloGamePhase;
  startedAt: number;
  seed: number;
}

/** Aggregate stats persisted locally for guests, or in Convex for members. */
export interface PlayerStats {
  gamesPlayed: number;
  roundsPlayed: number;
  wins: number;
  bestScore: number;
  totalDistanceMeters: number;
  countryCorrect: number;
  countryTotal: number;
  xp: number;
}

export const EMPTY_STATS: PlayerStats = {
  gamesPlayed: 0,
  roundsPlayed: 0,
  wins: 0,
  bestScore: 0,
  totalDistanceMeters: 0,
  countryCorrect: 0,
  countryTotal: 0,
  xp: 0,
};

export const MAX_ROUND_SCORE = 5000;

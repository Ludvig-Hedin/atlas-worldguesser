/**
 * Flags mode scoring — pure, shared between the client engine and the Convex
 * server (which recomputes score/XP from the untrusted attempt counts so the
 * client can't inflate its own numbers). No React / browser / alias imports so
 * `convex/flags.ts` can import it directly.
 *
 * A flag is guessed by clicking countries until the right one is hit. Points
 * decay with each wrong click; after `FLAG_MAX_WRONG` misses the country is
 * revealed for 0 points. Colors escalate amber → orange → red on the way there.
 */

/** Wrong clicks allowed before the answer is revealed for 0 points. */
export const FLAG_MAX_WRONG = 3;

/** Points by number of wrong clicks *before* the correct one (index = wrong). */
export const FLAG_POINTS = [1000, 600, 300] as const;

/** Best possible score for a single flag (solved on the first click). */
export const FLAG_MAX_SCORE = FLAG_POINTS[0];

/** Score for one flag given how many wrong clicks preceded solving it. */
export function flagRoundScore(wrongAttempts: number): number {
  const w = Math.max(0, Math.floor(wrongAttempts));
  return FLAG_POINTS[w] ?? 0;
}

/** Total score for a run — one `wrongAttempts` entry per flag. */
export function flagRunScore(perFlagWrong: readonly number[]): number {
  return perFlagWrong.reduce((sum, w) => sum + flagRoundScore(w), 0);
}

/**
 * XP earned by a run, in the same pool as distance games. A fifth of the score
 * (perfect flag = 200 XP) mirrors `xpForRound` so a flag round and a distance
 * round are worth the same at their best.
 */
export function flagXpForRun(perFlagWrong: readonly number[]): number {
  return Math.round(flagRunScore(perFlagWrong) / 5);
}

/**
 * Escalation level for the nth wrong click (1-based): 1 = amber, 2 = orange,
 * 3 = red (the reveal). Clamped so anything beyond stays red.
 */
export function flagWarnLevel(wrongAttempt: number): 1 | 2 | 3 {
  const n = Math.floor(wrongAttempt);
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

/**
 * Each side's percentage share (0-100) of a 1v1 duel's combined score — the
 * pure display math behind DuelHealthBar. Splits 50/50 when both scores are
 * zero (round hasn't started / no one has guessed yet). No new scoring
 * formula: this is a reframing of the existing standings totals.
 */
export function duelHealthShare(myScore: number, oppScore: number): number {
  const total = myScore + oppScore;
  if (total <= 0) return 50;
  return (myScore / total) * 100;
}

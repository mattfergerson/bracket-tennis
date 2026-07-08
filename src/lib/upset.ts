/**
 * Pure upset-bonus helpers, shared by server scoring (lib/scoring, lib/digest)
 * and client display (bracket-view). No prisma imports here — this module must
 * stay safe to bundle client-side.
 */

const DEFAULT_UNSEEDED = 33;

/**
 * Calculate upset bonus for a single match.
 * Returns 0 if the higher seed won (no upset).
 */
export function calcUpsetBonus(
  player1Seed: number | null,
  player2Seed: number | null,
  winnerId: string,
  player1Id: string | null,
  roundPoints: number,
  upsetMultiplier: number
): number {
  const s1 = player1Seed ?? DEFAULT_UNSEEDED;
  const s2 = player2Seed ?? DEFAULT_UNSEEDED;

  if (s1 === s2) return 0;

  const winnerIsPlayer1 = winnerId === player1Id;
  const winnerSeed = winnerIsPlayer1 ? s1 : s2;
  const loserSeed = winnerIsPlayer1 ? s2 : s1;

  // Upset = higher seed number (lower rank) beats lower seed number (higher rank)
  if (winnerSeed <= loserSeed) return 0;

  const seedGap = winnerSeed - loserSeed;
  return roundPoints * upsetMultiplier * seedGap;
}

/**
 * True when a user's bracket predicted this exact matchup: their picks in the
 * two feeder matches are precisely the two players who actually met. The upset
 * bonus is only earned for upsets the user specifically called — a correct
 * winner pick against an unpredicted opponent gets no bonus. Round 1 matchups
 * are fixed by the draw, so callers should skip this check for round 1.
 */
export function isExactMatchup(
  player1Id: string | null,
  player2Id: string | null,
  feederPick1: string | null | undefined,
  feederPick2: string | null | undefined
): boolean {
  if (!player1Id || !player2Id || !feederPick1 || !feederPick2) return false;
  return (
    (feederPick1 === player1Id && feederPick2 === player2Id) ||
    (feederPick1 === player2Id && feederPick2 === player1Id)
  );
}

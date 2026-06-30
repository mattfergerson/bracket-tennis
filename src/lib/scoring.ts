import { prisma } from "@/lib/prisma";

const DEFAULT_UNSEEDED = 33;

export type LeaderboardEntry = {
  userId: string;
  username: string;
  score: number;
  correctPicks: number;
  totalPicks: number;
  pendingPicks: number;
  maxPossibleScore: number;
};

/**
 * Compute leaderboard for a tournament across both genders.
 *
 * Scoring:
 * 1. Advancement points — if the player you picked to win a match actually
 *    reached that round (is one of the two players), you earn base round points.
 * 2. Upset bonus — if you correctly picked the lower seed to win AND the match
 *    is decided, bonus = roundPoints × upsetMultiplier × seedGap.
 */
export async function getTournamentLeaderboard(
  tournamentId: string
): Promise<LeaderboardEntry[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { upsetMultiplier: true },
  });

  const upsetMultiplier = tournament?.upsetMultiplier ?? 0.1;

  const draws = await prisma.draw.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const drawIds = draws.map((d) => d.id);

  const pointConfigs = await prisma.pointConfig.findMany({
    where: { tournamentId },
  });
  const pointsPerRound = new Map<number, number>(
    pointConfigs.map((pc) => [pc.round, pc.points])
  );

  const brackets = await prisma.bracket.findMany({
    where: { drawId: { in: drawIds } },
    include: {
      user: { select: { id: true, username: true } },
      picks: {
        include: {
          pickedPlayer: { select: { id: true, seed: true } },
          match: {
            select: {
              round: true,
              position: true,
              winnerId: true,
              player1Id: true,
              player2Id: true,
              player1: { select: { seed: true } },
              player2: { select: { seed: true } },
            },
          },
        },
      },
    },
  });

  const userScores = new Map<
    string,
    {
      userId: string;
      username: string;
      score: number;
      correct: number;
      total: number;
      pending: number;
    }
  >();

  for (const bracket of brackets) {
    const userId = bracket.user.id;

    if (!userScores.has(userId)) {
      userScores.set(userId, {
        userId,
        username: bracket.user.username,
        score: 0,
        correct: 0,
        total: 0,
        pending: 0,
      });
    }

    const entry = userScores.get(userId)!;

    for (const pick of bracket.picks) {
      entry.total++;

      const match = pick.match;
      const roundPts = pointsPerRound.get(match.round) ?? 0;
      const pickedPlayerId = pick.pickedPlayer.id;

      // Check if picked player actually reached this round
      const playerInMatch =
        match.player1Id === pickedPlayerId || match.player2Id === pickedPlayerId;

      if (!playerInMatch) {
        // Player didn't make it to this round — no points
        continue;
      }

      if (match.winnerId === null) {
        // Match not decided yet
        entry.pending++;
        continue;
      }

      // Award points only when the picked player actually won this match —
      // i.e. they "made it through" this round. Reaching a round (being in the
      // match) is not enough; a player who loses earns nothing for that round.
      if (match.winnerId === pickedPlayerId) {
        entry.correct++;
        entry.score += roundPts;

        // Upset bonus on top for correctly calling a lower seed's win
        const bonus = calcUpsetBonus(
          match.player1?.seed ?? null,
          match.player2?.seed ?? null,
          match.winnerId,
          match.player1Id,
          roundPts,
          upsetMultiplier
        );
        entry.score += bonus;
      }
    }
  }

  const entries: LeaderboardEntry[] = Array.from(userScores.values()).map(
    (entry) => ({
      userId: entry.userId,
      username: entry.username,
      score: Math.round(entry.score * 10) / 10,
      correctPicks: entry.correct,
      totalPicks: entry.total,
      pendingPicks: entry.pending,
      maxPossibleScore: Math.round(entry.score * 10) / 10,
    })
  );

  return entries.sort(
    (a, b) => b.score - a.score || b.correctPicks - a.correctPicks
  );
}

/**
 * Get score for a single user in a tournament.
 */
export async function getUserScore(
  userId: string,
  tournamentId: string
): Promise<number> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { upsetMultiplier: true },
  });
  const upsetMultiplier = tournament?.upsetMultiplier ?? 0.1;

  const draws = await prisma.draw.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const drawIds = draws.map((d) => d.id);

  const pointConfigs = await prisma.pointConfig.findMany({
    where: { tournamentId },
  });
  const pointsPerRound = new Map<number, number>(
    pointConfigs.map((pc) => [pc.round, pc.points])
  );

  const brackets = await prisma.bracket.findMany({
    where: { userId, drawId: { in: drawIds } },
    include: {
      picks: {
        include: {
          pickedPlayer: { select: { id: true, seed: true } },
          match: {
            select: {
              round: true,
              position: true,
              winnerId: true,
              player1Id: true,
              player2Id: true,
              player1: { select: { seed: true } },
              player2: { select: { seed: true } },
            },
          },
        },
      },
    },
  });

  let score = 0;
  for (const bracket of brackets) {
    for (const pick of bracket.picks) {
      const match = pick.match;
      const roundPts = pointsPerRound.get(match.round) ?? 0;
      const pickedPlayerId = pick.pickedPlayer.id;

      if (!match.winnerId) continue;

      // Award points only when the picked player won this match
      if (match.winnerId === pickedPlayerId) {
        score += roundPts;
        score += calcUpsetBonus(
          match.player1?.seed ?? null,
          match.player2?.seed ?? null,
          match.winnerId,
          match.player1Id,
          roundPts,
          upsetMultiplier
        );
      }
    }
  }

  return Math.round(score * 10) / 10;
}

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

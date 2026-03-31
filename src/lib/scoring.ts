import { prisma } from "@/lib/prisma";

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
 */
export async function getTournamentLeaderboard(
  tournamentId: string
): Promise<LeaderboardEntry[]> {
  // Get all draws for this tournament
  const draws = await prisma.draw.findMany({
    where: { tournamentId },
    select: { id: true },
  });

  const drawIds = draws.map((d) => d.id);

  // Get point configs
  const pointConfigs = await prisma.pointConfig.findMany({
    where: { tournamentId },
  });

  const pointsPerRound = new Map<number, number>(
    pointConfigs.map((pc) => [pc.round, pc.points])
  );

  // Get all brackets for these draws with their picks
  const brackets = await prisma.bracket.findMany({
    where: { drawId: { in: drawIds } },
    include: {
      user: { select: { id: true, username: true } },
      picks: {
        include: {
          match: { select: { round: true, winnerId: true } },
        },
      },
    },
  });

  // Aggregate scores per user
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

      if (pick.isCorrect === true) {
        const pts = pointsPerRound.get(pick.match.round) ?? 0;
        entry.score += pts;
        entry.correct++;
      } else if (pick.isCorrect === null && pick.match.winnerId === null) {
        entry.pending++;
      }
    }
  }

  // Compute max possible score (all pending picks correct)
  const entries: LeaderboardEntry[] = Array.from(userScores.values()).map(
    (entry) => {
      // For simplicity, pending picks could be worth points if they're all correct
      // This is an optimistic estimate
      return {
        userId: entry.userId,
        username: entry.username,
        score: entry.score,
        correctPicks: entry.correct,
        totalPicks: entry.total,
        pendingPicks: entry.pending,
        maxPossibleScore: entry.score, // simplified — full calc would track remaining rounds
      };
    }
  );

  return entries.sort((a, b) => b.score - a.score || b.correctPicks - a.correctPicks);
}

/**
 * Get score for a single user in a tournament.
 */
export async function getUserScore(
  userId: string,
  tournamentId: string
): Promise<number> {
  const draws = await prisma.draw.findMany({
    where: { tournamentId },
    select: { id: true },
  });

  const drawIds = draws.map((d) => d.id);
  const pointConfigs = await prisma.pointConfig.findMany({ where: { tournamentId } });
  const pointsPerRound = new Map<number, number>(
    pointConfigs.map((pc) => [pc.round, pc.points])
  );

  const brackets = await prisma.bracket.findMany({
    where: { userId, drawId: { in: drawIds } },
    include: {
      picks: {
        where: { isCorrect: true },
        include: { match: { select: { round: true } } },
      },
    },
  });

  let score = 0;
  for (const bracket of brackets) {
    for (const pick of bracket.picks) {
      score += pointsPerRound.get(pick.match.round) ?? 0;
    }
  }

  return score;
}

import { prisma } from "@/lib/prisma";
import { calcUpsetBonus, isExactMatchup } from "@/lib/upset";

export type LeaderboardEntry = {
  userId: string;
  username: string;
  score: number;
  correctPicks: number;
  totalPicks: number;
  /**
   * Picks that are still alive: their match is undecided and the picked
   * player has not been eliminated from the tournament. Displayed as "alive"
   * in the UI. (Field name kept for compatibility with stored digest data.)
   */
  pendingPicks: number;
  maxPossibleScore: number;
};

/**
 * Compute leaderboard for a tournament across both genders.
 *
 * Scoring:
 * 1. Advancement points — awarded when the player you picked to win a match
 *    actually won it.
 * 2. Upset bonus — only when you called this exact upset: your feeder-match
 *    picks predicted the two players who actually met, and you picked the
 *    lower seed to win. Bonus = roundPoints × upsetMultiplier × seedGap.
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

  // Players knocked out of the tournament (lost any decided match) — used to
  // count each user's still-alive picks. Also indexed by draw/round/position
  // to resolve feeder matches for the exact-matchup bonus check.
  const allMatches = await prisma.match.findMany({
    where: { drawId: { in: drawIds } },
    select: {
      id: true,
      drawId: true,
      round: true,
      position: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
    },
  });
  const matchByPos = new Map(
    allMatches.map((m) => [`${m.drawId}:${m.round}-${m.position}`, m])
  );
  const eliminated = new Set<string>();
  for (const m of allMatches) {
    if (!m.winnerId) continue;
    if (m.player1Id && m.player1Id !== m.winnerId) eliminated.add(m.player1Id);
    if (m.player2Id && m.player2Id !== m.winnerId) eliminated.add(m.player2Id);
  }

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

    const pickByMatch = new Map(
      bracket.picks.map((p) => [p.matchId, p.pickedPlayerId])
    );

    for (const pick of bracket.picks) {
      entry.total++;

      const match = pick.match;
      const roundPts = pointsPerRound.get(match.round) ?? 0;
      const pickedPlayerId = pick.pickedPlayer.id;

      if (match.winnerId === null) {
        // Undecided match: the pick is "alive" if the picked player hasn't
        // been eliminated from the tournament — i.e. it can still come true,
        // regardless of whether the player has reached this match yet.
        if (!eliminated.has(pickedPlayerId)) {
          entry.pending++;
        }
        continue;
      }

      // Award points only when the picked player actually won this match —
      // i.e. they "made it through" this round. Reaching a round (being in the
      // match) is not enough; a player who loses earns nothing for that round.
      if (match.winnerId === pickedPlayerId) {
        entry.correct++;
        entry.score += roundPts;

        // Upset bonus only when the user predicted this exact matchup: their
        // picks in the two feeder matches must be the two players who actually
        // met here. Round 1 matchups are fixed by the draw, so they always
        // qualify.
        let exact = match.round === 1;
        if (!exact) {
          const feeder1 = matchByPos.get(
            `${bracket.drawId}:${match.round - 1}-${match.position * 2 - 1}`
          );
          const feeder2 = matchByPos.get(
            `${bracket.drawId}:${match.round - 1}-${match.position * 2}`
          );
          exact = isExactMatchup(
            match.player1Id,
            match.player2Id,
            feeder1 ? pickByMatch.get(feeder1.id) : undefined,
            feeder2 ? pickByMatch.get(feeder2.id) : undefined
          );
        }

        if (exact) {
          entry.score += calcUpsetBonus(
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

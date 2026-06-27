import { prisma } from "@/lib/prisma";
import { fetchMatchResults } from "@/lib/tennis-api";

export type SyncResult = { synced: number; total: number };

/**
 * Sync match results for a single draw from Sportradar.
 *
 * Sets winners, propagates them into the next-round player slots, and marks
 * bracket picks correct/incorrect. Shared by the admin "Sync Results" button
 * and the daily-digest cron.
 */
export async function syncDrawResults(drawId: string): Promise<SyncResult> {
  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: {
      tournament: true,
      matches: { select: { id: true, round: true, position: true, winnerId: true } },
    },
  });

  if (!draw) {
    throw new Error("Draw not found");
  }

  const results = await fetchMatchResults(
    draw.tournament.major,
    draw.gender,
    draw.tournament.year
  );

  const externalIds = results.map((r) => r.winnerExternalId);
  const playersInDb = await prisma.player.findMany({
    where: { externalId: { in: externalIds } },
    select: { id: true, externalId: true },
  });
  const playerMap = new Map(playersInDb.map((p) => [p.externalId!, p.id]));

  const matchLookup = new Map(
    draw.matches.map((m) => [`${m.round}-${m.position}`, m])
  );

  // Process in round order so winners propagate forward correctly
  results.sort((a, b) => a.round - b.round || a.position - b.position);

  let updated = 0;
  for (const result of results) {
    const dbMatch = matchLookup.get(`${result.round}-${result.position}`);
    if (!dbMatch) continue;

    const winnerDbId = playerMap.get(result.winnerExternalId);
    if (!winnerDbId) continue;

    if (dbMatch.winnerId === winnerDbId) continue;

    await prisma.match.update({
      where: { id: dbMatch.id },
      data: { winnerId: winnerDbId, completedAt: new Date() },
    });

    // Propagate into next-round slot
    const nextRound = result.round + 1;
    if (nextRound <= 7) {
      const nextPosition = Math.ceil(result.position / 2);
      const isFirstSlot = result.position % 2 !== 0;
      const nextMatch = matchLookup.get(`${nextRound}-${nextPosition}`);
      if (nextMatch) {
        await prisma.match.update({
          where: { id: nextMatch.id },
          data: isFirstSlot ? { player1Id: winnerDbId } : { player2Id: winnerDbId },
        });
      }
    }

    // Score picks
    await prisma.bracketPick.updateMany({
      where: { matchId: dbMatch.id, pickedPlayerId: winnerDbId },
      data: { isCorrect: true },
    });
    await prisma.bracketPick.updateMany({
      where: { matchId: dbMatch.id, NOT: { pickedPlayerId: winnerDbId } },
      data: { isCorrect: false },
    });

    updated++;
  }

  return { synced: updated, total: results.length };
}

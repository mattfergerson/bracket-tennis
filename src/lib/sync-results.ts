import { prisma } from "@/lib/prisma";
import { fetchMatchResults } from "@/lib/tennis-api";
import { unpropagateWinner } from "@/lib/unpropagate";

export type SyncResult = { synced: number; total: number };

/**
 * Sync match results for a single draw from the tennis API.
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
      matches: {
        select: {
          id: true,
          round: true,
          position: true,
          winnerId: true,
          player1Id: true,
          player2Id: true,
        },
      },
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

    // The winner must actually be one of this slot's two players. Without
    // this check, a (round, position) collision against an unrelated
    // tournament sharing the Player table — e.g. two different majors whose
    // draws happen to line up — would silently write in a winner who never
    // played the match.
    if (winnerDbId !== dbMatch.player1Id && winnerDbId !== dbMatch.player2Id) {
      console.warn(
        `Sync mismatch: winner ${winnerDbId} for draw ${draw.id} round ${result.round} position ${result.position} isn't either player in that slot — skipped.`
      );
      continue;
    }

    if (dbMatch.winnerId === winnerDbId) continue;

    // Each result commits atomically: winner, downstream cleanup/propagation,
    // and pick scoring land together or not at all.
    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: dbMatch.id },
        data: { winnerId: winnerDbId, completedAt: new Date() },
      });

      // A differing stored winner means this is a correction: remove the old
      // winner from every downstream slot they already propagated into.
      if (dbMatch.winnerId && dbMatch.winnerId !== winnerDbId) {
        await unpropagateWinner(
          tx,
          draw.id,
          result.round,
          result.position,
          dbMatch.winnerId,
          winnerDbId
        );
      }

      // Propagate into next-round slot
      const nextRound = result.round + 1;
      if (nextRound <= 7) {
        const nextPosition = Math.ceil(result.position / 2);
        const isFirstSlot = result.position % 2 !== 0;
        const nextMatch = matchLookup.get(`${nextRound}-${nextPosition}`);
        if (nextMatch) {
          await tx.match.update({
            where: { id: nextMatch.id },
            data: isFirstSlot ? { player1Id: winnerDbId } : { player2Id: winnerDbId },
          });
          // Keep the in-memory snapshot current so a later result in this
          // same batch (e.g. syncing several rounds' worth of a backlog at
          // once) sees this slot's newly-propagated player when it runs the
          // player1Id/player2Id check above, instead of the pre-loop value.
          if (isFirstSlot) {
            nextMatch.player1Id = winnerDbId;
          } else {
            nextMatch.player2Id = winnerDbId;
          }
        }
      }

      // Score picks
      await tx.bracketPick.updateMany({
        where: { matchId: dbMatch.id, pickedPlayerId: winnerDbId },
        data: { isCorrect: true },
      });
      await tx.bracketPick.updateMany({
        where: { matchId: dbMatch.id, NOT: { pickedPlayerId: winnerDbId } },
        data: { isCorrect: false },
      });
    });

    updated++;
  }

  return { synced: updated, total: results.length };
}

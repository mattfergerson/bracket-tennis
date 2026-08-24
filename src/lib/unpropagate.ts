import { Prisma } from "@/generated/prisma/client";

/**
 * Clean up downstream state after a match winner is corrected or undone.
 *
 * Walks the removed player's path forward from the corrected match: replaces
 * them in the next-round slot (with `replacementPlayerId` on the first hop,
 * null deeper — a corrected winner hasn't won those later matches), and when a
 * downstream match was already decided in the removed player's favor,
 * invalidates that result (winner and completedAt cleared, pick isCorrect
 * flags reset) and keeps walking. Stops as soon as a slot doesn't hold the
 * removed player (never propagated, or already repaired by a re-sync) or the
 * removed player didn't advance further.
 *
 * Takes a transaction client so callers decide atomicity.
 */
export async function unpropagateWinner(
  tx: Prisma.TransactionClient,
  drawId: string,
  fromRound: number,
  fromPosition: number,
  removedPlayerId: string,
  replacementPlayerId: string | null
): Promise<void> {
  let round = fromRound + 1;
  let position = Math.ceil(fromPosition / 2);
  let isFirstSlot = fromPosition % 2 !== 0;
  let replacement = replacementPlayerId;

  while (round <= 7) {
    const match = await tx.match.findUnique({
      where: { drawId_round_position: { drawId, round, position } },
      select: { id: true, winnerId: true, player1Id: true, player2Id: true },
    });
    if (!match) return;

    const slotPlayer = isFirstSlot ? match.player1Id : match.player2Id;
    if (slotPlayer !== removedPlayerId) return;

    const advanced = match.winnerId === removedPlayerId;
    const data: Prisma.MatchUncheckedUpdateInput = isFirstSlot
      ? { player1Id: replacement }
      : { player2Id: replacement };
    if (advanced) {
      data.winnerId = null;
      data.completedAt = null;
    }

    await tx.match.update({ where: { id: match.id }, data });

    if (!advanced) return;

    // The removed player's downstream "win" no longer stands; its picks are
    // back to undecided.
    await tx.bracketPick.updateMany({
      where: { matchId: match.id },
      data: { isCorrect: null },
    });

    replacement = null;
    isFirstSlot = position % 2 !== 0;
    position = Math.ceil(position / 2);
    round++;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { unpropagateWinner } from "@/lib/unpropagate";

/**
 * Set a match winner. This will:
 * 1. Record the winner on the match
 * 2. Mark bracket picks as correct/incorrect
 * 3. Propagate winner to the next-round match slot
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: matchId } = await params;
  const { winnerId } = await req.json();

  if (!winnerId) {
    return NextResponse.json({ error: "winnerId is required" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { draw: { include: { tournament: { include: { pointConfigs: true } } } } },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    return NextResponse.json({ error: "Winner must be one of the match players" }, { status: 400 });
  }

  const updatedMatch = await prisma.$transaction(async (tx) => {
    // Update match with winner
    const updated = await tx.match.update({
      where: { id: matchId },
      data: { winnerId, completedAt: new Date() },
    });

    // Mark all picks for this match as correct or incorrect
    await tx.bracketPick.updateMany({
      where: { matchId, pickedPlayerId: winnerId },
      data: { isCorrect: true },
    });

    await tx.bracketPick.updateMany({
      where: { matchId, NOT: { pickedPlayerId: winnerId } },
      data: { isCorrect: false },
    });

    // If this corrects a previously recorded winner, clean up everywhere the
    // old winner already propagated (deeper slots, decided downstream results).
    if (match.winnerId && match.winnerId !== winnerId) {
      await unpropagateWinner(
        tx,
        match.drawId,
        match.round,
        match.position,
        match.winnerId,
        winnerId
      );
    }

    // Propagate winner to next round match
    // In a 128-player draw:
    //   Round 1 has 64 matches (positions 1-64)
    //   Round 2 has 32 matches — match at position ceil(pos/2)
    //   Pattern: next position = ceil(position / 2)
    const nextRound = match.round + 1;
    if (nextRound <= 7) {
      const nextPosition = Math.ceil(match.position / 2);
      const isFirstSlot = match.position % 2 !== 0;

      const nextMatch = await tx.match.findUnique({
        where: {
          drawId_round_position: {
            drawId: match.drawId,
            round: nextRound,
            position: nextPosition,
          },
        },
      });

      if (nextMatch) {
        await tx.match.update({
          where: { id: nextMatch.id },
          data: isFirstSlot ? { player1Id: winnerId } : { player2Id: winnerId },
        });
      }
    }

    return updated;
  });

  return NextResponse.json(updatedMatch);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: matchId } = await params;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Undo a result: clear winner, reset picks, and clear the old winner from
  // every downstream slot they propagated into (including invalidating any
  // downstream results already decided in their favor).
  const updated = await prisma.$transaction(async (tx) => {
    await tx.bracketPick.updateMany({
      where: { matchId },
      data: { isCorrect: null },
    });

    const cleared = await tx.match.update({
      where: { id: matchId },
      data: { winnerId: null, completedAt: null },
    });

    if (match.winnerId) {
      await unpropagateWinner(
        tx,
        match.drawId,
        match.round,
        match.position,
        match.winnerId,
        null
      );
    }

    return cleared;
  });

  return NextResponse.json(updated);
}

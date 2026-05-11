import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  // Update match with winner
  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: { winnerId, completedAt: new Date() },
  });

  // Mark all picks for this match as correct or incorrect
  await prisma.bracketPick.updateMany({
    where: { matchId, pickedPlayerId: winnerId },
    data: { isCorrect: true },
  });

  await prisma.bracketPick.updateMany({
    where: { matchId, NOT: { pickedPlayerId: winnerId } },
    data: { isCorrect: false },
  });

  // Propagate winner to next round match
  // In a 128-player draw:
  //   Round 1 has 64 matches (positions 1-64)
  //   Round 2 has 32 matches — match at position ceil(pos/2)
  //   Pattern: next position = ceil(position / 2)
  const nextRound = match.round + 1;
  if (nextRound <= 7) {
    const nextPosition = Math.ceil(match.position / 2);
    const isFirstSlot = match.position % 2 !== 0;

    const nextMatch = await prisma.match.findUnique({
      where: {
        drawId_round_position: {
          drawId: match.drawId,
          round: nextRound,
          position: nextPosition,
        },
      },
    });

    if (nextMatch) {
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: isFirstSlot ? { player1Id: winnerId } : { player2Id: winnerId },
      });
    }
  }

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

  // Undo a result: clear winner and reset picks
  await prisma.bracketPick.updateMany({
    where: { matchId },
    data: { isCorrect: null },
  });

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { winnerId: null, completedAt: null },
  });

  // Also clear the propagated player from the next-round match so the bracket
  // doesn't show a stale player in a slot whose source is now undecided.
  const nextRound = updated.round + 1;
  if (nextRound <= 7) {
    const nextPosition = Math.ceil(updated.position / 2);
    const isFirstSlot = updated.position % 2 !== 0;

    await prisma.match.updateMany({
      where: {
        drawId: updated.drawId,
        round: nextRound,
        position: nextPosition,
      },
      data: isFirstSlot ? { player1Id: null } : { player2Id: null },
    });
  }

  return NextResponse.json(updated);
}

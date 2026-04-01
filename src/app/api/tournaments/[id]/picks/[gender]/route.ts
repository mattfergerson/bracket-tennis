import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Gender } from "@/generated/prisma/client";

/**
 * Submit/update picks for a bracket.
 * Body: { picks: { matchId: string, pickedPlayerId: string }[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gender: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId, gender: genderParam } = await params;
  const gender = genderParam.toUpperCase() as Gender;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (tournament.status !== "ACCEPTING_PICKS") {
    return NextResponse.json(
      { error: "Picks are not currently accepted for this tournament" },
      { status: 400 }
    );
  }

  const draw = await prisma.draw.findUnique({
    where: { tournamentId_gender: { tournamentId, gender } },
    select: { id: true },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  const { picks } = await req.json();
  if (!Array.isArray(picks)) {
    return NextResponse.json({ error: "picks must be an array" }, { status: 400 });
  }

  // Upsert the bracket and replace all picks atomically so a partial failure
  // never leaves the bracket in a "Picked but no picks" state.
  const { bracketId } = await prisma.$transaction(async (tx) => {
    const bracket = await tx.bracket.upsert({
      where: { userId_drawId: { userId: session.user.id, drawId: draw.id } },
      update: { updatedAt: new Date() },
      create: { userId: session.user.id, drawId: draw.id },
    });

    await tx.bracketPick.deleteMany({ where: { bracketId: bracket.id } });

    if (picks.length > 0) {
      await tx.bracketPick.createMany({
        data: (picks as { matchId: string; pickedPlayerId: string }[]).map((pick) => ({
          bracketId: bracket.id,
          matchId: pick.matchId,
          pickedPlayerId: pick.pickedPlayerId,
        })),
      });
    }

    return { bracketId: bracket.id };
  });

  return NextResponse.json({ bracketId, savedPicks: picks.length });
}

/**
 * Get the current user's picks for a bracket
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gender: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tournamentId, gender: genderParam } = await params;
  const gender = genderParam.toUpperCase() as Gender;

  const draw = await prisma.draw.findUnique({
    where: { tournamentId_gender: { tournamentId, gender } },
    select: { id: true },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  const bracket = await prisma.bracket.findUnique({
    where: { userId_drawId: { userId: session.user.id, drawId: draw.id } },
    include: { picks: true },
  });

  const picks: Record<string, string> = {};
  if (bracket) {
    for (const pick of bracket.picks) {
      picks[pick.matchId] = pick.pickedPlayerId;
    }
  }

  return NextResponse.json({ picks, bracketId: bracket?.id ?? null });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Gender } from "@/generated/prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gender: string }> }
) {
  const { id: tournamentId, gender: genderParam } = await params;
  const gender = genderParam.toUpperCase() as Gender;

  const session = await auth();

  const draw = await prisma.draw.findUnique({
    where: { tournamentId_gender: { tournamentId, gender } },
    include: {
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  // If user is logged in, load their picks for this draw
  let userPicks: Record<string, string> = {};
  if (session?.user?.id) {
    const bracket = await prisma.bracket.findUnique({
      where: { userId_drawId: { userId: session.user.id, drawId: draw.id } },
      include: { picks: true },
    });

    if (bracket) {
      for (const pick of bracket.picks) {
        userPicks[pick.matchId] = pick.pickedPlayerId;
      }
    }
  }

  return NextResponse.json({
    drawId: draw.id,
    gender: draw.gender,
    matches: draw.matches,
    userPicks,
  });
}

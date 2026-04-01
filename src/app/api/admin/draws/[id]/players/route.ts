import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  // Deleting matches cascades to BracketPick rows
  await prisma.match.deleteMany({ where: { drawId } });

  return NextResponse.json({ success: true });
}

/**
 * Bulk upsert players and create R128 matches for a draw.
 * Accepts an array of player objects with name, seed, nationality.
 * Players are ordered by seed (1-128). Seeded matchups follow standard
 * Grand Slam draw format: player at position i vs player at position (n+1-i)
 * where n = 128.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  const { players } = await req.json();
  if (!Array.isArray(players) || players.length !== 128) {
    return NextResponse.json(
      { error: "Exactly 128 players are required" },
      { status: 400 }
    );
  }

  // Create/update all players
  const createdPlayers = await Promise.all(
    players.map(
      (p: { name: string; nationality?: string; seed?: number }, idx: number) =>
        prisma.player.create({
          data: {
            name: p.name,
            nationality: p.nationality ?? null,
            seed: p.seed && p.seed > 0 ? p.seed : null,
          },
        })
    )
  );

  // Create 64 R128 matches
  // Standard seeding: position 1 vs 128, 2 vs 127, etc.
  const matchData = [];
  for (let i = 0; i < 64; i++) {
    matchData.push({
      drawId,
      round: 1,
      position: i + 1,
      player1Id: createdPlayers[i].id,
      player2Id: createdPlayers[127 - i].id,
    });
  }

  // Also create placeholder matches for rounds 2-7
  let position = 1;
  for (let round = 2; round <= 7; round++) {
    const matchesInRound = 64 / Math.pow(2, round - 1);
    for (let pos = 1; pos <= matchesInRound; pos++) {
      matchData.push({ drawId, round, position: pos, player1Id: null, player2Id: null });
    }
    position = 1;
  }

  // Delete existing matches before inserting
  await prisma.match.deleteMany({ where: { drawId } });
  await prisma.match.createMany({ data: matchData });

  return NextResponse.json({ players: createdPlayers.length, matches: matchData.length });
}

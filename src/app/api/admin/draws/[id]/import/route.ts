import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchTournamentDraw, fetchMatchResults } from "@/lib/tennis-api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: { tournament: true },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  if (!process.env.SPORTRADAR_API_KEY) {
    return NextResponse.json(
      { error: "SPORTRADAR_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const drawData = await fetchTournamentDraw(
      draw.tournament.major,
      draw.gender,
      draw.tournament.year
    );

    // Upsert all players
    await Promise.all(
      drawData.players.map((p) =>
        prisma.player.upsert({
          where: { externalId: p.externalId },
          update: { name: p.name, nationality: p.nationality, seed: p.seed },
          create: {
            externalId: p.externalId,
            name: p.name,
            nationality: p.nationality,
            seed: p.seed,
          },
        })
      )
    );

    // Fetch players by externalId to get their DB ids
    const playerMap = new Map<string, string>();
    const players = await prisma.player.findMany({
      where: {
        externalId: { in: drawData.players.map((p) => p.externalId) },
      },
      select: { id: true, externalId: true },
    });
    players.forEach((p) => {
      if (p.externalId) playerMap.set(p.externalId, p.id);
    });

    // Upsert matches
    await Promise.all(
      drawData.matches.map((m) =>
        prisma.match.upsert({
          where: {
            drawId_round_position: {
              drawId,
              round: m.round,
              position: m.position,
            },
          },
          update: {
            player1Id: m.player1?.externalId
              ? (playerMap.get(m.player1.externalId) ?? null)
              : null,
            player2Id: m.player2?.externalId
              ? (playerMap.get(m.player2.externalId) ?? null)
              : null,
          },
          create: {
            drawId,
            round: m.round,
            position: m.position,
            player1Id: m.player1?.externalId
              ? (playerMap.get(m.player1.externalId) ?? null)
              : null,
            player2Id: m.player2?.externalId
              ? (playerMap.get(m.player2.externalId) ?? null)
              : null,
          },
        })
      )
    );

    return NextResponse.json({
      players: drawData.players.length,
      matches: drawData.matches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Sync match results from Sportradar
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: {
      tournament: true,
      matches: { select: { id: true, round: true, position: true, winnerId: true } },
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  try {
    const results = await fetchMatchResults(
      draw.tournament.major,
      draw.gender,
      draw.tournament.year
    );

    // Build a map of externalId -> DB player id
    const externalIds = results.map((r) => r.winnerExternalId);
    const playersInDb = await prisma.player.findMany({
      where: { externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    const playerMap = new Map(
      playersInDb.map((p) => [p.externalId!, p.id])
    );

    // Match DB matches by round+position
    const matchLookup = new Map(
      draw.matches.map((m) => [`${m.round}-${m.position}`, m])
    );

    // Sort results by round so we propagate players forward in order
    results.sort((a, b) => a.round - b.round || a.position - b.position);

    let updated = 0;
    for (const result of results) {
      const dbMatch = matchLookup.get(`${result.round}-${result.position}`);
      if (!dbMatch) continue;

      const winnerDbId = playerMap.get(result.winnerExternalId);
      if (!winnerDbId) continue;

      // Skip if already set to same winner
      if (dbMatch.winnerId === winnerDbId) continue;

      await prisma.match.update({
        where: { id: dbMatch.id },
        data: {
          winnerId: winnerDbId,
          completedAt: new Date(),
        },
      });

      // Propagate winner into next-round match slot
      const nextRound = result.round + 1;
      if (nextRound <= 7) {
        const nextPosition = Math.ceil(result.position / 2);
        const isFirstSlot = result.position % 2 !== 0;
        const nextKey = `${nextRound}-${nextPosition}`;
        const nextMatch = matchLookup.get(nextKey);
        if (nextMatch) {
          await prisma.match.update({
            where: { id: nextMatch.id },
            data: isFirstSlot ? { player1Id: winnerDbId } : { player2Id: winnerDbId },
          });
        }
      }

      // Mark picks as correct/incorrect
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

    return NextResponse.json({ synced: updated, total: results.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: {
      tournament: true,
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  return NextResponse.json(draw);
}

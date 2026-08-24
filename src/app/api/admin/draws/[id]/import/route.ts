import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchTournamentDraw } from "@/lib/tennis-api";
import { syncDrawResults } from "@/lib/sync-results";

// Importing a full draw now backfills nationality per-player (~128 calls,
// paced under the tennis API's rate limit) — well past the platform's
// default function timeout. Observed ~50s in testing; give it real headroom.
export const maxDuration = 120;

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

  if (!process.env.RAPIDAPI_KEY) {
    return NextResponse.json(
      { error: "RAPIDAPI_KEY not configured" },
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

// Sync match results from the tennis API
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: drawId } = await params;

  try {
    const result = await syncDrawResults(drawId);
    return NextResponse.json(result);
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

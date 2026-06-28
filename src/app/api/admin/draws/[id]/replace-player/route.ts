import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchSlotCompetitors } from "@/lib/tennis-api";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";

/**
 * Replace a withdrawn player with their lucky-loser replacement, in place.
 *
 * Updates the existing Player row (name, nationality, seed, externalId) so that
 * every submitted pick and the draw slot carry over to the new player untouched.
 * Reads the replacement from Sportradar's current draw slot.
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
  const { playerId } = await req.json();

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: { tournament: true },
  });
  if (!draw) {
    return NextResponse.json({ error: "Draw not found" }, { status: 404 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || !player.externalId) {
    return NextResponse.json(
      { error: "Player not found or has no external ID" },
      { status: 404 }
    );
  }

  // Find this player's first-round match to locate their draw slot
  const match = await prisma.match.findFirst({
    where: {
      drawId,
      round: 1,
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    include: { player1: true, player2: true },
  });
  if (!match) {
    return NextResponse.json(
      { error: "Could not find this player's first-round match" },
      { status: 404 }
    );
  }

  const opponent =
    match.player1Id === playerId ? match.player2 : match.player1;
  const opponentExternalId = opponent?.externalId ?? null;

  try {
    const competitors = await fetchSlotCompetitors(
      draw.tournament.major,
      draw.gender,
      draw.tournament.year,
      1,
      match.position
    );

    const stillThere = competitors.some(
      (c) => c.externalId === player.externalId
    );
    if (stillThere) {
      return NextResponse.json(
        {
          error: `Sportradar still shows ${player.name} in this slot — the lucky loser hasn't been published yet. Try again in a few hours.`,
        },
        { status: 409 }
      );
    }

    // Replacement = the competitor in the slot who isn't the opponent
    const replacement = competitors.find(
      (c) => c.externalId !== opponentExternalId
    );
    if (!replacement) {
      return NextResponse.json(
        { error: "Could not identify a replacement player in this slot." },
        { status: 422 }
      );
    }

    // Guard: don't collide with an existing different player row
    const clashing = await prisma.player.findUnique({
      where: { externalId: replacement.externalId },
    });
    if (clashing && clashing.id !== player.id) {
      return NextResponse.json(
        {
          error: `Replacement ${replacement.name} already exists as a separate player record. Manual cleanup needed.`,
        },
        { status: 409 }
      );
    }

    const oldName = player.name;
    await prisma.player.update({
      where: { id: player.id },
      data: {
        name: replacement.name,
        nationality: replacement.nationality,
        seed: replacement.seed,
        externalId: replacement.externalId,
      },
    });

    revalidateTournamentPages(draw.tournament.slug);

    return NextResponse.json({
      replaced: oldName,
      with: replacement.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replacement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

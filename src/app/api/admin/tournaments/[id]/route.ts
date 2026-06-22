import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";
import { TournamentStatus } from "@/generated/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, pointConfigs, upsetMultiplier } = body;

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status as TournamentStatus;
  }

  if (upsetMultiplier !== undefined) {
    updateData.upsetMultiplier = Number(upsetMultiplier);
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data: updateData,
    include: { pointConfigs: { orderBy: { round: "asc" } } },
  });

  // Update point configs if provided
  if (pointConfigs && Array.isArray(pointConfigs)) {
    await Promise.all(
      pointConfigs.map((pc: { round: number; points: number; label: string }) =>
        prisma.pointConfig.upsert({
          where: { tournamentId_round: { tournamentId: id, round: pc.round } },
          update: { points: pc.points, label: pc.label },
          create: { tournamentId: id, round: pc.round, points: pc.points, label: pc.label },
        })
      )
    );
  }

  revalidateTournamentPages(tournament.slug);

  return NextResponse.json(tournament);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tournament.delete({ where: { id } });

  revalidateTournamentPages(tournament.slug);

  return new NextResponse(null, { status: 204 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      draws: {
        include: {
          matches: {
            include: { player1: true, player2: true, winner: true },
            orderBy: [{ round: "asc" }, { position: "asc" }],
          },
        },
      },
      pointConfigs: { orderBy: { round: "asc" } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(tournament);
}

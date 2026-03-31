import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  const { status, pointConfigs } = body;

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status as TournamentStatus;
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

  return NextResponse.json(tournament);
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

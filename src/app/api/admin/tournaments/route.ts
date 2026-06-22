import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";
import { Major } from "@/generated/prisma/client";

const DEFAULT_POINT_CONFIGS = [
  { round: 1, label: "R128", points: 1 },
  { round: 2, label: "R64", points: 2 },
  { round: 3, label: "R32", points: 3 },
  { round: 4, label: "R16", points: 5 },
  { round: 5, label: "Quarterfinal", points: 8 },
  { round: 6, label: "Semifinal", points: 13 },
  { round: 7, label: "Final", points: 21 },
];

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ year: "desc" }, { startDate: "asc" }],
    include: {
      draws: { select: { id: true, gender: true } },
      pointConfigs: { orderBy: { round: "asc" } },
    },
  });
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, major, year, startDate, endDate, pointConfigs, upsetMultiplier } = body;

  if (!name || !major || !year || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = `${major.toLowerCase().replace(/_/g, "-")}-${year}`;

  const configs = pointConfigs ?? DEFAULT_POINT_CONFIGS;

  const tournament = await prisma.tournament.create({
    data: {
      name,
      slug,
      major: major as Major,
      year: Number(year),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      upsetMultiplier: upsetMultiplier !== undefined ? Number(upsetMultiplier) : 0.1,
      pointConfigs: {
        create: configs.map((c: { round: number; label: string; points: number }) => ({
          round: c.round,
          label: c.label,
          points: c.points,
        })),
      },
      draws: {
        create: [{ gender: "MENS" }, { gender: "WOMENS" }],
      },
    },
    include: {
      draws: true,
      pointConfigs: true,
    },
  });

  revalidateTournamentPages(tournament.slug);

  return NextResponse.json(tournament, { status: 201 });
}

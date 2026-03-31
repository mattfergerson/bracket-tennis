import { NextRequest, NextResponse } from "next/server";
import { getTournamentLeaderboard } from "@/lib/scoring";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;

  const leaderboard = await getTournamentLeaderboard(tournamentId);
  return NextResponse.json(leaderboard);
}

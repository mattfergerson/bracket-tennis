import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncDrawResults } from "@/lib/sync-results";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";

export const maxDuration = 60;

/**
 * Frequent results sync, decoupled from the once-daily digest. Keeps the
 * live bracket/leaderboard current through the day (see vercel.json for the
 * schedule) now that the tennis API's rate limit no longer forces this onto
 * a single daily run. syncDrawResults is a no-op for matches it's already
 * recorded, so this is safe to run often.
 *
 * This job only syncs results — it does not generate the digest. That's
 * handled solely by the /api/cron/daily-digest cron at 11:50pm PT, so "The
 * Daily Ace" only ever gets (re)generated once per day.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCron =
    !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const activeTournaments = await prisma.tournament.findMany({
    where: { status: "IN_PROGRESS" },
    select: {
      id: true,
      name: true,
      slug: true,
      draws: { select: { id: true } },
    },
  });

  if (activeTournaments.length === 0) {
    return NextResponse.json({ ran: false, reason: "No active tournaments" });
  }

  const results: Array<{ tournament: string; synced: number }> = [];

  for (const tournament of activeTournaments) {
    let totalSynced = 0;

    for (const draw of tournament.draws) {
      try {
        const r = await syncDrawResults(draw.id);
        totalSynced += r.synced;
      } catch (err) {
        console.error(`Sync failed for draw ${draw.id}:`, err);
      }
    }

    if (totalSynced > 0) {
      revalidateTournamentPages(tournament.slug);
    }

    results.push({ tournament: tournament.name, synced: totalSynced });
  }

  return NextResponse.json({ ran: true, results });
}

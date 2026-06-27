import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncDrawResults } from "@/lib/sync-results";
import { computeDigestData, ptDateOnly } from "@/lib/digest";
import { generateNarrative } from "@/lib/digest-narrative";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";
import { maybeAutoLock } from "@/lib/lock-tournament";

export const maxDuration = 300;

/**
 * Daily digest job. Runs nightly via Vercel cron, or on-demand by an admin.
 *
 * 1. Only runs for IN_PROGRESS tournaments (no API hits otherwise).
 * 2. Syncs results from Sportradar for each draw.
 * 3. Computes group-wide analytics + narrative and stores a DailyDigest +
 *    per-user DailySnapshot rows for today's PT date.
 */
export async function GET(req: NextRequest) {
  // Authorize: Vercel cron secret OR an authenticated admin (manual trigger)
  const authHeader = req.headers.get("authorization");
  const isCron =
    !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Auto-lock any ACCEPTING_PICKS tournaments whose cutoff has passed
  const duePicks = await prisma.tournament.findMany({
    where: { status: "ACCEPTING_PICKS", lockAt: { lte: new Date() } },
    select: { id: true, status: true, lockAt: true },
  });
  await Promise.all(duePicks.map((t) => maybeAutoLock(t)));

  const activeTournaments = await prisma.tournament.findMany({
    where: { status: "IN_PROGRESS" },
    select: { id: true, name: true, slug: true, draws: { select: { id: true } } },
  });

  if (activeTournaments.length === 0) {
    return NextResponse.json({ ran: false, reason: "No active tournaments" });
  }

  const results: Array<{ tournament: string; synced: number; digestDate: string }> = [];
  const today = ptDateOnly(new Date());

  for (const tournament of activeTournaments) {
    // 1. Sync results for each draw
    let totalSynced = 0;
    for (const draw of tournament.draws) {
      try {
        const r = await syncDrawResults(draw.id);
        totalSynced += r.synced;
      } catch (err) {
        console.error(`Sync failed for draw ${draw.id}:`, err);
      }
    }

    // 2. Compute analytics
    const data = await computeDigestData(tournament.id);

    // 3. Generate narrative
    const narrative = await generateNarrative(tournament.name, data);

    // 4. Persist digest + snapshots
    await prisma.dailyDigest.upsert({
      where: { tournamentId_date: { tournamentId: tournament.id, date: today } },
      update: { narrative, data: data as object },
      create: {
        tournamentId: tournament.id,
        date: today,
        narrative,
        data: data as object,
      },
    });

    await Promise.all(
      data.standings.map((s) =>
        prisma.dailySnapshot.upsert({
          where: {
            tournamentId_userId_date: {
              tournamentId: tournament.id,
              userId: s.userId,
              date: today,
            },
          },
          update: {
            score: s.score,
            rank: s.rank,
            maxPossibleScore: s.maxPossibleScore,
            correctPicks: s.correctPicks,
            pendingPicks: s.pendingPicks,
          },
          create: {
            tournamentId: tournament.id,
            userId: s.userId,
            date: today,
            score: s.score,
            rank: s.rank,
            maxPossibleScore: s.maxPossibleScore,
            correctPicks: s.correctPicks,
            pendingPicks: s.pendingPicks,
          },
        })
      )
    );

    revalidateTournamentPages(tournament.slug);

    results.push({
      tournament: tournament.name,
      synced: totalSynced,
      digestDate: today.toISOString().slice(0, 10),
    });
  }

  return NextResponse.json({ ran: true, results });
}

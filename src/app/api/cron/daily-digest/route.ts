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

  // Regeneration mode: ?date=YYYY-MM-DD recomputes/overwrites a past day's
  // digest + snapshots using current (corrected) data, WITHOUT re-syncing
  // results or burning API calls. Admin-only via the auth check above.
  const dateParam = req.nextUrl.searchParams.get("date");
  const regenerate = !!dateParam;
  let targetDate: Date;
  if (dateParam === "latest") {
    const latest = await prisma.dailyDigest.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!latest) {
      return NextResponse.json({ error: "No existing digest to regenerate" }, { status: 404 });
    }
    targetDate = latest.date;
  } else if (dateParam) {
    const [y, m, d] = dateParam.split("-").map(Number);
    if (!y || !m || !d) {
      return NextResponse.json({ error: "Invalid date (use YYYY-MM-DD or 'latest')" }, { status: 400 });
    }
    targetDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    targetDate = ptDateOnly(new Date());
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

  for (const tournament of activeTournaments) {
    // 1. Sync results for each draw (skipped when regenerating a past date)
    let totalSynced = 0;
    if (!regenerate) {
      for (const draw of tournament.draws) {
        try {
          const r = await syncDrawResults(draw.id);
          totalSynced += r.synced;
        } catch (err) {
          console.error(`Sync failed for draw ${draw.id}:`, err);
        }
        // Space out draws to respect Sportradar's 1 req/sec trial limit
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 2. Compute analytics as of the target date
    const data = await computeDigestData(tournament.id, targetDate);

    // 3. Generate narrative
    const narrative = await generateNarrative(tournament.name, data);

    // 4. Persist digest + snapshots
    await prisma.dailyDigest.upsert({
      where: { tournamentId_date: { tournamentId: tournament.id, date: targetDate } },
      update: { narrative, data: data as object },
      create: {
        tournamentId: tournament.id,
        date: targetDate,
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
              date: targetDate,
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
            date: targetDate,
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
      digestDate: targetDate.toISOString().slice(0, 10),
    });
  }

  return NextResponse.json({ ran: true, results });
}

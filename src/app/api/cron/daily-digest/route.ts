import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncDrawResults } from "@/lib/sync-results";
import { ptDateOnly } from "@/lib/digest";
import { generateAndPersistDigest } from "@/lib/run-digest";
import { maybeAutoLock } from "@/lib/lock-tournament";

export const maxDuration = 300;

/**
 * Fallback digest job. Runs via Vercel cron early the next morning (see
 * vercel.json), or on-demand by an admin.
 *
 * The /api/cron/sync-results cron already fires the digest the same night,
 * as soon as it detects a PT day's matches are all finished (see
 * lib/day-complete.ts). This job exists for the case where that event-driven
 * trigger never fires — a match with no published schedule, a stuck/never-
 * resolved block, etc. — so a digest always goes out even if the "smart"
 * path misses something. generateAndPersistDigest is an upsert, so running
 * it again here for a date the other cron already covered is harmless.
 *
 * 1. Only runs for IN_PROGRESS tournaments (no API hits otherwise).
 * 2. Syncs results from the tennis API for each draw.
 * 3. Computes group-wide analytics + narrative and stores a DailyDigest +
 *    per-user DailySnapshot rows for the target PT date.
 *
 * Timing: night-session matches (US Open, in ET) can run past 11pm PT, so
 * the cron fires at 6am PT and summarizes the PT day that just ended —
 * running same-evening would risk locking in a snapshot before the night's
 * matches finish. A manual admin trigger (no ?date=) still defaults to
 * today, matching the "what's happened so far today" intent of clicking the
 * button live.
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
  } else if (isCron) {
    // Cron runs the next morning — target the PT day that just ended.
    targetDate = ptDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));
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
      }
    }

    // 2-4. Compute analytics, generate narrative, persist digest + snapshots
    await generateAndPersistDigest(tournament, targetDate);

    results.push({
      tournament: tournament.name,
      synced: totalSynced,
      digestDate: targetDate.toISOString().slice(0, 10),
    });
  }

  return NextResponse.json({ ran: true, results });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncDrawResults } from "@/lib/sync-results";
import { fetchDrawSchedule, type ScheduledMatch } from "@/lib/tennis-api";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";
import { ptDateOnly } from "@/lib/digest";
import { isDayComplete } from "@/lib/day-complete";
import { generateAndPersistDigest } from "@/lib/run-digest";

export const maxDuration = 60;

/**
 * Frequent results sync, decoupled from the once-daily fallback digest.
 * Keeps the live bracket/leaderboard current through the day (see
 * vercel.json for the schedule) now that the tennis API's rate limit no
 * longer forces this onto a single daily run. syncDrawResults is a no-op
 * for matches it's already recorded, so this is safe to run often.
 *
 * Also the event-driven digest trigger: after syncing, if today's PT date
 * just became fully played out (every scheduled match finished, none in
 * progress — see lib/day-complete.ts) and something actually changed this
 * run, generate today's digest right away instead of waiting for the
 * once-daily fallback cron. Only checked when totalSynced > 0, so once a
 * day is done this doesn't re-fire every 15 minutes for nothing. If the
 * schedule can't be read for any draw this cycle, the check is skipped
 * entirely for that tournament — better to rely on the fallback than to
 * guess.
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
      major: true,
      year: true,
      draws: { select: { id: true, gender: true } },
    },
  });

  if (activeTournaments.length === 0) {
    return NextResponse.json({ ran: false, reason: "No active tournaments" });
  }

  const today = ptDateOnly(new Date());
  const results: Array<{ tournament: string; synced: number; digestTriggered: boolean }> = [];

  for (const tournament of activeTournaments) {
    let totalSynced = 0;
    const schedules: ScheduledMatch[][] = [];
    let scheduleReadFailed = false;

    for (const draw of tournament.draws) {
      try {
        const r = await syncDrawResults(draw.id);
        totalSynced += r.synced;
      } catch (err) {
        console.error(`Sync failed for draw ${draw.id}:`, err);
      }

      try {
        schedules.push(
          await fetchDrawSchedule(tournament.major, draw.gender, tournament.year)
        );
      } catch (err) {
        console.error(`Schedule fetch failed for draw ${draw.id}:`, err);
        scheduleReadFailed = true;
      }
    }

    let digestTriggered = false;
    if (totalSynced > 0) {
      revalidateTournamentPages(tournament.slug);

      if (!scheduleReadFailed && isDayComplete(schedules, today)) {
        await generateAndPersistDigest(tournament, today);
        digestTriggered = true;
      }
    }

    results.push({ tournament: tournament.name, synced: totalSynced, digestTriggered });
  }

  return NextResponse.json({ ran: true, results });
}

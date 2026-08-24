import { prisma } from "@/lib/prisma";
import { computeDigestData } from "@/lib/digest";
import { generateNarrative } from "@/lib/digest-narrative";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";

/**
 * Compute, narrate, and persist a tournament's digest (DailyDigest +
 * per-user DailySnapshot rows) for one PT date. Shared by the once-daily
 * fallback cron and the event-driven same-night trigger — both just decide
 * *when* a date is ready to summarize, then call this the same way. Safe to
 * call more than once for the same date (upserts throughout).
 */
export async function generateAndPersistDigest(
  tournament: { id: string; name: string; slug: string },
  targetDate: Date
): Promise<void> {
  const data = await computeDigestData(tournament.id, targetDate);
  const narrative = await generateNarrative(tournament.name, data);

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
}

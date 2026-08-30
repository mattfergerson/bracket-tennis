import { prisma } from "@/lib/prisma";
import { computeDigestData } from "@/lib/digest";
import { generateNarrative } from "@/lib/digest-narrative";
import { revalidateTournamentPages } from "@/lib/revalidate-tournaments";

/**
 * Compute, narrate, and persist a tournament's digest (DailyDigest +
 * per-user DailySnapshot rows) for one PT date. Called once daily by the
 * 11:50pm PT cron (or on-demand by an admin, e.g. to regenerate a past
 * date). Safe to call more than once for the same date (upserts throughout).
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

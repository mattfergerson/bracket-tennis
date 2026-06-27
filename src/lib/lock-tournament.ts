import { prisma } from "@/lib/prisma";
import { TournamentStatus } from "@/generated/prisma/client";

/**
 * True if picks are closed for a tournament — either it has advanced past
 * ACCEPTING_PICKS, or its lockAt cutoff has passed.
 */
export function arePicksLocked(t: {
  status: TournamentStatus;
  lockAt: Date | null;
}): boolean {
  if (t.status !== "ACCEPTING_PICKS") return true;
  if (t.lockAt && t.lockAt.getTime() <= Date.now()) return true;
  return false;
}

/**
 * If a tournament is ACCEPTING_PICKS and its lockAt has passed, promote it to
 * IN_PROGRESS. Lazy auto-lock: called on page loads and from the cron, so the
 * status flips shortly after the cutoff without needing a high-frequency cron.
 * Returns the (possibly updated) status.
 */
export async function maybeAutoLock(t: {
  id: string;
  status: TournamentStatus;
  lockAt: Date | null;
}): Promise<TournamentStatus> {
  if (
    t.status === "ACCEPTING_PICKS" &&
    t.lockAt &&
    t.lockAt.getTime() <= Date.now()
  ) {
    await prisma.tournament.update({
      where: { id: t.id },
      data: { status: "IN_PROGRESS" },
    });
    return "IN_PROGRESS";
  }
  return t.status;
}

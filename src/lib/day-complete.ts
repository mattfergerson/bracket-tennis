import type { ScheduledMatch } from "@/lib/tennis-api";
import { ptDateOnly } from "@/lib/digest";

/**
 * True if every match scheduled for the given PT date, across the provided
 * draws, has finished with none currently in progress. Matches with no
 * scheduled time (data gap) are ignored rather than treated as blocking —
 * the 6am fallback digest run covers the case where that causes a day to
 * be (wrongly) declared complete too early.
 */
export function isDayComplete(schedulesByDraw: ScheduledMatch[][], ptDate: Date): boolean {
  const target = ptDate.getTime();

  for (const schedule of schedulesByDraw) {
    for (const match of schedule) {
      if (!match.scheduledAt) continue;
      if (ptDateOnly(match.scheduledAt).getTime() !== target) continue;
      if (!match.finished || match.inProgress) return false;
    }
  }

  return true;
}

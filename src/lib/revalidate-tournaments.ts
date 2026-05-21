import { revalidatePath } from "next/cache";

/** Bust cached tournament listings after admin mutations. */
export function revalidateTournamentPages(slug?: string) {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/leaderboard");
  if (slug) {
    revalidatePath(`/tournaments/${slug}`);
  }
}

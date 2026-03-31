import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Gender } from "@/generated/prisma/client";
import { GENDER_LABELS } from "@/lib/constants";
import { BracketPicksClient } from "@/components/bracket/bracket-picks-client";

export default async function PicksPage({
  params,
}: {
  params: Promise<{ slug: string; gender: string }>;
}) {
  const { slug, gender: genderParam } = await params;
  const gender = genderParam.toUpperCase() as Gender;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=/tournaments/${slug}/picks/${genderParam}`);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      draws: {
        where: { gender },
        include: {
          matches: {
            include: { player1: true, player2: true, winner: true },
            orderBy: [{ round: "asc" }, { position: "asc" }],
          },
        },
      },
      pointConfigs: { orderBy: { round: "asc" } },
    },
  });

  if (!tournament) notFound();

  const draw = tournament.draws[0];
  if (!draw) notFound();

  if (tournament.status === "UPCOMING") {
    redirect(`/tournaments/${slug}`);
  }

  // Get user's existing picks
  const bracket = await prisma.bracket.findUnique({
    where: { userId_drawId: { userId: session.user.id, drawId: draw.id } },
    include: { picks: true },
  });

  const existingPicks: Record<string, string> = {};
  if (bracket) {
    for (const pick of bracket.picks) {
      existingPicks[pick.matchId] = pick.pickedPlayerId;
    }
  }

  const isLocked =
    tournament.status === "IN_PROGRESS" || tournament.status === "COMPLETED";

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {tournament.name} — {GENDER_LABELS[gender]} Bracket
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isLocked
            ? bracket
              ? "Your picks are locked in. Results will update as matches are played."
              : "Picks are now locked."
            : "Click a player to pick them to win each match. Picks cascade forward automatically."}
        </p>
      </div>

      <BracketPicksClient
        tournamentId={tournament.id}
        gender={genderParam}
        matches={draw.matches as Parameters<typeof BracketPicksClient>[0]["matches"]}
        initialPicks={existingPicks}
        isLocked={isLocked}
        pointConfigs={tournament.pointConfigs}
      />
    </div>
  );
}

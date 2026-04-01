import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { GENDER_LABELS, ROUND_NAMES } from "@/lib/constants";
import { DrawImportButton } from "@/components/admin/draw-import-button";
import { MatchResultEntry } from "@/components/admin/match-result-entry";
import { ManualPlayerEntry } from "@/components/admin/manual-player-entry";
import { ResetDrawButton } from "@/components/admin/reset-draw-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminDrawPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: drawId } = await params;

  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: {
      tournament: true,
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!draw) notFound();

  const hasMatches = draw.matches.length > 0;
  const hasApiKey = !!process.env.SPORTS_API_KEY;

  // Group matches by round
  const matchesByRound = new Map<number, typeof draw.matches>();
  for (const match of draw.matches) {
    if (!matchesByRound.has(match.round)) {
      matchesByRound.set(match.round, []);
    }
    matchesByRound.get(match.round)!.push(match);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/tournaments/${draw.tournamentId}`}>
            <ChevronLeft className="h-4 w-4" />
            {draw.tournament.name}
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {GENDER_LABELS[draw.gender]} Draw
          </h1>
          <p className="text-muted-foreground">{draw.tournament.name}</p>
        </div>
        <div className="flex gap-2">
          {hasApiKey && (
            <DrawImportButton drawId={drawId} />
          )}
          {!hasMatches && (
            <ManualPlayerEntry drawId={drawId} />
          )}
          {hasMatches && (
            <ResetDrawButton drawId={drawId} />
          )}
        </div>
      </div>

      {!hasMatches ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              No players or matches yet. Import from the tennis API or enter players manually.
            </p>
            {!hasApiKey && (
              <p className="text-sm text-muted-foreground mt-2">
                To use the API, add your <code>SPORTS_API_KEY</code> to the .env file.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(matchesByRound.entries()).map(([round, matches]) => (
            <Card key={round}>
              <CardHeader>
                <CardTitle className="text-base">
                  Round {round} — {ROUND_NAMES[round]}
                </CardTitle>
                <CardDescription>
                  {matches.filter((m) => m.winnerId).length} / {matches.length} matches completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {matches.map((match) => (
                    <MatchResultEntry key={match.id} match={match} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

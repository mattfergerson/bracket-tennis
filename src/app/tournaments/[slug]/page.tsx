import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trophy,
  Calendar,
  Medal,
  ChevronRight,
} from "lucide-react";
import {
  MAJOR_LABELS,
  MAJOR_LOCATION,
  MAJOR_SURFACE,
  MAJOR_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  GENDER_LABELS,
} from "@/lib/constants";
import { getTournamentLeaderboard } from "@/lib/scoring";
import { BracketView } from "@/components/bracket/bracket-view";
import { cn } from "@/lib/utils";
import { Gender } from "@/generated/prisma/client";

export const revalidate = 60;

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      draws: {
        include: {
          matches: {
            include: { player1: true, player2: true, winner: true },
            orderBy: [{ round: "asc" }, { position: "asc" }],
          },
          _count: { select: { brackets: true } },
        },
      },
      pointConfigs: { orderBy: { round: "asc" } },
    },
  });

  if (!tournament) notFound();

  const leaderboard = await getTournamentLeaderboard(tournament.id);

  // Get user's picks for each draw
  let userPicksByDraw: Record<string, Record<string, string>> = {};
  if (session?.user?.id) {
    for (const draw of tournament.draws) {
      const bracket = await prisma.bracket.findUnique({
        where: { userId_drawId: { userId: session.user.id, drawId: draw.id } },
        include: { picks: true },
      });
      if (bracket) {
        const picks: Record<string, string> = {};
        for (const pick of bracket.picks) {
          picks[pick.matchId] = pick.pickedPlayerId;
        }
        userPicksByDraw[draw.id] = picks;
      }
    }
  }

  const isPickable = tournament.status === "ACCEPTING_PICKS";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div
          className={cn(
            "inline-block w-full h-1 rounded-full mb-4",
            MAJOR_COLORS[tournament.major]
          )}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span>{MAJOR_LOCATION[tournament.major]}</span>
              <span>·</span>
              <span>{MAJOR_SURFACE[tournament.major]} court</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(tournament.startDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <Badge className={STATUS_COLORS[tournament.status]}>
            {STATUS_LABELS[tournament.status]}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          {tournament.draws.map((draw) => (
            <TabsTrigger key={draw.id} value={`bracket-${draw.gender}`}>
              {GENDER_LABELS[draw.gender]} Bracket
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No brackets submitted yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry.userId}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 rounded-lg border",
                        entry.userId === session?.user?.id &&
                          "border-primary/50 bg-primary/5"
                      )}
                    >
                      <div className="w-8 text-center">
                        {idx === 0 && <Medal className="h-5 w-5 text-yellow-500 mx-auto" />}
                        {idx === 1 && <Medal className="h-5 w-5 text-slate-400 mx-auto" />}
                        {idx === 2 && <Medal className="h-5 w-5 text-amber-600 mx-auto" />}
                        {idx > 2 && (
                          <span className="text-sm text-muted-foreground">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {entry.username}
                          {entry.userId === session?.user?.id && (
                            <span className="ml-2 text-xs text-primary font-normal">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.correctPicks} correct · {entry.pendingPicks} pending
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{entry.score}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bracket Tabs */}
        {tournament.draws.map((draw) => (
          <TabsContent key={draw.id} value={`bracket-${draw.gender}`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {draw._count.brackets} brackets submitted
              </p>
              {(isPickable || tournament.status !== "UPCOMING") && (
                <Button asChild size="sm">
                  <Link href={`/tournaments/${slug}/picks/${draw.gender.toLowerCase()}`}>
                    {userPicksByDraw[draw.id]
                      ? "View / Edit My Picks"
                      : isPickable
                      ? "Submit My Bracket"
                      : "View My Bracket"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>

            {draw.matches.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                  Draw not yet published
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <BracketView
                  matches={draw.matches as Parameters<typeof BracketView>[0]["matches"]}
                  initialPicks={userPicksByDraw[draw.id] ?? {}}
                  isReadOnly={true}
                  pointConfigs={tournament.pointConfigs}
                />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

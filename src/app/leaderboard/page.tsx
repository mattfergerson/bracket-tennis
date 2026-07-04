import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getTournamentLeaderboard } from "@/lib/scoring";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal } from "lucide-react";
import { MAJOR_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const session = await auth();

  let tournaments: Awaited<ReturnType<typeof prisma.tournament.findMany>> = [];
  try {
    tournaments = await prisma.tournament.findMany({
      where: { status: { in: ["IN_PROGRESS", "COMPLETED", "ACCEPTING_PICKS"] } },
      orderBy: [{ year: "desc" }, { startDate: "asc" }],
    });
  } catch {
    // DB not configured
  }

  if (tournaments.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">No active tournaments yet.</p>
      </div>
    );
  }

  const leaderboards = await Promise.all(
    tournaments.map(async (t) => ({
      tournament: t,
      entries: await getTournamentLeaderboard(t.id),
    }))
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Trophy className="h-8 w-8 text-yellow-500" />
        Leaderboard
      </h1>

      <Tabs defaultValue={tournaments[0].id}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          {tournaments.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {MAJOR_LABELS[t.major]} {t.year}
            </TabsTrigger>
          ))}
        </TabsList>

        {leaderboards.map(({ tournament, entries }) => (
          <TabsContent key={tournament.id} value={tournament.id}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {tournament.name} Standings
                  </CardTitle>
                  <Badge className={STATUS_COLORS[tournament.status]}>
                    {STATUS_LABELS[tournament.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {entries.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No brackets submitted yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, idx) => (
                      <LeaderboardRow
                        key={entry.userId}
                        rank={idx + 1}
                        entry={entry}
                        isCurrentUser={entry.userId === session?.user?.id}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

type LeaderboardRowProps = {
  rank: number;
  entry: {
    userId: string;
    username: string;
    score: number;
    correctPicks: number;
    totalPicks: number;
    pendingPicks: number;
  };
  isCurrentUser: boolean;
};

function LeaderboardRow({ rank, entry, isCurrentUser }: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors",
        isCurrentUser && "border-primary/50 bg-primary/5",
        !isCurrentUser && "hover:bg-muted/50"
      )}
    >
      <div className="w-8 text-center">
        {rank === 1 && <Medal className="h-5 w-5 text-yellow-500 mx-auto" />}
        {rank === 2 && <Medal className="h-5 w-5 text-slate-400 mx-auto" />}
        {rank === 3 && <Medal className="h-5 w-5 text-amber-600 mx-auto" />}
        {rank > 3 && (
          <span className="text-sm font-medium text-muted-foreground">{rank}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {entry.username}
          {isCurrentUser && (
            <span className="ml-2 text-xs text-primary font-normal">(you)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {entry.correctPicks} correct · {entry.pendingPicks} alive
        </p>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold">{entry.score}</p>
        <p className="text-xs text-muted-foreground">pts</p>
      </div>
    </div>
  );
}

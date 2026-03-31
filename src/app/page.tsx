import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, ChevronRight, Users } from "lucide-react";
import {
  MAJOR_LABELS,
  MAJOR_SURFACE,
  MAJOR_LOCATION,
  MAJOR_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  GENDER_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Gender } from "@/generated/prisma/client";

export const revalidate = 60;

type TournamentWithDraws = Awaited<ReturnType<typeof prisma.tournament.findMany>>[number] & {
  draws: Array<{ id: string; gender: Gender; _count: { brackets: number } }>;
};

export default async function HomePage() {
  const session = await auth();

  let tournaments: TournamentWithDraws[] = [];
  let userBrackets: Record<string, boolean> = {};
  let dbError = false;

  try {
    tournaments = (await prisma.tournament.findMany({
      orderBy: [{ year: "desc" }, { startDate: "asc" }],
      include: {
        draws: {
          include: {
            _count: { select: { brackets: true } },
          },
        },
      },
    })) as TournamentWithDraws[];

    if (session?.user?.id) {
      const brackets = await prisma.bracket.findMany({
        where: { userId: session.user.id },
        select: { drawId: true },
      });
      brackets.forEach((b) => {
        userBrackets[b.drawId] = true;
      });
    }
  } catch {
    dbError = true;
  }

  const groupedByYear = new Map<number, TournamentWithDraws[]>();
  for (const t of tournaments) {
    if (!groupedByYear.has(t.year)) groupedByYear.set(t.year, []);
    groupedByYear.get(t.year)!.push(t);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white px-4">
        <Trophy className="h-16 w-16 text-yellow-400 mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-3">Slam Bracket</h1>
        <p className="text-slate-400 mb-10 text-lg">Private tennis bracket challenge</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" asChild className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-8">
            <Link href="/auth/signin">Sign In</Link>
          </Button>
          <Button size="lg" variant="ghost" asChild className="border border-white/40 text-white hover:bg-white/10 hover:text-white">
            <Link href="/auth/request-access">Request an Account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Hero */}
      <section className="py-16 px-4 text-center text-white">
        <div className="flex justify-center mb-4">
          <Trophy className="h-16 w-16 text-yellow-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Slam Bracket</h1>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
          Pick your winners for every match in all four Grand Slam tournaments.
          Compete with friends on the leaderboard.
        </p>
      </section>

      {/* Tournaments */}
      <section className="bg-background rounded-t-3xl min-h-screen px-4 py-10">
        <div className="container mx-auto max-w-5xl">
          {dbError && (
            <div className="mb-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
              <strong>Database not configured.</strong> Add your{" "}
              <code>DATABASE_URL</code> to <code>.env</code> and run{" "}
              <code>npx prisma migrate dev</code> to get started.
            </div>
          )}

          {tournaments.length === 0 ? (
            <div className="text-center py-16">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                {dbError
                  ? "Connect a database to get started."
                  : "No tournaments set up yet. Check back soon!"}
              </p>
              {session?.user?.role === "ADMIN" && !dbError && (
                <Button className="mt-4" asChild>
                  <Link href="/admin/tournaments/new">
                    Create First Tournament
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            Array.from(groupedByYear.entries()).map(([year, yearTournaments]) => (
              <div key={year} className="mb-10">
                <h2 className="text-2xl font-bold mb-4">{year} Season</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {yearTournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      userBrackets={userBrackets}
                      isLoggedIn={!!session}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TournamentCard({
  tournament,
  userBrackets,
  isLoggedIn,
}: {
  tournament: TournamentWithDraws;
  userBrackets: Record<string, boolean>;
  isLoggedIn: boolean;
}) {
  const colorClass = MAJOR_COLORS[tournament.major];
  const totalParticipants = Math.max(
    ...tournament.draws.map((d) => d._count.brackets),
    0
  );

  const isOpen = tournament.status === "ACCEPTING_PICKS";
  const isActive = tournament.status === "IN_PROGRESS" || isOpen;

  return (
    <Card className={cn("overflow-hidden", isActive && "ring-2 ring-primary/30")}>
      <div className={cn("h-2 w-full", colorClass)} />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{tournament.name}</CardTitle>
          <Badge className={cn("shrink-0", STATUS_COLORS[tournament.status])}>
            {STATUS_LABELS[tournament.status]}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-4 text-xs">
          <span>{MAJOR_LOCATION[tournament.major]}</span>
          <span className="px-1.5 py-0.5 rounded bg-muted">{MAJOR_SURFACE[tournament.major]}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {new Date(tournament.startDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {new Date(tournament.endDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          {totalParticipants > 0 && (
            <>
              <span className="text-border">·</span>
              <Users className="h-3.5 w-3.5" />
              <span>{totalParticipants} entries</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {tournament.draws.map((draw) => {
            const hasPick = userBrackets[draw.id];
            return (
              <Link
                key={draw.id}
                href={`/tournaments/${tournament.slug}/picks/${draw.gender.toLowerCase()}`}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors",
                  isOpen && !hasPick && "border-primary bg-primary/5 hover:bg-primary/10",
                  hasPick && "border-green-200 bg-green-50 hover:bg-green-100 text-green-800",
                  !isOpen && !hasPick && "border-muted hover:bg-muted/50"
                )}
              >
                <span className="font-medium">{GENDER_LABELS[draw.gender]}</span>
                <span className="text-xs">
                  {hasPick ? "✓ Picked" : isOpen ? "Pick now" : "View"}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href={`/tournaments/${tournament.slug}`}>
            View Tournament
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

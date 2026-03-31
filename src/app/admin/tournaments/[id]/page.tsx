import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Users, Trophy } from "lucide-react";
import {
  MAJOR_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  GENDER_LABELS,
} from "@/lib/constants";
import { TournamentStatusControl } from "@/components/admin/tournament-status-control";
import { PointConfigEditor } from "@/components/admin/point-config-editor";

export default async function AdminTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      draws: {
        include: {
          _count: { select: { matches: true, brackets: true } },
        },
      },
      pointConfigs: { orderBy: { round: "asc" } },
    },
  });

  if (!tournament) notFound();

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ChevronLeft className="h-4 w-4" />
            Admin
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-muted-foreground">{MAJOR_LABELS[tournament.major]}</p>
        </div>
        <Badge className={STATUS_COLORS[tournament.status]}>
          {STATUS_LABELS[tournament.status]}
        </Badge>
      </div>

      <div className="space-y-6">
        <TournamentStatusControl
          tournamentId={tournament.id}
          currentStatus={tournament.status}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Draws
            </CardTitle>
            <CardDescription>
              Manage players and match results for each bracket
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {tournament.draws.map((draw) => (
                <div
                  key={draw.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{GENDER_LABELS[draw.gender]} Draw</p>
                    <p className="text-sm text-muted-foreground">
                      {draw._count.matches} matches · {draw._count.brackets} brackets submitted
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/draws/${draw.id}`}>
                        <Trophy className="h-3 w-3 mr-1" />
                        Manage Draw
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <PointConfigEditor
          tournamentId={tournament.id}
          pointConfigs={tournament.pointConfigs}
        />
      </div>
    </div>
  );
}

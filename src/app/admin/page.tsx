import Link from "next/link";
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
import { Inbox, Plus, Settings, Trophy } from "lucide-react";
import { MAJOR_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

export default async function AdminPage() {
  const [tournaments, pendingRequests] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: [{ year: "desc" }, { startDate: "asc" }],
      include: {
        draws: { select: { id: true, gender: true } },
        _count: { select: { draws: true } },
      },
    }),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage tournaments, draws, and results</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/requests" className="relative">
              <Inbox className="h-4 w-4 mr-2" />
              Access Requests
              {pendingRequests > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-500 text-black text-xs font-bold">
                  {pendingRequests}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/tournaments/new">
              <Plus className="h-4 w-4 mr-2" />
              New Tournament
            </Link>
          </Button>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">No tournaments yet.</p>
            <Button className="mt-4" asChild>
              <Link href="/admin/tournaments/new">
                <Plus className="h-4 w-4 mr-2" />
                Create your first tournament
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  <Badge className={STATUS_COLORS[t.status]}>
                    {STATUS_LABELS[t.status]}
                  </Badge>
                </div>
                <CardDescription>{MAJOR_LABELS[t.major]}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  <span>
                    {new Date(t.startDate).toLocaleDateString()} –{" "}
                    {new Date(t.endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild className="flex-1">
                    <Link href={`/admin/tournaments/${t.id}`}>
                      <Settings className="h-3 w-3 mr-1" />
                      Manage
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

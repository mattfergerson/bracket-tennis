"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchResultEntry } from "@/components/admin/match-result-entry";
import { GENDER_LABELS, ROUND_NAMES } from "@/lib/constants";

type Player = {
  id: string;
  name: string;
  seed?: number | null;
  nationality?: string | null;
};

type Match = {
  id: string;
  round: number;
  position: number;
  player1: Player | null;
  player2: Player | null;
  winner: Player | null;
  winnerId: string | null;
};

type Draw = {
  id: string;
  gender: "MENS" | "WOMENS";
  matches: Match[];
};

export function MatchResultsSection({ draws }: { draws: Draw[] }) {
  const [activeTab, setActiveTab] = useState(draws[0]?.id ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Match Results</CardTitle>
        <CardDescription>
          Record results for each match as they are completed
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {draws.map((draw) => (
              <TabsTrigger key={draw.id} value={draw.id}>
                {GENDER_LABELS[draw.gender]}
              </TabsTrigger>
            ))}
          </TabsList>

          {draws.map((draw) => {
            const matchesByRound = new Map<number, Match[]>();
            for (const match of draw.matches) {
              if (!matchesByRound.has(match.round)) {
                matchesByRound.set(match.round, []);
              }
              matchesByRound.get(match.round)!.push(match);
            }

            const completedTotal = draw.matches.filter((m) => m.winnerId).length;

            return (
              <TabsContent key={draw.id} value={draw.id}>
                {draw.matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No matches yet. Add players to this draw first.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {completedTotal} / {draw.matches.length} matches completed
                    </p>
                    {Array.from(matchesByRound.entries()).map(([round, matches]) => (
                      <div key={round}>
                        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                          Round {round} — {ROUND_NAMES[round]}
                          <span className="ml-2 font-normal">
                            ({matches.filter((m) => m.winnerId).length}/{matches.length})
                          </span>
                        </h4>
                        <div className="space-y-1.5">
                          {matches.map((match) => (
                            <MatchResultEntry key={match.id} match={match} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

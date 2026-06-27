"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Star,
  Trophy,
} from "lucide-react";
import type { DigestData } from "@/lib/digest";

type DigestRecord = {
  date: string; // ISO date
  narrative: string;
  data: DigestData;
};

export function DailyDigestView({ digests }: { digests: DigestRecord[] }) {
  const [selectedDate, setSelectedDate] = useState(digests[0]?.date);
  const digest = digests.find((d) => d.date === selectedDate) ?? digests[0];

  if (!digest) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No digest yet — check back after the first day of play.
      </p>
    );
  }

  const data = digest.data;
  const dateLabel = new Date(digest.date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );

  return (
    <div className="space-y-4">
      {/* Date selector */}
      {digests.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {digests.map((d) => {
            const label = new Date(d.date + "T12:00:00").toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" }
            );
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={cn(
                  "px-3 py-1 rounded-md text-sm transition-colors",
                  d.date === digest.date
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Narrative story */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            The Daily Ace — {dateLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[15px] leading-relaxed">{digest.narrative}</p>
        </CardContent>
      </Card>

      {/* Player of the day + matches */}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.playerOfTheDay && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Star className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Player of the Day</p>
                <p className="font-bold">{data.playerOfTheDay.username}</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  +{data.playerOfTheDay.scoreDelta} pts
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Flame className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Matches Decided</p>
              <p className="font-bold">{data.matchesCompletedToday}</p>
              <p className="text-sm text-muted-foreground">
                {data.notableUpsets.length} upset
                {data.notableUpsets.length === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Standings movement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Standings Movement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {data.standings.map((s) => (
              <div
                key={s.userId}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border"
              >
                <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                  {s.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {s.username}
                    {!s.stillInContention && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (eliminated)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    max possible {s.maxPossibleScore}
                  </p>
                </div>
                <RankChange change={s.rankChange} />
                <div className="text-right w-16">
                  <p className="font-bold">{s.score}</p>
                  {s.scoreDelta > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      +{s.scoreDelta}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notable upsets */}
      {data.notableUpsets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notable Upsets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.notableUpsets.map((u, i) => (
                <div key={i} className="text-sm border-l-2 border-orange-400 pl-3">
                  <p>
                    <span className="font-semibold">{u.winnerName}</span>
                    {u.winnerSeed ? ` (${u.winnerSeed})` : " (unseeded)"} def.{" "}
                    <span className="line-through opacity-70">{u.loserName}</span>
                    {u.loserSeed ? ` (${u.loserSeed})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.calledBy.length > 0
                      ? `Called by ${u.calledBy.join(", ")}`
                      : "Nobody called it"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical players */}
      {data.criticalPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Players to Watch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.criticalPlayers.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border text-sm"
                >
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {c.gender === "MENS" ? "M" : "W"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{c.pointsRiding} pts</span>
                    <span className="text-xs text-muted-foreground block">
                      {c.backers} backer{c.backers === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Champions still alive */}
      {data.champions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Champion Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {data.champions.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm px-3 py-1.5"
                >
                  <span className="text-muted-foreground">
                    {c.username} ({c.gender === "MENS" ? "M" : "W"})
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      c.alive
                        ? "text-foreground"
                        : "text-muted-foreground line-through"
                    )}
                  >
                    {c.playerName ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RankChange({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
        <TrendingUp className="h-3 w-3" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-red-500 dark:text-red-400">
        <TrendingDown className="h-3 w-3" />
        {-change}
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

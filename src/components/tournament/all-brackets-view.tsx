"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BracketView } from "@/components/bracket/bracket-view";
import { GENDER_LABELS } from "@/lib/constants";

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

type PointConfig = { round: number; points: number };

type PlayerBracket = {
  userId: string;
  username: string;
  score: number;
  rank: number;
  picksByDraw: Record<string, Record<string, string>>; // drawId -> matchId -> pickedPlayerId
};

type DrawInfo = {
  id: string;
  gender: "MENS" | "WOMENS";
  matches: Match[];
};

type AllBracketsViewProps = {
  draws: DrawInfo[];
  players: PlayerBracket[];
  pointConfigs: PointConfig[];
  upsetMultiplier: number;
  currentUserId?: string;
};

export function AllBracketsView({
  draws,
  players,
  pointConfigs,
  upsetMultiplier,
  currentUserId,
}: AllBracketsViewProps) {
  const defaultUser =
    players.find((p) => p.userId === currentUserId)?.userId ??
    players[0]?.userId;
  const [selectedUserId, setSelectedUserId] = useState(defaultUser);
  const [selectedGender, setSelectedGender] = useState<"MENS" | "WOMENS">(
    draws[0]?.gender ?? "MENS"
  );

  const selectedPlayer = players.find((p) => p.userId === selectedUserId);
  const selectedDraw = draws.find((d) => d.gender === selectedGender);

  if (players.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No brackets submitted yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Player selector */}
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <button
            key={p.userId}
            onClick={() => setSelectedUserId(p.userId)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
              p.userId === selectedUserId
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            )}
          >
            <span className="font-medium">{p.username}</span>
            {p.userId === currentUserId && (
              <span className="text-xs opacity-70">(you)</span>
            )}
            <span
              className={cn(
                "text-xs",
                p.userId === selectedUserId
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground"
              )}
            >
              {p.score} pts
            </span>
          </button>
        ))}
      </div>

      {/* Gender toggle */}
      {draws.length > 1 && (
        <div className="flex gap-1">
          {draws.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedGender(d.gender)}
              className={cn(
                "px-3 py-1 rounded-md text-sm transition-colors",
                d.gender === selectedGender
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {GENDER_LABELS[d.gender]}
            </button>
          ))}
        </div>
      )}

      {/* Selected bracket */}
      {selectedDraw && selectedPlayer ? (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 border-b text-sm">
            <span className="font-semibold">{selectedPlayer.username}</span>
            <span className="text-muted-foreground">
              {" "}
              — {GENDER_LABELS[selectedGender]} Bracket
            </span>
          </div>
          <BracketView
            key={`${selectedUserId}-${selectedGender}`}
            matches={selectedDraw.matches}
            initialPicks={selectedPlayer.picksByDraw[selectedDraw.id] ?? {}}
            isReadOnly={true}
            pointConfigs={pointConfigs}
            upsetMultiplier={upsetMultiplier}
          />
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          No bracket to show.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BracketView } from "@/components/bracket/bracket-view";
import { toast } from "sonner";
import { Save, Lock, Trophy } from "lucide-react";
import { ROUND_NAMES } from "@/lib/constants";

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

type PointConfig = {
  round: number;
  label: string;
  points: number;
};

type BracketPicksClientProps = {
  tournamentId: string;
  gender: string;
  matches: Match[];
  initialPicks: Record<string, string>;
  isLocked: boolean;
  pointConfigs: PointConfig[];
};

export function BracketPicksClient({
  tournamentId,
  gender,
  matches,
  initialPicks,
  isLocked,
  pointConfigs,
}: BracketPicksClientProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const totalMatches = matches.length;
  const pickedCount = Object.keys(picks).length;

  const handlePicksChange = useCallback((newPicks: Record<string, string>) => {
    setPicks(newPicks);
  }, []);

  async function savePicks() {
    setSaving(true);
    const picksArray = Object.entries(picks).map(([matchId, pickedPlayerId]) => ({
      matchId,
      pickedPlayerId,
    }));

    const res = await fetch(`/api/tournaments/${tournamentId}/picks/${gender}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: picksArray }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to save picks");
    } else {
      setLastSaved(new Date());
      toast.success(`Saved ${picksArray.length} picks`);
    }
  }

  // Calculate potential score
  const potentialScore = Object.entries(picks).reduce((total, [matchId, playerId]) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !match.winnerId) return total;
    if (match.winnerId === playerId) {
      const config = pointConfigs.find((p) => p.round === match.round);
      return total + (config?.points ?? 0);
    }
    return total;
  }, 0);

  const completedMatches = matches.filter((m) => m.winnerId).length;

  return (
    <div className="space-y-4">
      {/* Header bar with stats and save button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border bg-card">
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Picks: </span>
            <span className="font-semibold">
              {pickedCount} / {totalMatches}
            </span>
          </div>
          {completedMatches > 0 && (
            <div>
              <span className="text-muted-foreground">Score: </span>
              <span className="font-semibold text-primary">{potentialScore} pts</span>
            </div>
          )}
          <div className="hidden sm:flex flex-wrap gap-1">
            {pointConfigs.map((pc) => (
              <Badge key={pc.round} variant="outline" className="text-xs">
                {ROUND_NAMES[pc.round]}: {pc.points}pt
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {isLocked ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Picks Locked
            </Badge>
          ) : (
            <Button
              onClick={savePicks}
              disabled={saving || pickedCount === 0}
              size="sm"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Picks"}
            </Button>
          )}
        </div>
      </div>

      {/* Champion callout */}
      {picks[matches.find((m) => m.round === 7)?.id ?? ""] && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
          <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
          <span>
            Your champion:{" "}
            <strong>
              {(() => {
                const final = matches.find((m) => m.round === 7);
                if (!final) return "TBD";
                const pickedId = picks[final.id];
                return (
                  final.player1?.id === pickedId
                    ? final.player1?.name
                    : final.player2?.name
                ) ?? "TBD";
              })()}
            </strong>
          </span>
        </div>
      )}

      {/* Bracket */}
      <div className="rounded-lg border overflow-hidden">
        <BracketView
          matches={matches}
          initialPicks={picks}
          isReadOnly={isLocked}
          onPicksChange={handlePicksChange}
        />
      </div>
    </div>
  );
}

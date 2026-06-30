"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BracketView } from "@/components/bracket/bracket-view";
import { toast } from "sonner";
import { Save, Lock, Trophy, Check } from "lucide-react";
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
  upsetMultiplier: number;
};

export function BracketPicksClient({
  tournamentId,
  gender,
  matches,
  initialPicks,
  isLocked,
  pointConfigs,
  upsetMultiplier,
}: BracketPicksClientProps) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

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

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/picks/${gender}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: picksArray }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save picks";
        try {
          const data = await res.json();
          errorMessage = data.error ?? errorMessage;
        } catch {
          // non-JSON error body (e.g. 500)
        }
        toast.error(errorMessage);
      } else {
        setJustSaved(true);
        router.refresh();
        setTimeout(() => setJustSaved(false), 3000);
      }
    } catch {
      toast.error("Failed to save picks — please check your connection and try again");
    } finally {
      setSaving(false);
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
          <div className="flex flex-wrap gap-1">
            {pointConfigs.map((pc) => (
              <Badge key={pc.round} variant="outline" className="text-xs">
                {ROUND_NAMES[pc.round]}: {pc.points}pt
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              className={justSaved ? "bg-green-600 hover:bg-green-600 text-white" : ""}
            >
              {justSaved ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Picks Saved!
                </>
              ) : saving ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Picks
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Champion callout */}
      {(() => {
        const final = matches.find((m) => m.round === 7);
        if (!final || !picks[final.id]) return null;
        const pickedId = picks[final.id];
        // Look the champion up directly so an eliminated pick still shows by name
        const playerById = new Map<string, Player>();
        for (const m of matches) {
          for (const p of [m.player1, m.player2, m.winner]) {
            if (p) playerById.set(p.id, p);
          }
        }
        const championName = playerById.get(pickedId)?.name ?? "TBD";
        return (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
            <span>
              Your champion: <strong>{championName}</strong>
            </span>
          </div>
        );
      })()}

      {/* Bracket */}
      <div className="rounded-lg border overflow-hidden">
        <BracketView
          matches={matches}
          initialPicks={picks}
          isReadOnly={isLocked}
          onPicksChange={handlePicksChange}
          pointConfigs={pointConfigs}
          upsetMultiplier={upsetMultiplier}
        />
      </div>
    </div>
  );
}

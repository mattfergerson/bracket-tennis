"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUND_NAMES } from "@/lib/constants";
import { toast } from "sonner";

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

type AdminBracketViewProps = {
  matches: Match[];
};

export function AdminBracketView({ matches }: AdminBracketViewProps) {
  const router = useRouter();
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);

  async function setWinner(matchId: string, playerId: string) {
    setLoadingMatchId(matchId);
    const res = await fetch(`/api/admin/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId: playerId }),
    });
    setLoadingMatchId(null);

    if (!res.ok) {
      toast.error("Failed to set winner");
    } else {
      toast.success("Winner recorded");
      router.refresh();
    }
  }

  async function clearResult(matchId: string) {
    setLoadingMatchId(matchId);
    const res = await fetch(`/api/admin/matches/${matchId}`, {
      method: "DELETE",
    });
    setLoadingMatchId(null);

    if (!res.ok) {
      toast.error("Failed to clear result");
    } else {
      toast.success("Result cleared");
      router.refresh();
    }
  }

  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }

  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {roundNumbers.map((round) => {
          const roundMatches = rounds.get(round)!.sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex flex-col" style={{ width: 220 }}>
              <div className="text-center text-xs font-semibold text-muted-foreground py-2 px-1 sticky top-0 bg-background border-b">
                {ROUND_NAMES[round] ?? `Round ${round}`}
              </div>
              <div
                className="flex flex-col flex-1"
                style={{
                  justifyContent: "space-around",
                  paddingTop: getPaddingForRound(round),
                  paddingBottom: getPaddingForRound(round),
                  gap: getGapForRound(round),
                }}
              >
                {roundMatches.map((match) => (
                  <AdminBracketMatch
                    key={match.id}
                    match={match}
                    loading={loadingMatchId === match.id}
                    onSetWinner={(playerId) => setWinner(match.id, playerId)}
                    onClearResult={() => clearResult(match.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AdminBracketMatchProps = {
  match: Match;
  loading: boolean;
  onSetWinner: (playerId: string) => void;
  onClearResult: () => void;
};

function AdminBracketMatch({
  match,
  loading,
  onSetWinner,
  onClearResult,
}: AdminBracketMatchProps) {
  const isCompleted = !!match.winnerId;

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden mx-1 shadow-sm bg-card relative group">
      <AdminMatchSlot
        player={match.player1}
        isWinner={match.winnerId === match.player1?.id}
        isCompleted={isCompleted}
        loading={loading}
        onSelect={!isCompleted && match.player1 ? () => onSetWinner(match.player1!.id) : undefined}
      />
      <div className="h-px bg-border" />
      <AdminMatchSlot
        player={match.player2}
        isWinner={match.winnerId === match.player2?.id}
        isCompleted={isCompleted}
        loading={loading}
        onSelect={!isCompleted && match.player2 ? () => onSetWinner(match.player2!.id) : undefined}
      />
      {isCompleted && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={onClearResult}
          disabled={loading}
          title="Clear result"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

type AdminMatchSlotProps = {
  player: Player | null;
  isWinner: boolean;
  isCompleted: boolean;
  loading: boolean;
  onSelect?: () => void;
};

function AdminMatchSlot({
  player,
  isWinner,
  isCompleted,
  loading,
  onSelect,
}: AdminMatchSlotProps) {
  const isLoser = isCompleted && !isWinner;

  if (!player) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 h-11 text-xs text-muted-foreground bg-muted/30">
        <span className="truncate">TBD</span>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      disabled={!onSelect || loading}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 h-11 text-xs w-full text-left transition-colors",
        onSelect && "cursor-pointer hover:bg-primary/10",
        !onSelect && "cursor-default",
        isWinner && "bg-green-50 text-green-800 font-semibold",
        isLoser && "opacity-50 line-through"
      )}
    >
      {player.seed != null && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
          {player.seed}
        </Badge>
      )}
      <span className="truncate flex-1 text-xs">{player.name}</span>
      <span className="shrink-0">
        {isWinner && <Check className="h-3 w-3 text-green-600" />}
        {isLoser && <X className="h-3 w-3 text-muted-foreground" />}
      </span>
    </button>
  );
}

function getPaddingForRound(round: number): number {
  const paddingMap: Record<number, number> = {
    1: 2,
    2: 20,
    3: 44,
    4: 92,
    5: 188,
    6: 380,
    7: 764,
  };
  return paddingMap[round] ?? 2;
}

function getGapForRound(round: number): number {
  const gapMap: Record<number, number> = {
    1: 4,
    2: 44,
    3: 92,
    4: 188,
    5: 380,
    6: 764,
    7: 0,
  };
  return gapMap[round] ?? 4;
}

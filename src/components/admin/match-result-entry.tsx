"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function MatchResultEntry({ match }: { match: Match }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setWinner(playerId: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/matches/${match.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winnerId: playerId }),
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to set winner");
    } else {
      toast.success("Winner recorded");
      router.refresh();
    }
  }

  async function clearResult() {
    setLoading(true);
    const res = await fetch(`/api/admin/matches/${match.id}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to clear result");
    } else {
      toast.success("Result cleared");
      router.refresh();
    }
  }

  const hasPlayers = match.player1 || match.player2;
  const isCompleted = !!match.winnerId;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border text-sm",
        isCompleted ? "bg-muted/50" : "bg-background"
      )}
    >
      <span className="text-muted-foreground w-8 text-right shrink-0">
        #{match.position}
      </span>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <PlayerSlot
          player={match.player1}
          isWinner={match.winnerId === match.player1?.id}
          isLoser={isCompleted && match.winnerId !== match.player1?.id}
          onSelect={hasPlayers && !isCompleted ? () => match.player1 && setWinner(match.player1.id) : undefined}
          loading={loading}
        />

        <span className="text-muted-foreground shrink-0 text-xs">vs</span>

        <PlayerSlot
          player={match.player2}
          isWinner={match.winnerId === match.player2?.id}
          isLoser={isCompleted && match.winnerId !== match.player2?.id}
          onSelect={hasPlayers && !isCompleted ? () => match.player2 && setWinner(match.player2.id) : undefined}
          loading={loading}
        />
      </div>

      {isCompleted && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={clearResult}
          disabled={loading}
          title="Clear result"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function PlayerSlot({
  player,
  isWinner,
  isLoser,
  onSelect,
  loading,
}: {
  player: Player | null;
  isWinner: boolean;
  isLoser: boolean;
  onSelect?: () => void;
  loading: boolean;
}) {
  if (!player) {
    return (
      <div className="flex-1 h-11 rounded border border-dashed border-muted flex items-center px-2 text-muted-foreground text-xs">
        TBD
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      disabled={!onSelect || loading}
      className={cn(
        "flex-1 h-11 rounded border px-2 flex items-center justify-between gap-1 text-left transition-colors",
        isWinner && "border-green-500 bg-green-50 text-green-900 font-medium",
        isLoser && "border-muted bg-muted/50 text-muted-foreground line-through",
        !isWinner && !isLoser && onSelect && "hover:border-primary hover:bg-primary/5 cursor-pointer",
        !onSelect && "cursor-default"
      )}
    >
      <span className="truncate text-xs">{player.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        {player.seed ? (
          <Badge variant="outline" className="text-xs px-1 py-0 h-4">
            {player.seed}
          </Badge>
        ) : null}
        {isWinner && <Check className="h-3 w-3 text-green-600" />}
        {isLoser && <X className="h-3 w-3 text-muted-foreground" />}
      </div>
    </button>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, HelpCircle } from "lucide-react";
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

type BracketViewProps = {
  matches: Match[];
  initialPicks?: Record<string, string>;
  isReadOnly?: boolean;
  onPicksChange?: (picks: Record<string, string>) => void;
};

export function BracketView({
  matches,
  initialPicks = {},
  isReadOnly = false,
  onPicksChange,
}: BracketViewProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);

  // Build a map: matchId -> Match
  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, m]));

  // Build lookup: (round, position) -> Match
  const roundPositionMap = new Map<string, Match>();
  for (const m of matches) {
    roundPositionMap.set(`${m.round}-${m.position}`, m);
  }

  /**
   * When a player is picked in a match, cascade:
   * - The picked player should advance to the next round's slot
   * - If the user previously picked a player that was from this match,
   *   clear their downstream picks since the path has changed.
   */
  function handlePick(matchId: string, playerId: string) {
    if (isReadOnly) return;

    const match = matchMap.get(matchId);
    if (!match) return;

    const newPicks = { ...picks };

    // If changing pick, cascade-clear downstream picks that depended on old pick
    const oldPick = picks[matchId];
    if (oldPick && oldPick !== playerId) {
      clearDownstreamPicks(newPicks, match.round, match.position, oldPick);
    }

    newPicks[matchId] = playerId;
    setPicks(newPicks);
    onPicksChange?.(newPicks);
  }

  function clearDownstreamPicks(
    currentPicks: Record<string, string>,
    fromRound: number,
    fromPosition: number,
    clearedPlayerId: string
  ) {
    if (fromRound >= 7) return;

    const nextRound = fromRound + 1;
    const nextPosition = Math.ceil(fromPosition / 2);
    const nextMatch = roundPositionMap.get(`${nextRound}-${nextPosition}`);

    if (!nextMatch) return;

    const nextPick = currentPicks[nextMatch.id];
    if (nextPick === clearedPlayerId) {
      delete currentPicks[nextMatch.id];
      clearDownstreamPicks(currentPicks, nextRound, nextPosition, clearedPlayerId);
    }
  }

  // Group matches by round
  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }

  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);

  // For display: left half shows rounds 1-4 (L→R), right half shows rounds 4-7 (R→L)
  // Simplified layout: vertical scroll with rounds side by side
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {roundNumbers.map((round) => {
          const roundMatches = rounds.get(round)!.sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex flex-col" style={{ width: 200 }}>
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
                {roundMatches.map((match) => {
                  // Determine effective players for this match slot
                  const player1 = getEffectivePlayer(
                    match,
                    1,
                    picks,
                    roundPositionMap
                  );
                  const player2 = getEffectivePlayer(
                    match,
                    2,
                    picks,
                    roundPositionMap
                  );

                  return (
                    <BracketMatch
                      key={match.id}
                      match={{ ...match, player1, player2 }}
                      picks={picks}
                      onPick={handlePick}
                      isReadOnly={isReadOnly}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getEffectivePlayer(
  match: Match,
  slot: 1 | 2,
  picks: Record<string, string>,
  roundPositionMap: Map<string, Match>
): Player | null {
  if (match.round === 1) {
    return slot === 1 ? match.player1 : match.player2;
  }

  const prevRound = match.round - 1;
  const basePos = (match.position - 1) * 2 + (slot === 1 ? 1 : 2);
  const feederMatch = roundPositionMap.get(`${prevRound}-${basePos}`);

  if (!feederMatch) return null;

  const pickedId = picks[feederMatch.id];
  if (!pickedId) return null;

  const p1 = feederMatch.player1 ?? getEffectivePlayer(feederMatch, 1, picks, roundPositionMap);
  const p2 = feederMatch.player2 ?? getEffectivePlayer(feederMatch, 2, picks, roundPositionMap);

  if (p1?.id === pickedId) return p1;
  if (p2?.id === pickedId) return p2;

  return null;
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

type BracketMatchProps = {
  match: Match;
  picks: Record<string, string>;
  onPick: (matchId: string, playerId: string) => void;
  isReadOnly: boolean;
};

function BracketMatch({ match, picks, onPick, isReadOnly }: BracketMatchProps) {
  const pickedId = picks[match.id];
  const isCompleted = !!match.winnerId;

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden mx-1 shadow-sm bg-card">
      <MatchSlot
        player={match.player1}
        isPicked={pickedId === match.player1?.id}
        isWinner={match.winnerId === match.player1?.id}
        isCompleted={isCompleted}
        isReadOnly={isReadOnly || !match.player1}
        onPick={() => match.player1 && onPick(match.id, match.player1.id)}
      />
      <div className="h-px bg-border" />
      <MatchSlot
        player={match.player2}
        isPicked={pickedId === match.player2?.id}
        isWinner={match.winnerId === match.player2?.id}
        isCompleted={isCompleted}
        isReadOnly={isReadOnly || !match.player2}
        onPick={() => match.player2 && onPick(match.id, match.player2.id)}
      />
    </div>
  );
}

type MatchSlotProps = {
  player: Player | null;
  isPicked: boolean;
  isWinner: boolean;
  isCompleted: boolean;
  isReadOnly: boolean;
  onPick: () => void;
};

function MatchSlot({
  player,
  isPicked,
  isWinner,
  isCompleted,
  isReadOnly,
  onPick,
}: MatchSlotProps) {
  const isLoser = isCompleted && !isWinner;
  const isCorrectPick = isPicked && isWinner;
  const isWrongPick = isPicked && isLoser;

  if (!player) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 h-9 text-xs text-muted-foreground bg-muted/30">
        <HelpCircle className="h-3 w-3 shrink-0" />
        <span className="truncate">TBD</span>
      </div>
    );
  }

  return (
    <button
      onClick={!isReadOnly ? onPick : undefined}
      disabled={isReadOnly}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 h-9 text-xs w-full text-left transition-colors",
        !isReadOnly && "cursor-pointer hover:bg-primary/10",
        isReadOnly && "cursor-default",
        isPicked && !isCompleted && "bg-primary/15 font-semibold",
        isCorrectPick && "bg-green-50 text-green-800",
        isWrongPick && "bg-red-50 text-red-800 line-through opacity-75",
        isLoser && !isPicked && "opacity-50",
        isWinner && !isPicked && "font-medium"
      )}
    >
      {player.seed ? (
        <span className="text-muted-foreground shrink-0 w-4 text-right text-[10px]">
          {player.seed}
        </span>
      ) : null}
      <span className="truncate flex-1 text-[11px]">{player.name}</span>
      <span className="shrink-0">
        {isCorrectPick && <Check className="h-3 w-3 text-green-600" />}
        {isWrongPick && <X className="h-3 w-3 text-red-500" />}
        {isPicked && !isCompleted && (
          <span className="h-2 w-2 rounded-full bg-primary inline-block" />
        )}
      </span>
    </button>
  );
}

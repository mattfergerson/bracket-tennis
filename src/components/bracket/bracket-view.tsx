"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, X, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
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
  points: number;
};

type BracketViewProps = {
  matches: Match[];
  initialPicks?: Record<string, string>;
  isReadOnly?: boolean;
  onPicksChange?: (picks: Record<string, string>) => void;
  pointConfigs?: PointConfig[];
};

const PICK_HEADER_HEIGHT = 22;

export function BracketView({
  matches,
  initialPicks = {},
  isReadOnly = false,
  onPicksChange,
  pointConfigs = [],
}: BracketViewProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);

  const roundPositionMap = new Map<string, Match>();
  for (const m of matches) {
    roundPositionMap.set(`${m.round}-${m.position}`, m);
  }

  const pointsByRound = new Map(pointConfigs.map((p) => [p.round, p.points]));

  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);
  const maxRound = roundNumbers[roundNumbers.length - 1] ?? 1;

  function getActiveRound(): number {
    for (const r of roundNumbers) {
      const rm = rounds.get(r)!;
      if (rm.some((m) => !m.winnerId)) return r;
    }
    return maxRound;
  }

  const [selectedRound, setSelectedRound] = useState(getActiveRound);

  function handlePick(matchId: string, playerId: string) {
    if (isReadOnly) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    const newPicks = { ...picks };
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

  function getPickedPlayer(match: Match, pickedId: string): Player | null {
    if (match.player1?.id === pickedId) return match.player1;
    if (match.player2?.id === pickedId) return match.player2;
    const p1 = getEffectivePlayerFromPicks(match, 1, picks, roundPositionMap);
    const p2 = getEffectivePlayerFromPicks(match, 2, picks, roundPositionMap);
    if (p1?.id === pickedId) return p1;
    if (p2?.id === pickedId) return p2;
    return null;
  }

  function getRoundStats(round: number) {
    const rm = rounds.get(round);
    if (!rm) return { total: 0, completed: 0, correct: 0 };
    const total = rm.length;
    const completed = rm.filter((m) => m.winnerId).length;
    const correct = rm.filter((m) => m.winnerId && picks[m.id] === m.winnerId).length;
    return { total, completed, correct };
  }

  function handleRoundSelect(round: number) {
    setSelectedRound(round);
  }

  const selectedMatches = (rounds.get(selectedRound) ?? []).sort(
    (a, b) => a.position - b.position
  );

  // Use grid columns based on match count
  const matchCount = selectedMatches.length;
  const gridCols =
    matchCount >= 16 ? "sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8" :
    matchCount >= 8  ? "sm:grid-cols-2 md:grid-cols-4" :
    matchCount >= 4  ? "sm:grid-cols-2 md:grid-cols-4" :
    matchCount >= 2  ? "sm:grid-cols-2" :
    "";

  return (
    <div>
      <RoundSelector
        roundNumbers={roundNumbers}
        selectedRound={selectedRound}
        onSelect={handleRoundSelect}
        getRoundStats={getRoundStats}
        pointsByRound={pointsByRound}
      />

      <div className={cn("grid grid-cols-1 gap-3 p-3", gridCols)}>
        {selectedMatches.map((match) => {
          const player1 = getEffectivePlayer(match, 1, picks, roundPositionMap);
          const player2 = getEffectivePlayer(match, 2, picks, roundPositionMap);
          const pickedId = picks[match.id];
          const points = pointsByRound.get(match.round);
          return (
            <BracketMatch
              key={match.id}
              match={{ ...match, player1, player2 }}
              pickedId={pickedId}
              pickedPlayer={pickedId ? getPickedPlayer(match, pickedId) : null}
              points={points}
              onPick={handlePick}
              isReadOnly={isReadOnly}
              matchLabel={matchCount <= 8 ? `Match ${match.position}` : undefined}
            />
          );
        })}
        {selectedMatches.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm col-span-full">
            No matches in this round yet.
          </p>
        )}
      </div>

      {/* Prev / Next round navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <button
          onClick={() => handleRoundSelect(Math.max(roundNumbers[0], selectedRound - 1))}
          disabled={selectedRound === roundNumbers[0]}
          className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {ROUND_NAMES[selectedRound - 1] ?? ""}
        </button>
        <span className="text-xs text-muted-foreground">
          {matchCount} {matchCount === 1 ? "match" : "matches"}
        </span>
        <button
          onClick={() => handleRoundSelect(Math.min(maxRound, selectedRound + 1))}
          disabled={selectedRound === maxRound}
          className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
        >
          {ROUND_NAMES[selectedRound + 1] ?? ""}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Round selector ──────────────────────────────────────────────────────────

type RoundSelectorProps = {
  roundNumbers: number[];
  selectedRound: number;
  onSelect: (round: number) => void;
  getRoundStats: (round: number) => { total: number; completed: number; correct: number };
  pointsByRound: Map<number, number>;
};

function RoundSelector({ roundNumbers, selectedRound, onSelect, getRoundStats, pointsByRound }: RoundSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const selected = container.querySelector("[data-selected=true]");
    if (selected) {
      selected.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [selectedRound]);

  return (
    <div className="border-b bg-muted/30">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-none gap-1 px-2 py-2"
      >
        {roundNumbers.map((round) => {
          const isActive = round === selectedRound;
          const stats = getRoundStats(round);
          const pts = pointsByRound.get(round);
          return (
            <button
              key={round}
              data-selected={isActive}
              onClick={() => onSelect(round)}
              className={cn(
                "flex flex-col items-center shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              <span className="font-semibold whitespace-nowrap">
                {ROUND_NAMES[round] ?? `R${round}`}
              </span>
              <span className={cn("text-[10px]", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {stats.completed > 0
                  ? `${stats.correct}/${stats.completed}`
                  : `${stats.total} matches`}
                {pts ? ` · ${pts}pt` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Player resolution ────────────────────────────────────────────────────────

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

  if (feederMatch.winnerId && feederMatch.winner) {
    return feederMatch.winner;
  }

  const pickedId = picks[feederMatch.id];
  if (!pickedId) return null;
  const p1 = feederMatch.player1 ?? getEffectivePlayer(feederMatch, 1, picks, roundPositionMap);
  const p2 = feederMatch.player2 ?? getEffectivePlayer(feederMatch, 2, picks, roundPositionMap);
  if (p1?.id === pickedId) return p1;
  if (p2?.id === pickedId) return p2;
  return null;
}

function getEffectivePlayerFromPicks(
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
  const p1 = feederMatch.player1 ?? getEffectivePlayerFromPicks(feederMatch, 1, picks, roundPositionMap);
  const p2 = feederMatch.player2 ?? getEffectivePlayerFromPicks(feederMatch, 2, picks, roundPositionMap);
  if (p1?.id === pickedId) return p1;
  if (p2?.id === pickedId) return p2;
  return null;
}

// ─── BracketMatch ─────────────────────────────────────────────────────────────

type BracketMatchProps = {
  match: Match;
  pickedId: string | undefined;
  pickedPlayer: Player | null;
  points: number | undefined;
  onPick: (matchId: string, playerId: string) => void;
  isReadOnly: boolean;
  matchLabel?: string;
};

function BracketMatch({ match, pickedId, pickedPlayer, points, onPick, isReadOnly, matchLabel }: BracketMatchProps) {
  const isCompleted = !!match.winnerId;
  const isCorrectPick = isCompleted && pickedId === match.winnerId;
  const isWrongPick = isCompleted && !!pickedId && pickedId !== match.winnerId;
  const showPickHeader = !!pickedId && isCompleted;

  return (
    <div className={cn(
      "flex flex-col border rounded-lg overflow-hidden shadow-sm bg-card",
      isCorrectPick && "border-green-300",
      isWrongPick && "border-red-200",
    )}>
      {showPickHeader && (
        <div
          className={cn(
            "flex items-center gap-1 px-2 text-[10px] font-semibold",
            isCorrectPick && "bg-green-100 text-green-800",
            isWrongPick && "bg-red-50 text-red-800"
          )}
          style={{ height: PICK_HEADER_HEIGHT }}
        >
          <span className="truncate flex-1">
            My Pick:{" "}
            {pickedPlayer?.seed && (
              <span className="opacity-70">{pickedPlayer.seed} </span>
            )}
            {pickedPlayer?.name ?? "Unknown"}
          </span>
          {isCorrectPick && <Check className="h-3 w-3 text-green-600 shrink-0" />}
          {isWrongPick && <X className="h-3 w-3 text-red-500 shrink-0" />}
        </div>
      )}

      <MatchSlot
        player={match.player1}
        isWinner={match.winnerId === match.player1?.id}
        isCompleted={isCompleted}
        isPicked={!isCompleted && pickedId === match.player1?.id}
        isReadOnly={isReadOnly || !match.player1}
        onPick={() => match.player1 && onPick(match.id, match.player1.id)}
      />
      <div className="h-px bg-border" />
      <MatchSlot
        player={match.player2}
        isWinner={match.winnerId === match.player2?.id}
        isCompleted={isCompleted}
        isPicked={!isCompleted && pickedId === match.player2?.id}
        isReadOnly={isReadOnly || !match.player2}
        onPick={() => match.player2 && onPick(match.id, match.player2.id)}
      />

      {isCorrectPick && points && (
        <div className="bg-green-100 text-green-800 text-[10px] font-bold text-center py-0.5">
          +{points} PTS
        </div>
      )}
    </div>
  );
}

// ─── MatchSlot ────────────────────────────────────────────────────────────────

type MatchSlotProps = {
  player: Player | null;
  isWinner: boolean;
  isCompleted: boolean;
  isPicked: boolean;
  isReadOnly: boolean;
  onPick: () => void;
};

function MatchSlot({
  player,
  isWinner,
  isCompleted,
  isPicked,
  isReadOnly,
  onPick,
}: MatchSlotProps) {
  const isLoser = isCompleted && !isWinner;

  if (!player) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 h-10 text-xs text-muted-foreground bg-muted/30">
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
        "flex items-center gap-1 px-2 py-1 h-10 text-xs w-full text-left transition-colors",
        !isReadOnly && "cursor-pointer hover:bg-primary/10",
        isReadOnly && "cursor-default",
        isPicked && "bg-primary/15 font-semibold",
        isWinner && "font-semibold",
        isLoser && "opacity-40 text-muted-foreground",
      )}
    >
      {player.seed ? (
        <span className="text-muted-foreground shrink-0 w-4 text-right text-[11px]">
          {player.seed}
        </span>
      ) : null}
      <span className={cn("truncate flex-1 text-xs", isWinner && "text-green-800")}>{player.name}</span>
      {isWinner && <Check className="h-3 w-3 text-green-600 shrink-0" />}
      {isPicked && !isCompleted && (
        <span className="h-2 w-2 rounded-full bg-primary inline-block shrink-0" />
      )}
    </button>
  );
}

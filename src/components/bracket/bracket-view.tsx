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

// Each match card: two h-11 slots (44 px each) + 1 px divider + 2 px outer border = 91 px.
// Round-1 gap between matches = 4 px → one "cell" in the grid = 95 px.
const MATCH_HEIGHT = 91;
const BASE_STEP = 95; // MATCH_HEIGHT + 4 px round-1 gap

// Connector column dimensions
const CONN_WIDTH = 16;
const STUB = 8; // half of CONN_WIDTH — where the vertical bar sits

/**
 * Absolute top offset for a match card inside its round column.
 * position is 1-indexed (from the DB schema).
 */
function getMatchTop(round: number, position: number): number {
  return BASE_STEP * Math.pow(2, round - 1) * (position - 0.5) - MATCH_HEIGHT / 2;
}

export function BracketView({
  matches,
  initialPicks = {},
  isReadOnly = false,
  onPicksChange,
}: BracketViewProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);

  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, m]));

  const roundPositionMap = new Map<string, Match>();
  for (const m of matches) {
    roundPositionMap.set(`${m.round}-${m.position}`, m);
  }

  function handlePick(matchId: string, playerId: string) {
    if (isReadOnly) return;
    const match = matchMap.get(matchId);
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

  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }

  const roundNumbers = Array.from(rounds.keys()).sort((a, b) => a - b);
  const maxRound = roundNumbers[roundNumbers.length - 1] ?? 1;
  const round1Count = rounds.get(1)?.length ?? 0;
  const totalHeight = round1Count * BASE_STEP;

  return (
    <div>
      <div className="overflow-x-auto">
      <div className="flex gap-0 min-w-max">
        {roundNumbers.map((round) => {
          const roundMatches = rounds.get(round)!.sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex gap-0 min-w-max">
              {/* Round column */}
              <div className="flex flex-col" style={{ width: 200 }}>
                <div className="text-center text-xs font-semibold text-muted-foreground py-2 px-1 sticky top-0 bg-background border-b">
                  {ROUND_NAMES[round] ?? `Round ${round}`}
                </div>
                <div style={{ position: "relative", height: totalHeight }}>
                  {roundMatches.map((match) => {
                    const player1 = getEffectivePlayer(match, 1, picks, roundPositionMap);
                    const player2 = getEffectivePlayer(match, 2, picks, roundPositionMap);
                    return (
                      <div
                        key={match.id}
                        style={{
                          position: "absolute",
                          top: getMatchTop(round, match.position),
                          left: 0,
                          right: 0,
                        }}
                      >
                        <BracketMatch
                          match={{ ...match, player1, player2 }}
                          picks={picks}
                          onPick={handlePick}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connector column (not after the final round) */}
              {round < maxRound && (
                <ConnectorColumn
                  round={round}
                  round1Count={round1Count}
                  totalHeight={totalHeight}
                />
              )}
            </div>
          );
        })}
      </div>
      </div>
      <p className="sm:hidden flex items-center justify-center gap-1 py-2 border-t text-xs text-muted-foreground select-none">
        <span aria-hidden>←</span>
        Scroll to see full bracket
        <span aria-hidden>→</span>
      </p>
    </div>
  );
}

// ─── Connector column ────────────────────────────────────────────────────────

type ConnectorColumnProps = {
  round: number;
  round1Count: number;
  totalHeight: number;
};

function ConnectorColumn({ round, round1Count, totalHeight }: ConnectorColumnProps) {
  const matchesInRound = round1Count / Math.pow(2, round - 1);
  const pairCount = Math.floor(matchesInRound / 2);

  const paths: string[] = [];

  for (let i = 0; i < pairCount; i++) {
    // Top match of pair: 1-indexed position = 2*i + 1
    const topPos = 2 * i + 1;
    const topCenter = BASE_STEP * Math.pow(2, round - 1) * (topPos - 0.5);
    const botCenter = BASE_STEP * Math.pow(2, round - 1) * (topPos + 0.5);
    const midpoint = BASE_STEP * Math.pow(2, round - 1) * topPos;

    // Bracket shape: two horizontal stubs meeting a vertical bar, then a
    // horizontal line at the midpoint leading to the next round column.
    paths.push(
      `M 0 ${topCenter} H ${STUB} V ${botCenter} H 0`,
      `M ${STUB} ${midpoint} H ${CONN_WIDTH}`
    );
  }

  return (
    <div className="flex flex-col" style={{ width: CONN_WIDTH }}>
      {/* Invisible spacer matching the round header height */}
      <div
        className="text-center text-xs font-semibold py-2 px-1 border-b"
        style={{ visibility: "hidden" }}
      >
        &nbsp;
      </div>
      <svg
        width={CONN_WIDTH}
        height={totalHeight}
        className="text-border"
        style={{ display: "block", overflow: "visible" }}
      >
        {paths.map((d, idx) => (
          <path key={idx} d={d} fill="none" stroke="currentColor" strokeWidth={1} />
        ))}
      </svg>
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

  // If the feeder match has an actual winner, that's who advances
  if (feederMatch.winnerId && feederMatch.winner) {
    return feederMatch.winner;
  }

  // Match not decided yet — show the user's pick as the projected player
  const pickedId = picks[feederMatch.id];
  if (!pickedId) return null;
  const p1 = feederMatch.player1 ?? getEffectivePlayer(feederMatch, 1, picks, roundPositionMap);
  const p2 = feederMatch.player2 ?? getEffectivePlayer(feederMatch, 2, picks, roundPositionMap);
  if (p1?.id === pickedId) return p1;
  if (p2?.id === pickedId) return p2;
  return null;
}

// ─── BracketMatch ─────────────────────────────────────────────────────────────

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

// ─── MatchSlot ────────────────────────────────────────────────────────────────

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
      <div className="flex items-center gap-1 px-2 py-1.5 h-11 text-xs text-muted-foreground bg-muted/30">
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
        "flex items-center gap-1 px-2 py-1.5 h-11 text-xs w-full text-left transition-colors",
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
        <span className="text-muted-foreground shrink-0 w-4 text-right text-[11px]">
          {player.seed}
        </span>
      ) : null}
      <span className="truncate flex-1 text-xs">{player.name}</span>
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

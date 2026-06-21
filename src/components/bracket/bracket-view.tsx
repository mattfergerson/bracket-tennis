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

// Layout constants
// Card: optional 22px pick header + two 40px player slots + 1px divider + 2px border = 105px max
const PICK_HEADER_HEIGHT = 22;
const MATCH_HEIGHT = 105;
const BASE_STEP = 109; // MATCH_HEIGHT + 4px gap

const CONN_WIDTH = 16;
const STUB = 8;

function getMatchTop(round: number, position: number): number {
  return BASE_STEP * Math.pow(2, round - 1) * (position - 0.5) - MATCH_HEIGHT / 2;
}

export function BracketView({
  matches,
  initialPicks = {},
  isReadOnly = false,
  onPicksChange,
  pointConfigs = [],
}: BracketViewProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);

  const matchMap = new Map<string, Match>(matches.map((m) => [m.id, m]));

  const roundPositionMap = new Map<string, Match>();
  for (const m of matches) {
    roundPositionMap.set(`${m.round}-${m.position}`, m);
  }

  const pointsByRound = new Map(pointConfigs.map((p) => [p.round, p.points]));

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

  // Resolve picked player name for a match (may need to look up from earlier rounds)
  function getPickedPlayer(match: Match, pickedId: string): Player | null {
    if (match.player1?.id === pickedId) return match.player1;
    if (match.player2?.id === pickedId) return match.player2;
    // For later rounds, the picked player might come from the original draw
    const p1 = getEffectivePlayerFromPicks(match, 1, picks, roundPositionMap);
    const p2 = getEffectivePlayerFromPicks(match, 2, picks, roundPositionMap);
    if (p1?.id === pickedId) return p1;
    if (p2?.id === pickedId) return p2;
    return null;
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
              <div className="flex flex-col" style={{ width: 210 }}>
                <div className="text-center text-xs font-semibold text-muted-foreground py-2 px-1 sticky top-0 bg-background border-b">
                  {ROUND_NAMES[round] ?? `Round ${round}`}
                </div>
                <div style={{ position: "relative", height: totalHeight }}>
                  {roundMatches.map((match) => {
                    const player1 = getEffectivePlayer(match, 1, picks, roundPositionMap);
                    const player2 = getEffectivePlayer(match, 2, picks, roundPositionMap);
                    const pickedId = picks[match.id];
                    const points = pointsByRound.get(match.round);
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
                          pickedId={pickedId}
                          pickedPlayer={pickedId ? getPickedPlayer(match, pickedId) : null}
                          points={points}
                          onPick={handlePick}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

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
    const topPos = 2 * i + 1;
    const topCenter = BASE_STEP * Math.pow(2, round - 1) * (topPos - 0.5);
    const botCenter = BASE_STEP * Math.pow(2, round - 1) * (topPos + 0.5);
    const midpoint = BASE_STEP * Math.pow(2, round - 1) * topPos;

    paths.push(
      `M 0 ${topCenter} H ${STUB} V ${botCenter} H 0`,
      `M ${STUB} ${midpoint} H ${CONN_WIDTH}`
    );
  }

  return (
    <div className="flex flex-col" style={{ width: CONN_WIDTH }}>
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

// Resolve using only picks (not actual winners) — used to find who the user picked
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
};

function BracketMatch({ match, pickedId, pickedPlayer, points, onPick, isReadOnly }: BracketMatchProps) {
  const isCompleted = !!match.winnerId;
  const isCorrectPick = isCompleted && pickedId === match.winnerId;
  const isWrongPick = isCompleted && !!pickedId && pickedId !== match.winnerId;
  const showPickHeader = !!pickedId && isCompleted;

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden mx-1 shadow-sm bg-card">
      {/* ESPN-style "My Pick" header for decided matches */}
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

      {/* Spacer when no pick header to keep card height consistent */}
      {!showPickHeader && (
        <div style={{ height: PICK_HEADER_HEIGHT }} />
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

      {/* Points badge for correct picks */}
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

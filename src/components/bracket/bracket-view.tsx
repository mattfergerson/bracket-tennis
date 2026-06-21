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
const MATCH_HEIGHT = 105;
const BASE_STEP = 109;
const CONN_WIDTH = 16;
const STUB = 8;
const COLUMN_WIDTH = 210;
const VISIBLE_ROUNDS = 3;

// Compute the top offset for a match card relative to a window starting at startRound.
// The first visible round's matches are packed tightly (BASE_STEP apart).
// Later visible rounds double the spacing to stay aligned with their feeder pairs.
function getWindowMatchTop(
  round: number,
  position: number,
  startRound: number
): number {
  const relativeRound = round - startRound;
  return (
    BASE_STEP * Math.pow(2, relativeRound) * (position - 0.5) -
    MATCH_HEIGHT / 2
  );
}

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

  function handleRoundSelect(round: number) {
    setSelectedRound(round);
  }

  function getRoundStats(round: number) {
    const rm = rounds.get(round);
    if (!rm) return { total: 0, completed: 0, correct: 0 };
    const total = rm.length;
    const completed = rm.filter((m) => m.winnerId).length;
    const correct = rm.filter((m) => m.winnerId && picks[m.id] === m.winnerId).length;
    return { total, completed, correct };
  }

  // Determine visible window: selectedRound + up to VISIBLE_ROUNDS-1 more
  const visibleRounds = roundNumbers.filter(
    (r) => r >= selectedRound && r < selectedRound + VISIBLE_ROUNDS
  );

  // Height is based on the first visible round's match count
  const firstVisibleMatchCount = rounds.get(visibleRounds[0])?.length ?? 0;
  const windowHeight = firstVisibleMatchCount * BASE_STEP;

  return (
    <div>
      {/* Round selector bar */}
      <RoundSelector
        roundNumbers={roundNumbers}
        selectedRound={selectedRound}
        onSelect={handleRoundSelect}
        getRoundStats={getRoundStats}
        pointsByRound={pointsByRound}
      />

      {/* Mobile: single round view */}
      <div className="sm:hidden">
        <RoundView
          round={selectedRound}
          matches={(rounds.get(selectedRound) ?? []).sort(
            (a, b) => a.position - b.position
          )}
          picks={picks}
          pointsByRound={pointsByRound}
          roundPositionMap={roundPositionMap}
          getPickedPlayer={getPickedPlayer}
          onPick={handlePick}
          isReadOnly={isReadOnly}
        />
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button
            onClick={() =>
              handleRoundSelect(Math.max(roundNumbers[0], selectedRound - 1))
            }
            disabled={selectedRound === roundNumbers[0]}
            className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            {ROUND_NAMES[selectedRound - 1] ?? ""}
          </button>
          <button
            onClick={() =>
              handleRoundSelect(Math.min(maxRound, selectedRound + 1))
            }
            disabled={selectedRound === maxRound}
            className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-30"
          >
            {ROUND_NAMES[selectedRound + 1] ?? ""}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop: windowed bracket with connector lines */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {visibleRounds.map((round) => {
              const roundMatches = rounds
                .get(round)!
                .sort((a, b) => a.position - b.position);
              const isLastVisible =
                round === visibleRounds[visibleRounds.length - 1];

              return (
                <div key={round} className="flex gap-0">
                  {/* Round column */}
                  <div className="flex flex-col" style={{ width: COLUMN_WIDTH }}>
                    <div className="text-center text-xs font-semibold text-muted-foreground py-2 px-1 border-b bg-muted/20">
                      {ROUND_NAMES[round] ?? `Round ${round}`}
                    </div>
                    <div
                      style={{
                        position: "relative",
                        height: windowHeight,
                      }}
                    >
                      {roundMatches.map((match) => {
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
                        const pickedId = picks[match.id];
                        const points = pointsByRound.get(match.round);
                        return (
                          <div
                            key={match.id}
                            style={{
                              position: "absolute",
                              top: getWindowMatchTop(
                                round,
                                match.position,
                                selectedRound
                              ),
                              left: 0,
                              right: 0,
                            }}
                          >
                            <BracketMatch
                              match={{ ...match, player1, player2 }}
                              pickedId={pickedId}
                              pickedPlayer={
                                pickedId
                                  ? getPickedPlayer(match, pickedId)
                                  : null
                              }
                              points={points}
                              onPick={handlePick}
                              isReadOnly={isReadOnly}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Connector lines between visible rounds */}
                  {!isLastVisible && (
                    <WindowConnectorColumn
                      round={round}
                      startRound={selectedRound}
                      firstVisibleMatchCount={firstVisibleMatchCount}
                      windowHeight={windowHeight}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Round selector ──────────────────────────────────────────────────────────

type RoundSelectorProps = {
  roundNumbers: number[];
  selectedRound: number;
  onSelect: (round: number) => void;
  getRoundStats: (round: number) => {
    total: number;
    completed: number;
    correct: number;
  };
  pointsByRound: Map<number, number>;
};

function RoundSelector({
  roundNumbers,
  selectedRound,
  onSelect,
  getRoundStats,
  pointsByRound,
}: RoundSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const selected = container.querySelector("[data-selected=true]");
    if (selected) {
      selected.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
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
              <span
                className={cn(
                  "text-[10px]",
                  isActive
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
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

// ─── Mobile round view ───────────────────────────────────────────────────────

type RoundViewProps = {
  round: number;
  matches: Match[];
  picks: Record<string, string>;
  pointsByRound: Map<number, number>;
  roundPositionMap: Map<string, Match>;
  getPickedPlayer: (match: Match, pickedId: string) => Player | null;
  onPick: (matchId: string, playerId: string) => void;
  isReadOnly: boolean;
};

function RoundView({
  round,
  matches,
  picks,
  pointsByRound,
  roundPositionMap,
  getPickedPlayer,
  onPick,
  isReadOnly,
}: RoundViewProps) {
  const points = pointsByRound.get(round);

  return (
    <div className="flex flex-col gap-2 p-3">
      {matches.map((match) => {
        const player1 = getEffectivePlayer(match, 1, picks, roundPositionMap);
        const player2 = getEffectivePlayer(match, 2, picks, roundPositionMap);
        const pickedId = picks[match.id];
        return (
          <BracketMatch
            key={match.id}
            match={{ ...match, player1, player2 }}
            pickedId={pickedId}
            pickedPlayer={
              pickedId ? getPickedPlayer(match, pickedId) : null
            }
            points={points}
            onPick={onPick}
            isReadOnly={isReadOnly}
          />
        );
      })}
      {matches.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">
          No matches in this round yet.
        </p>
      )}
    </div>
  );
}

// ─── Windowed connector column ───────────────────────────────────────────────

type WindowConnectorColumnProps = {
  round: number;
  startRound: number;
  firstVisibleMatchCount: number;
  windowHeight: number;
};

function WindowConnectorColumn({
  round,
  startRound,
  firstVisibleMatchCount,
  windowHeight,
}: WindowConnectorColumnProps) {
  const relativeRound = round - startRound;
  const matchesInRound = firstVisibleMatchCount / Math.pow(2, relativeRound);
  const pairCount = Math.floor(matchesInRound / 2);

  const paths: string[] = [];

  for (let i = 0; i < pairCount; i++) {
    const topPos = 2 * i + 1;
    const step = BASE_STEP * Math.pow(2, relativeRound);
    const topCenter = step * (topPos - 0.5);
    const botCenter = step * (topPos + 0.5);
    const midpoint = step * topPos;

    paths.push(
      `M 0 ${topCenter} H ${STUB} V ${botCenter} H 0`,
      `M ${STUB} ${midpoint} H ${CONN_WIDTH}`
    );
  }

  return (
    <div className="flex flex-col" style={{ width: CONN_WIDTH }}>
      {/* Spacer to match the round header */}
      <div className="text-xs py-2 px-1 border-b" style={{ visibility: "hidden" }}>
        &nbsp;
      </div>
      <svg
        width={CONN_WIDTH}
        height={windowHeight}
        className="text-border"
        style={{ display: "block", overflow: "visible" }}
      >
        {paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
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
  const p1 =
    feederMatch.player1 ??
    getEffectivePlayer(feederMatch, 1, picks, roundPositionMap);
  const p2 =
    feederMatch.player2 ??
    getEffectivePlayer(feederMatch, 2, picks, roundPositionMap);
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
  const p1 =
    feederMatch.player1 ??
    getEffectivePlayerFromPicks(feederMatch, 1, picks, roundPositionMap);
  const p2 =
    feederMatch.player2 ??
    getEffectivePlayerFromPicks(feederMatch, 2, picks, roundPositionMap);
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

function BracketMatch({
  match,
  pickedId,
  pickedPlayer,
  points,
  onPick,
  isReadOnly,
}: BracketMatchProps) {
  const isCompleted = !!match.winnerId;
  const isCorrectPick = isCompleted && pickedId === match.winnerId;
  const isWrongPick = isCompleted && !!pickedId && pickedId !== match.winnerId;
  const showPickHeader = !!pickedId && isCompleted;

  return (
    <div
      className={cn(
        "flex flex-col border rounded-lg overflow-hidden shadow-sm bg-card",
        "mx-1",
        isCorrectPick && "border-green-300",
        isWrongPick && "border-red-200"
      )}
    >
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
          {isCorrectPick && (
            <Check className="h-3 w-3 text-green-600 shrink-0" />
          )}
          {isWrongPick && <X className="h-3 w-3 text-red-500 shrink-0" />}
        </div>
      )}

      {!showPickHeader && (
        <div className="hidden sm:block" style={{ height: PICK_HEADER_HEIGHT }} />
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
        isLoser && "opacity-40 text-muted-foreground"
      )}
    >
      {player.seed ? (
        <span className="text-muted-foreground shrink-0 w-4 text-right text-[11px]">
          {player.seed}
        </span>
      ) : null}
      <span
        className={cn(
          "truncate flex-1 text-xs",
          isWinner && "text-green-800"
        )}
      >
        {player.name}
      </span>
      {isWinner && <Check className="h-3 w-3 text-green-600 shrink-0" />}
      {isPicked && !isCompleted && (
        <span className="h-2 w-2 rounded-full bg-primary inline-block shrink-0" />
      )}
    </button>
  );
}

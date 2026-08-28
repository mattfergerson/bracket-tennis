"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Check, X, HelpCircle } from "lucide-react";
import { ROUND_NAMES, PENDING_QUALIFIER_NAME } from "@/lib/constants";
import { calcUpsetBonus, isExactMatchup } from "@/lib/upset";

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
  upsetMultiplier?: number;
};

const PICK_HEADER_HEIGHT = 22;
const MATCH_HEIGHT = 105;
const ROW_STEP = 109;
const CONN_WIDTH = 24;

// Builds one column's row-position function from the column immediately to
// its left. The anchor column (no left neighbor) lays its rows out
// uniformly; every column after that sits its match at the vertical
// midpoint of the two upstream matches that feed it — recursively, so
// however many preview rounds are shown stay perfectly aligned with their
// connector lines, instead of the old exponential-growth layout that only
// worked because every round was visible at once.
function buildGetTop(prevGetTop: ((position: number) => number) | null) {
  if (!prevGetTop) {
    return (position: number) => ROW_STEP * (position - 1);
  }
  return (position: number) => {
    const feeder1Center = prevGetTop(2 * position - 1) + MATCH_HEIGHT / 2;
    const feeder2Center = prevGetTop(2 * position) + MATCH_HEIGHT / 2;
    return (feeder1Center + feeder2Center) / 2 - MATCH_HEIGHT / 2;
  };
}

// Below this width, columns filling the available space already use it well
// with just one preview round; wider screens have room to spread a second
// preview round across, which narrows all the columns rather than leaving
// them capped-wide with space left over.
const WIDE_BREAKPOINT = "(min-width: 1024px)";

export function BracketView({
  matches,
  initialPicks = {},
  isReadOnly = false,
  onPicksChange,
  pointConfigs = [],
  upsetMultiplier = 0,
}: BracketViewProps) {
  const [picks, setPicks] = useState<Record<string, string>>(initialPicks);

  // Defaults to false so the server render and the first client render match
  // (avoiding a hydration mismatch); upgrades right after mount.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_BREAKPOINT);
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const roundPositionMap = new Map<string, Match>();
  for (const m of matches) {
    roundPositionMap.set(`${m.round}-${m.position}`, m);
  }

  const pointsByRound = new Map(pointConfigs.map((p) => [p.round, p.points]));

  // Every player who has appeared anywhere in the draw, plus the set of players
  // who have been eliminated (lost a decided match). Used to render a picked
  // player in a future slot even after they've been knocked out.
  const playerById = new Map<string, Player>();
  const eliminatedIds = new Set<string>();
  for (const m of matches) {
    for (const p of [m.player1, m.player2, m.winner]) {
      if (p) playerById.set(p.id, p);
    }
    if (m.winnerId) {
      if (m.player1 && m.player1.id !== m.winnerId) eliminatedIds.add(m.player1.id);
      if (m.player2 && m.player2.id !== m.winnerId) eliminatedIds.add(m.player2.id);
    }
  }

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

  function getPickedPlayer(_match: Match, pickedId: string): Player | null {
    return playerById.get(pickedId) ?? null;
  }

  // Same rule as server scoring: the upset bonus only counts when the user's
  // feeder-match picks predicted the two players who actually met. Evaluated
  // against the raw match (actual players), not the projected view.
  function isPickExactMatchup(match: Match): boolean {
    if (match.round === 1) return true;
    const feeder1 = roundPositionMap.get(
      `${match.round - 1}-${match.position * 2 - 1}`
    );
    const feeder2 = roundPositionMap.get(
      `${match.round - 1}-${match.position * 2}`
    );
    return isExactMatchup(
      match.player1?.id ?? null,
      match.player2?.id ?? null,
      feeder1 ? picks[feeder1.id] : undefined,
      feeder2 ? picks[feeder2.id] : undefined
    );
  }

  function getRoundStats(round: number) {
    const rm = rounds.get(round);
    if (!rm) return { total: 0, completed: 0, correct: 0 };
    const total = rm.length;
    const completed = rm.filter((m) => m.winnerId).length;
    const correct = rm.filter((m) => m.winnerId && picks[m.id] === m.winnerId).length;
    return { total, completed, correct };
  }

  // Anchor round plus the round(s) it feeds into. Columns are flexible width
  // (see RoundColumn) and capped so they don't get absurdly wide — showing a
  // second preview round on wide screens gives that extra space somewhere
  // useful to go instead of just widening two columns past their cap.
  const aheadCount = isWide ? 2 : 1;
  type Column = {
    round: number;
    matches: Match[];
    getTop: (position: number) => number;
    isPreview: boolean;
  };
  const columns: Column[] = [];
  let prevGetTop: ((position: number) => number) | null = null;
  for (let i = 0; i <= aheadCount; i++) {
    const round = selectedRound + i;
    if (round > maxRound) break;
    const getTop = buildGetTop(prevGetTop);
    const roundMatches = (rounds.get(round) ?? []).sort((a, b) => a.position - b.position);
    columns.push({ round, matches: roundMatches, getTop, isPreview: i > 0 });
    prevGetTop = getTop;
  }
  const containerHeight = ROW_STEP * (columns[0]?.matches.length ?? 0);

  const columnProps = {
    picks,
    pointsByRound,
    roundPositionMap,
    playerById,
    eliminatedIds,
    getPickedPlayer,
    isPickExactMatchup,
    onPick: handlePick,
    isReadOnly,
    upsetMultiplier,
  };

  return (
    <div>
      {/* Round selector bar — doubles as the round toggle */}
      <RoundSelector
        roundNumbers={roundNumbers}
        selectedRound={selectedRound}
        onSelect={setSelectedRound}
        getRoundStats={getRoundStats}
        pointsByRound={pointsByRound}
      />

      {/* Selected round, plus a preview of the round(s) it feeds into */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "80vh" }}>
        <div className="flex gap-0 min-w-full p-2">
          {columns.map((col, idx) => (
            <Fragment key={col.round}>
              {idx > 0 && (
                <ConnectorColumn
                  leftGetTop={columns[idx - 1].getTop}
                  leftCount={columns[idx - 1].matches.length}
                  containerHeight={containerHeight}
                />
              )}
              <RoundColumn
                roundLabel={ROUND_NAMES[col.round] ?? `Round ${col.round}`}
                matches={col.matches}
                getTop={col.getTop}
                containerHeight={containerHeight}
                isPreview={col.isPreview}
                {...columnProps}
              />
            </Fragment>
          ))}
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
  getRoundStats: (round: number) => { total: number; completed: number; correct: number };
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

// ─── Round column ────────────────────────────────────────────────────────────
// Renders one round's matches, absolutely positioned by `getTop` so a
// ConnectorColumn can draw lines to the adjacent round. Shared by the
// selected round and its one-round-ahead preview, on every screen size.

type RoundColumnProps = {
  roundLabel: string;
  matches: Match[];
  getTop: (position: number) => number;
  containerHeight: number;
  picks: Record<string, string>;
  pointsByRound: Map<number, number>;
  roundPositionMap: Map<string, Match>;
  playerById: Map<string, Player>;
  eliminatedIds: Set<string>;
  getPickedPlayer: (match: Match, pickedId: string) => Player | null;
  isPickExactMatchup: (match: Match) => boolean;
  onPick: (matchId: string, playerId: string) => void;
  isReadOnly: boolean;
  upsetMultiplier: number;
  isPreview?: boolean;
};

function RoundColumn({
  roundLabel,
  matches,
  getTop,
  containerHeight,
  picks,
  pointsByRound,
  roundPositionMap,
  playerById,
  eliminatedIds,
  getPickedPlayer,
  isPickExactMatchup,
  onPick,
  isReadOnly,
  upsetMultiplier,
  isPreview,
}: RoundColumnProps) {
  return (
    <div className="flex-1 min-w-[200px] max-w-[420px]">
      <div
        className={cn(
          "text-center text-xs font-semibold py-2 px-1 sticky top-0 z-10 border-b",
          isPreview ? "bg-muted/50 text-muted-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        {roundLabel}
      </div>
      <div style={{ position: "relative", height: containerHeight }}>
        {matches.map((match) => {
          const player1 = getEffectivePlayer(match, 1, picks, roundPositionMap, playerById);
          const player2 = getEffectivePlayer(match, 2, picks, roundPositionMap, playerById);
          const pickedId = picks[match.id];
          const points = pointsByRound.get(match.round);
          return (
            <div
              key={match.id}
              style={{ position: "absolute", top: getTop(match.position), left: 0, right: 0 }}
            >
              <BracketMatch
                match={{ ...match, player1, player2 }}
                pickedId={pickedId}
                pickedPlayer={pickedId ? getPickedPlayer(match, pickedId) : null}
                points={points}
                upsetMultiplier={upsetMultiplier}
                exactMatchup={isPickExactMatchup(match)}
                eliminatedIds={eliminatedIds}
                onPick={onPick}
                isReadOnly={isReadOnly}
              />
            </div>
          );
        })}
        {matches.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm px-2">
            No matches in this round yet.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Connector column ────────────────────────────────────────────────────────
// Bridges two currently-visible adjacent rounds. Takes the left column's own
// getTop so it works the same whether that column is the uniformly-spaced
// anchor or an already-derived preview column — the right column's position
// is always the midpoint of its two feeders here, so every line is straight;
// no angled-connector fallback is needed like the old all-rounds layout did.

type ConnectorColumnProps = {
  leftGetTop: (position: number) => number;
  leftCount: number;
  containerHeight: number;
};

function ConnectorColumn({ leftGetTop, leftCount, containerHeight }: ConnectorColumnProps) {
  const pairCount = Math.floor(leftCount / 2);
  const halfConn = CONN_WIDTH / 2;
  const paths: string[] = [];

  for (let i = 0; i < pairCount; i++) {
    const topCenter = leftGetTop(2 * i + 1) + MATCH_HEIGHT / 2;
    const botCenter = leftGetTop(2 * i + 2) + MATCH_HEIGHT / 2;
    const midY = (topCenter + botCenter) / 2;

    paths.push(`M 0 ${topCenter} H ${halfConn}`);
    paths.push(`M 0 ${botCenter} H ${halfConn}`);
    paths.push(`M ${halfConn} ${topCenter} V ${botCenter}`);
    paths.push(`M ${halfConn} ${midY} H ${CONN_WIDTH}`);
  }

  return (
    <div style={{ width: CONN_WIDTH }}>
      {/* Spacer matching sticky header */}
      <div className="text-xs py-2 px-1 border-b bg-muted/50" style={{ visibility: "hidden" }}>&nbsp;</div>
      <svg
        width={CONN_WIDTH}
        height={containerHeight}
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
  roundPositionMap: Map<string, Match>,
  playerById: Map<string, Player>
): Player | null {
  if (match.round === 1) {
    return slot === 1 ? match.player1 : match.player2;
  }
  const prevRound = match.round - 1;
  const basePos = (match.position - 1) * 2 + (slot === 1 ? 1 : 2);
  const feederMatch = roundPositionMap.get(`${prevRound}-${basePos}`);
  if (!feederMatch) return null;

  // Decided feeder → show who actually advanced
  if (feederMatch.winnerId && feederMatch.winner) {
    return feederMatch.winner;
  }

  // Otherwise show whoever the user picked to win the feeder match — even if
  // that player has since been eliminated (so we never fall back to "TBD" when
  // a pick exists). Eliminated picks are styled as struck-through downstream.
  const pickedId = picks[feederMatch.id];
  if (!pickedId) return null;
  return playerById.get(pickedId) ?? null;
}

// A named but undecided qualifier/lucky-loser slot — shown for visibility,
// not a real pick.
function isPendingQualifier(player: Player | null): boolean {
  return player?.name === PENDING_QUALIFIER_NAME;
}

// ─── BracketMatch ─────────────────────────────────────────────────────────────

type BracketMatchProps = {
  match: Match;
  pickedId: string | undefined;
  pickedPlayer: Player | null;
  points: number | undefined;
  upsetMultiplier: number;
  exactMatchup: boolean;
  eliminatedIds: Set<string>;
  onPick: (matchId: string, playerId: string) => void;
  isReadOnly: boolean;
};

function BracketMatch({ match, pickedId, pickedPlayer, points, upsetMultiplier, exactMatchup, eliminatedIds, onPick, isReadOnly }: BracketMatchProps) {
  const isCompleted = !!match.winnerId;
  const isCorrectPick = isCompleted && pickedId === match.winnerId;
  const isWrongPick = isCompleted && !!pickedId && pickedId !== match.winnerId;

  // Upset bonus for display — same shared math and exact-matchup rule as the
  // server-side leaderboard scoring.
  let upsetBonus = 0;
  if (isCorrectPick && points && upsetMultiplier > 0 && exactMatchup && match.winnerId) {
    upsetBonus =
      Math.round(
        calcUpsetBonus(
          match.player1?.seed ?? null,
          match.player2?.seed ?? null,
          match.winnerId,
          match.player1?.id ?? null,
          points,
          upsetMultiplier
        ) * 10
      ) / 10;
  }
  const showPickHeader = !!pickedId && isCompleted;

  return (
    <div className={cn(
      "flex flex-col border rounded-lg overflow-hidden shadow-sm bg-card mx-1",
      isCorrectPick && "border-green-300 dark:border-green-700",
      isWrongPick && "border-red-200 dark:border-red-800",
    )}>
      {showPickHeader && (
        <div
          className={cn(
            "flex items-center gap-1 px-2 text-[10px] font-semibold",
            isCorrectPick && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
            isWrongPick && "bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          )}
          style={{ height: PICK_HEADER_HEIGHT }}
        >
          <span className="truncate flex-1">
            My Pick:{" "}
            {pickedPlayer?.seed && <span className="opacity-70">{pickedPlayer.seed} </span>}
            {pickedPlayer?.name ?? "Unknown"}
          </span>
          {isCorrectPick && <Check className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />}
          {isWrongPick && <X className="h-3 w-3 text-red-500 dark:text-red-400 shrink-0" />}
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
        isEliminated={!isCompleted && !!match.player1 && eliminatedIds.has(match.player1.id)}
        isReadOnly={isReadOnly || !match.player1 || isPendingQualifier(match.player1)}
        onPick={() => match.player1 && onPick(match.id, match.player1.id)}
      />
      <div className="h-px bg-border" />
      <MatchSlot
        player={match.player2}
        isWinner={match.winnerId === match.player2?.id}
        isCompleted={isCompleted}
        isPicked={!isCompleted && pickedId === match.player2?.id}
        isEliminated={!isCompleted && !!match.player2 && eliminatedIds.has(match.player2.id)}
        isReadOnly={isReadOnly || !match.player2 || isPendingQualifier(match.player2)}
        onPick={() => match.player2 && onPick(match.id, match.player2.id)}
      />

      {isCorrectPick && points && (
        <div className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-[10px] font-bold text-center py-0.5">
          +{points + upsetBonus} PTS{upsetBonus > 0 && ` (${points} + ${upsetBonus} upset)`}
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
  isEliminated: boolean;
  isReadOnly: boolean;
  onPick: () => void;
};

function MatchSlot({ player, isWinner, isCompleted, isPicked, isEliminated, isReadOnly, onPick }: MatchSlotProps) {
  const isLoser = isCompleted && !isWinner;
  const isPending = isPendingQualifier(player);

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
        isPicked && !isEliminated && "bg-primary/15 font-semibold",
        isWinner && "font-semibold",
        isLoser && "opacity-40 text-muted-foreground",
        // Projected pick whose player is already knocked out — show but mark dead
        isEliminated && "opacity-50 text-muted-foreground line-through",
        // Informational placeholder, not a real contender — no seed/flag/pick affordance
        isPending && "italic text-muted-foreground",
      )}
    >
      {player.seed ? (
        <span className="text-muted-foreground shrink-0 w-4 text-right text-[11px]">
          {player.seed}
        </span>
      ) : null}
      <span className={cn("truncate flex-1 text-xs", isWinner && "text-green-800 dark:text-green-400")}>{player.name}</span>
      {!isPending && player.nationality && (
        <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
          {player.nationality}
        </span>
      )}
      {isWinner && <Check className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />}
      {isEliminated && <X className="h-3 w-3 text-muted-foreground shrink-0" />}
      {isPicked && !isCompleted && !isEliminated && (
        <span className="h-2 w-2 rounded-full bg-primary inline-block shrink-0" />
      )}
    </button>
  );
}

/**
 * Official usopen.org draw feed.
 *
 * Replaces the RapidAPI TennisApi (Sofascore) integration — its draw tree
 * was missing real, already-published players (e.g. Popyrin) and never
 * carried tournament seed numbers at all. This feed is the tournament's own
 * live scoreboard data source: includes seeds and nationality per player,
 * and needs no API key. Slots whose real occupant (qualifier/lucky loser)
 * isn't decided yet come through explicitly labeled (`entryStatus: "Q/LL"`)
 * rather than silently blank — see PENDING_QUALIFIER_NAME handling below.
 *
 * Only US Open is wired up so far — the other majors run on their own sites
 * (ausopen.com, rolandgarros.com, wimbledon.com) with unconfirmed feed
 * shapes; fetchDrawFeed throws a clear error for them until someone adds
 * their feeds here.
 */

import { Major, Gender } from "@/generated/prisma/client";
import { PENDING_QUALIFIER_NAME } from "@/lib/constants";

// Shared externalId for the single placeholder Player row representing any
// still-undecided qualifier/lucky-loser slot — every such slot points at the
// same row until the real player is known and a re-import overwrites it.
const PENDING_QUALIFIER_EXTERNAL_ID = "pending-qualifier";

// A plain fetch gets blocked by Akamai bot protection on usopen.org; a
// browser-like UA is enough to pass.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// draws feed round codes -> our round numbers (see ROUND_NAMES in constants.ts)
const ROUND_CODE_TO_NUMBER: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  Q: 5,
  S: 6,
  F: 7,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type DrawPlayer = {
  externalId: string;
  name: string;
  nationality: string | null;
  seed: number | null;
};

export type DrawMatch = {
  round: number;
  position: number;
  player1: DrawPlayer | null;
  player2: DrawPlayer | null;
};

export type DrawImportResult = {
  players: DrawPlayer[];
  matches: DrawMatch[];
};

export type MatchResult = {
  round: number;
  position: number;
  winnerExternalId: string;
};

export type ScheduledMatch = {
  round: number;
  position: number;
  finished: boolean;
  inProgress: boolean;
  scheduledAt: Date | null;
};

// ─── Draw feed (shared by draw import + result sync) ─────────────────────────

type UsOpenTeamMember = {
  firstNameA: string | null;
  lastNameA: string | null;
  idA: string | null;
  nationA: string | null;
  seed: number | null;
  entryStatus: string | null;
};

type UsOpenMatch = {
  match_id: string;
  roundCode: string;
  statusCode: string;
  winner: string | null; // "1" | "2" | null — inferred, unverified against a real completed match
  epoch: number | null;
  team1: UsOpenTeamMember;
  team2: UsOpenTeamMember;
};

type UsOpenDrawFeed = {
  matches: UsOpenMatch[];
};

/**
 * Fetch the current draw feed — one call returns every round's matchups,
 * seeds, and (once played) winners, so this single response backs
 * fetchTournamentDraw, fetchMatchResults, fetchDrawSchedule, and
 * fetchSlotCompetitors below.
 */
async function fetchDrawFeed(major: Major, gender: Gender, year: number): Promise<UsOpenDrawFeed> {
  if (major !== "US_OPEN") {
    throw new Error(`${major} isn't wired up to an official draw feed yet — only US Open is currently supported.`);
  }

  const eventCode = gender === "MENS" ? "MS" : "WS";
  const url = `https://www.usopen.org/en_US/scores/feeds/${year}/draws/${eventCode}.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_USER_AGENT },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`US Open draw feed error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function matchPosition(matchId: string): number {
  return Number(matchId.slice(-2));
}

function teamToPlayer(t: UsOpenTeamMember): DrawPlayer | null {
  // Undecided qualifier/lucky-loser slot — surface it as a named, visible
  // placeholder (not pickable, see MatchSlot) rather than a bare blank.
  if (t.entryStatus === "Q/LL") {
    return {
      externalId: PENDING_QUALIFIER_EXTERNAL_ID,
      name: PENDING_QUALIFIER_NAME,
      nationality: null,
      seed: null,
    };
  }

  if (!t.idA || !t.lastNameA) return null;
  return {
    externalId: t.idA,
    name: t.firstNameA ? `${t.firstNameA} ${t.lastNameA}` : t.lastNameA,
    nationality: t.nationA || null,
    seed: t.seed ?? null,
  };
}

// ─── Draw import ─────────────────────────────────────────────────────────────

export async function fetchTournamentDraw(
  major: Major,
  gender: Gender,
  year: number
): Promise<DrawImportResult> {
  const feed = await fetchDrawFeed(major, gender, year);

  const players = new Map<string, DrawPlayer>();
  const matches: DrawMatch[] = [];

  for (const m of feed.matches) {
    const round = ROUND_CODE_TO_NUMBER[m.roundCode];
    if (!round) continue;

    const player1 = teamToPlayer(m.team1);
    const player2 = teamToPlayer(m.team2);

    if (player1) players.set(player1.externalId, player1);
    if (player2) players.set(player2.externalId, player2);

    matches.push({ round, position: matchPosition(m.match_id), player1, player2 });
  }

  matches.sort((a, b) => a.round - b.round || a.position - b.position);

  return { players: Array.from(players.values()), matches };
}

// ─── Match results sync ──────────────────────────────────────────────────────

export async function fetchMatchResults(
  major: Major,
  gender: Gender,
  year: number
): Promise<MatchResult[]> {
  const feed = await fetchDrawFeed(major, gender, year);
  const results: MatchResult[] = [];

  for (const m of feed.matches) {
    const round = ROUND_CODE_TO_NUMBER[m.roundCode];
    if (!round) continue;

    const winnerTeam = m.winner === "1" ? m.team1 : m.winner === "2" ? m.team2 : null;
    const winnerExternalId = winnerTeam ? teamToPlayer(winnerTeam)?.externalId : undefined;
    if (!winnerExternalId) continue;

    results.push({ round, position: matchPosition(m.match_id), winnerExternalId });
  }

  return results;
}

/**
 * Fetch every match's schedule/completion state, including matches that
 * haven't been played yet — unlike fetchMatchResults, which only returns
 * finished ones. Used to detect when a day's play is actually over, so the
 * digest can fire the same night instead of waiting for a fixed fallback
 * time.
 *
 * `epoch` is null before a match starts in every response seen so far; this
 * assumes it becomes a real timestamp once play begins, matching common
 * IBM SlamTracker feed behavior across majors. Unverified against a live
 * match — worth a sanity check once the tournament is actually underway.
 */
export async function fetchDrawSchedule(
  major: Major,
  gender: Gender,
  year: number
): Promise<ScheduledMatch[]> {
  const feed = await fetchDrawFeed(major, gender, year);
  const matches: ScheduledMatch[] = [];

  for (const m of feed.matches) {
    const round = ROUND_CODE_TO_NUMBER[m.roundCode];
    if (!round) continue;

    const finished = m.winner === "1" || m.winner === "2";
    matches.push({
      round,
      position: matchPosition(m.match_id),
      finished,
      inProgress: !finished && m.epoch != null,
      scheduledAt: m.epoch ? new Date(m.epoch * 1000) : null,
    });
  }

  return matches;
}

// ─── Single-slot lookup (for player replacement) ─────────────────────────────

/**
 * Fetch the players currently occupying a specific draw slot (round + position)
 * from the official feed. Used to detect a lucky-loser replacement after a
 * withdrawal.
 */
export async function fetchSlotCompetitors(
  major: Major,
  gender: Gender,
  year: number,
  round: number,
  position: number
): Promise<DrawPlayer[]> {
  const feed = await fetchDrawFeed(major, gender, year);

  const match = feed.matches.find(
    (m) => ROUND_CODE_TO_NUMBER[m.roundCode] === round && matchPosition(m.match_id) === position
  );
  if (!match) {
    throw new Error("Slot not found in the published draw");
  }

  return [match.team1, match.team2]
    .map(teamToPlayer)
    .filter((p): p is DrawPlayer => p !== null);
}

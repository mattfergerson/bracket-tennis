/**
 * TennisApi (RapidAPI, by fluis.lacasse) integration
 * https://rapidapi.com/fluis.lacasse/api/tennisapi1
 *
 * Replaces the Sportradar trial integration (key expired, renewal
 * unanswered). This provider wraps Sofascore-sourced data.
 *
 * Provides Grand Slam draw import and live match result syncing.
 */

import { Major, Gender } from "@/generated/prisma/client";

const BASE_URL = "https://tennisapi1.p.rapidapi.com/api/tennis";
const API_HOST = "tennisapi1.p.rapidapi.com";
const API_KEY = process.env.RAPIDAPI_KEY ?? "";

// TennisApi (Sofascore) unique-tournament IDs for Grand Slam singles draws
const TOURNAMENT_IDS: Record<Major, Record<Gender, number>> = {
  AUSTRALIAN_OPEN: { MENS: 2363, WOMENS: 2571 },
  FRENCH_OPEN:     { MENS: 2480, WOMENS: 2577 },
  WIMBLEDON:       { MENS: 2361, WOMENS: 2600 },
  US_OPEN:         { MENS: 2449, WOMENS: 2601 },
};

async function fetchFromApi(path: string, attempt = 0) {
  if (!API_KEY) throw new Error("RAPIDAPI_KEY not configured");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-rapidapi-host": API_HOST, "x-rapidapi-key": API_KEY },
    next: { revalidate: 300 },
  });

  if (res.status === 429) {
    // Free tier allows 4 req/sec — back off and retry a few times before
    // giving up, so back-to-back syncs (e.g. men's + women's) don't drop one.
    if (attempt < 4) {
      await delay(750);
      return fetchFromApi(path, attempt + 1);
    }
    throw new Error("TennisApi rate limit exceeded");
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`TennisApi error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

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

// ─── Cup tree (shared by draw import + result sync) ──────────────────────────

type CupTreeParticipant = {
  order: number;
  winner?: boolean;
  teamSeed?: string | null;
  team: { id: number; name: string };
};

type CupTreeBlock = {
  order: number;
  finished: boolean;
  eventInProgress?: boolean;
  seriesStartDateTimestamp?: number | null;
  participants: CupTreeParticipant[];
};

type CupTreeRound = {
  order: number;
  blocks: CupTreeBlock[];
};

type CupTreeResponse = {
  cupTrees: Array<{ rounds: CupTreeRound[] }>;
};

async function findSeasonId(major: Major, gender: Gender, year: number): Promise<number> {
  const tournamentId = TOURNAMENT_IDS[major][gender];
  const data = await fetchFromApi(`/tournament/${tournamentId}/seasons`);

  const season = data.seasons?.find(
    (s: { year: string }) => s.year === String(year)
  );

  if (!season) {
    throw new Error(`No ${year} season found for ${major} ${gender}`);
  }

  return season.id;
}

/**
 * Fetch the current draw tree — one call returns every round's matchups,
 * seeds, and (once played) winners, so this single response backs both
 * fetchTournamentDraw and fetchMatchResults below.
 */
async function fetchCupTree(major: Major, gender: Gender, year: number): Promise<CupTreeRound[]> {
  const tournamentId = TOURNAMENT_IDS[major][gender];
  const seasonId = await findSeasonId(major, gender, year);

  const data: CupTreeResponse | null = await fetchFromApi(
    `/tournament/${tournamentId}/season/${seasonId}/cup-trees/old`
  );

  if (!data?.cupTrees?.[0]) {
    throw new Error("Main draw not found — it may not be published yet");
  }

  return data.cupTrees[0].rounds;
}

function participantToPlayer(p: CupTreeParticipant): DrawPlayer {
  const seed =
    p.teamSeed && /^\d+$/.test(p.teamSeed) ? Number(p.teamSeed) : null;

  return {
    externalId: String(p.team.id),
    name: p.team.name,
    nationality: null, // backfilled separately — see backfillNationalities
    seed,
  };
}

/**
 * The draw tree doesn't include nationality, so fetch it per player from the
 * team-detail endpoint. Best-effort: a failed lookup leaves nationality null
 * rather than failing the whole import. Paced well under the Pro plan's
 * 6 req/sec cap (existing 429 retry in fetchFromApi is the backstop).
 */
async function backfillNationalities(players: DrawPlayer[]): Promise<void> {
  const CONCURRENCY = 4;
  let index = 0;

  async function worker() {
    while (index < players.length) {
      const player = players[index++];
      try {
        const data = await fetchFromApi(`/team/${player.externalId}`);
        player.nationality = data?.team?.country?.alpha3 ?? null;
      } catch {
        player.nationality = null;
      }
      await delay(600);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ─── Draw import ─────────────────────────────────────────────────────────────

export async function fetchTournamentDraw(
  major: Major,
  gender: Gender,
  year: number
): Promise<DrawImportResult> {
  const rounds = await fetchCupTree(major, gender, year);

  const players = new Map<string, DrawPlayer>();
  const matches: DrawMatch[] = [];

  for (const round of rounds) {
    for (const block of round.blocks) {
      const home = block.participants.find((p) => p.order === 1) ?? null;
      const away = block.participants.find((p) => p.order === 2) ?? null;

      const p1 = home ? participantToPlayer(home) : null;
      const p2 = away ? participantToPlayer(away) : null;

      if (p1) players.set(p1.externalId, p1);
      if (p2) players.set(p2.externalId, p2);

      matches.push({ round: round.order, position: block.order, player1: p1, player2: p2 });
    }
  }

  matches.sort((a, b) => a.round - b.round || a.position - b.position);

  const playerList = Array.from(players.values());
  await backfillNationalities(playerList);

  return { players: playerList, matches };
}

// ─── Match results sync ──────────────────────────────────────────────────────

export async function fetchMatchResults(
  major: Major,
  gender: Gender,
  year: number
): Promise<MatchResult[]> {
  const rounds = await fetchCupTree(major, gender, year);
  const results: MatchResult[] = [];

  for (const round of rounds) {
    for (const block of round.blocks) {
      if (!block.finished) continue;

      const winner = block.participants.find((p) => p.winner);
      if (!winner) continue;

      results.push({
        round: round.order,
        position: block.order,
        winnerExternalId: String(winner.team.id),
      });
    }
  }

  return results;
}

/**
 * Fetch every match's schedule/completion state, including matches that
 * haven't been played yet — unlike fetchMatchResults, which only returns
 * finished ones. Used to detect when a day's play is actually over, so the
 * digest can fire the same night instead of waiting for a fixed fallback
 * time. Costs its own cup-tree fetch (separate from fetchMatchResults'),
 * traded for keeping the two call sites simple and independent.
 */
export async function fetchDrawSchedule(
  major: Major,
  gender: Gender,
  year: number
): Promise<ScheduledMatch[]> {
  const rounds = await fetchCupTree(major, gender, year);
  const matches: ScheduledMatch[] = [];

  for (const round of rounds) {
    for (const block of round.blocks) {
      matches.push({
        round: round.order,
        position: block.order,
        finished: block.finished,
        inProgress: block.eventInProgress ?? false,
        scheduledAt: block.seriesStartDateTimestamp
          ? new Date(block.seriesStartDateTimestamp * 1000)
          : null,
      });
    }
  }

  return matches;
}

// ─── Single-slot lookup (for player replacement) ─────────────────────────────

/**
 * Fetch the players currently occupying a specific draw slot (round + position)
 * from TennisApi. Used to detect a lucky-loser replacement after a withdrawal.
 */
export async function fetchSlotCompetitors(
  major: Major,
  gender: Gender,
  year: number,
  round: number,
  position: number
): Promise<DrawPlayer[]> {
  const rounds = await fetchCupTree(major, gender, year);

  const targetRound = rounds.find((r) => r.order === round);
  const block = targetRound?.blocks.find((b) => b.order === position);

  if (!block) {
    throw new Error("Slot not found in the published draw");
  }

  return block.participants.map(participantToPlayer);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Exported constants for admin UI ─────────────────────────────────────────

export { TOURNAMENT_IDS as COMPETITION_IDS };

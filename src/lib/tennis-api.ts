/**
 * Sportradar Tennis API v3 Integration
 * Docs: https://developer.sportradar.com/tennis/docs/ig-api-basics
 *
 * Provides Grand Slam draw import and live match result syncing.
 */

import { Major, Gender } from "@/generated/prisma/client";

const BASE_URL = "https://api.sportradar.com/tennis/trial/v3/en";
const API_KEY = process.env.SPORTRADAR_API_KEY ?? "";

// Sportradar competition IDs for Grand Slam singles draws
const COMPETITION_IDS: Record<Major, Record<Gender, string>> = {
  AUSTRALIAN_OPEN: { MENS: "sr:competition:2567", WOMENS: "sr:competition:2571" },
  FRENCH_OPEN:     { MENS: "sr:competition:2579", WOMENS: "sr:competition:2583" },
  WIMBLEDON:       { MENS: "sr:competition:2555", WOMENS: "sr:competition:2559" },
  US_OPEN:         { MENS: "sr:competition:2591", WOMENS: "sr:competition:2595" },
};

// Map Sportradar round names to our 1-7 round numbers
const ROUND_MAP: Record<string, number> = {
  round_of_128: 1,
  round_of_64: 2,
  round_of_32: 3,
  round_of_16: 4,
  quarterfinal: 5,
  semifinal: 6,
  final: 7,
};

async function fetchFromApi(path: string) {
  if (!API_KEY) throw new Error("SPORTRADAR_API_KEY not configured");

  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}api_key=${API_KEY}`;
  const res = await fetch(url, { next: { revalidate: 300 } });

  if (res.status === 429) {
    throw new Error("Sportradar API rate limit exceeded (1 req/sec on trial)");
  }
  if (!res.ok) {
    throw new Error(`Sportradar API error: ${res.status} ${res.statusText}`);
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

// ─── Season lookup ───────────────────────────────────────────────────────────

async function findSeasonId(major: Major, gender: Gender, year: number): Promise<string> {
  const competitionId = COMPETITION_IDS[major][gender];
  const data = await fetchFromApi(`/competitions/${competitionId}/seasons.json`);

  const season = data.seasons?.find(
    (s: { year: string }) => s.year === String(year)
  );

  if (!season) {
    throw new Error(`No ${year} season found for ${major} ${gender}`);
  }

  return season.id;
}

// ─── Draw import ─────────────────────────────────────────────────────────────

type CupRound = {
  name: string;
  order: number;
  state: string;
  winner_id?: string;
  sport_events?: Array<{ id: string }>;
  linked_cup_rounds?: Array<{ id: string }>;
};

type StageGroup = {
  id: string;
  group_name: string;
  cup_rounds: CupRound[];
};

type Stage = {
  phase: string;
  type: string;
  groups: StageGroup[];
};

type Competitor = {
  id: string;
  name: string;
  country?: string;
  country_code?: string;
  seed?: number;
  bracket_number?: number;
  qualifier?: string;
};

type SportEventSummary = {
  sport_event: {
    competitors: Competitor[];
  };
  sport_event_status: {
    status: string;
    winner_id?: string;
  };
};

export async function fetchTournamentDraw(
  major: Major,
  gender: Gender,
  year: number
): Promise<DrawImportResult> {
  const seasonId = await findSeasonId(major, gender, year);

  // Small delay to respect 1 req/sec trial limit
  await delay(1100);

  const data = await fetchFromApi(
    `/seasons/${seasonId}/stages_groups_cup_rounds.json`
  );

  // Find the main draw stage (not qualification)
  const mainStage = (data.stages as Stage[])?.find(
    (s) => s.phase !== "qualification"
  );

  if (!mainStage?.groups?.[0]) {
    throw new Error("Main draw not found — it may not be published yet");
  }

  const cupRounds = mainStage.groups[0].cup_rounds;

  // Group cup_rounds by round name, preserving order
  const roundGroups = new Map<string, CupRound[]>();
  for (const cr of cupRounds) {
    const roundName = cr.name;
    if (!ROUND_MAP[roundName]) continue;
    if (!roundGroups.has(roundName)) roundGroups.set(roundName, []);
    roundGroups.get(roundName)!.push(cr);
  }

  const players = new Map<string, DrawPlayer>();
  const matches: DrawMatch[] = [];
  const eventIdsToFetch: Array<{ eventId: string; round: number; position: number }> = [];

  // Collect all first-round sport events we need to fetch for player details
  for (const [roundName, rounds] of roundGroups) {
    const roundNum = ROUND_MAP[roundName];
    const sorted = rounds.sort((a, b) => a.order - b.order);

    for (let i = 0; i < sorted.length; i++) {
      const cr = sorted[i];
      const position = i + 1;

      if (cr.sport_events?.[0]) {
        eventIdsToFetch.push({
          eventId: cr.sport_events[0].id,
          round: roundNum,
          position,
        });
      } else {
        // Bye — no sport event
        matches.push({ round: roundNum, position, player1: null, player2: null });
      }
    }
  }

  // Fetch sport event summaries to get player info (only for round 1)
  // Later rounds derive players from winners of earlier rounds
  const round1Events = eventIdsToFetch.filter((e) => e.round === 1);

  for (const entry of round1Events) {
    await delay(1100);

    const summary: SportEventSummary = await fetchFromApi(
      `/sport_events/${entry.eventId}/summary.json`
    );

    const competitors = summary.sport_event.competitors;
    const home = competitors.find((c) => c.qualifier === "home");
    const away = competitors.find((c) => c.qualifier === "away");

    const p1 = home ? competitorToPlayer(home) : null;
    const p2 = away ? competitorToPlayer(away) : null;

    if (p1) players.set(p1.externalId, p1);
    if (p2) players.set(p2.externalId, p2);

    matches.push({ round: entry.round, position: entry.position, player1: p1, player2: p2 });
  }

  // For rounds 2-7, create empty match slots (players filled from winners)
  for (const entry of eventIdsToFetch.filter((e) => e.round > 1)) {
    if (!matches.find((m) => m.round === entry.round && m.position === entry.position)) {
      matches.push({ round: entry.round, position: entry.position, player1: null, player2: null });
    }
  }

  // Also create match slots for rounds that may not have sport_events yet
  for (const [roundName, rounds] of roundGroups) {
    const roundNum = ROUND_MAP[roundName];
    if (roundNum === 1) continue;
    const sorted = rounds.sort((a, b) => a.order - b.order);
    for (let i = 0; i < sorted.length; i++) {
      const position = i + 1;
      if (!matches.find((m) => m.round === roundNum && m.position === position)) {
        matches.push({ round: roundNum, position, player1: null, player2: null });
      }
    }
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
  const seasonId = await findSeasonId(major, gender, year);

  await delay(1100);

  const data = await fetchFromApi(
    `/seasons/${seasonId}/stages_groups_cup_rounds.json`
  );

  const mainStage = (data.stages as Stage[])?.find(
    (s) => s.phase !== "qualification"
  );

  if (!mainStage?.groups?.[0]) return [];

  const results: MatchResult[] = [];

  const roundGroups = new Map<string, CupRound[]>();
  for (const cr of mainStage.groups[0].cup_rounds) {
    if (!ROUND_MAP[cr.name]) continue;
    if (!roundGroups.has(cr.name)) roundGroups.set(cr.name, []);
    roundGroups.get(cr.name)!.push(cr);
  }

  for (const [roundName, rounds] of roundGroups) {
    const roundNum = ROUND_MAP[roundName];
    const sorted = rounds.sort((a, b) => a.order - b.order);

    for (let i = 0; i < sorted.length; i++) {
      const cr = sorted[i];
      if (cr.winner_id) {
        results.push({
          round: roundNum,
          position: i + 1,
          winnerExternalId: cr.winner_id,
        });
      }
    }
  }

  return results;
}

// ─── Single-slot lookup (for player replacement) ─────────────────────────────

const ROUND_NAME_BY_NUMBER: Record<number, string> = Object.fromEntries(
  Object.entries(ROUND_MAP).map(([name, num]) => [num, name])
);

/**
 * Fetch the players currently occupying a specific draw slot (round + position)
 * from Sportradar. Used to detect a lucky-loser replacement after a withdrawal.
 */
export async function fetchSlotCompetitors(
  major: Major,
  gender: Gender,
  year: number,
  round: number,
  position: number
): Promise<DrawPlayer[]> {
  const seasonId = await findSeasonId(major, gender, year);
  await delay(1100);

  const data = await fetchFromApi(
    `/seasons/${seasonId}/stages_groups_cup_rounds.json`
  );

  const mainStage = (data.stages as Stage[])?.find(
    (s) => s.phase !== "qualification"
  );
  if (!mainStage?.groups?.[0]) {
    throw new Error("Main draw not found");
  }

  const roundName = ROUND_NAME_BY_NUMBER[round];
  const rounds = mainStage.groups[0].cup_rounds
    .filter((cr) => cr.name === roundName)
    .sort((a, b) => a.order - b.order);

  const cr = rounds[position - 1];
  if (!cr?.sport_events?.[0]) {
    throw new Error("Slot not found in the published draw");
  }

  await delay(1100);
  const summary: SportEventSummary = await fetchFromApi(
    `/sport_events/${cr.sport_events[0].id}/summary.json`
  );

  return summary.sport_event.competitors.map(competitorToPlayer);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function competitorToPlayer(c: Competitor): DrawPlayer {
  return {
    externalId: c.id,
    name: formatPlayerName(c.name),
    nationality: c.country_code ?? c.country ?? null,
    seed: c.seed ?? null,
  };
}

function formatPlayerName(name: string): string {
  // Sportradar returns "Last, First" — convert to "First Last" for display
  if (name.includes(",")) {
    const [last, first] = name.split(",").map((s) => s.trim());
    return `${first} ${last}`;
  }
  return name;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Exported constants for admin UI ─────────────────────────────────────────

export { COMPETITION_IDS };

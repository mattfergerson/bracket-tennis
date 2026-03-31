/**
 * SportsAPI Pro Tennis Integration
 * Docs: https://docs.sportsapipro.com/tennis/introduction
 *
 * Grand Slam Competition IDs:
 *   Australian Open: 510
 *   French Open:     511
 *   Wimbledon:       512
 *   US Open:         513
 */

import { Major } from "@/generated/prisma/client";

const BASE_URL = "https://tennis.sportapi.pro/api/v1";
const API_KEY = process.env.SPORTS_API_KEY ?? "";

export const MAJOR_COMPETITION_IDS: Record<Major, number> = {
  AUSTRALIAN_OPEN: 510,
  FRENCH_OPEN: 511,
  WIMBLEDON: 512,
  US_OPEN: 513,
};

type ApiPlayer = {
  id: number;
  name: string;
  country?: { name: string; alpha3?: string };
};

type ApiMatch = {
  id: number;
  round?: { name?: string; number?: number };
  homeTeam?: ApiPlayer;
  awayTeam?: ApiPlayer;
  winner?: { id: number };
  status?: { type?: string };
};

type ApiDraw = {
  draw?: {
    rounds?: Array<{
      name: string;
      number: number;
      matches: ApiMatch[];
    }>;
  };
};

async function fetchFromApi(path: string) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": API_KEY,
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Tennis API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

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

/**
 * Fetch the tournament draw for a given competition ID and gender.
 * Gender: "M" = men's, "W" = women's
 */
export async function fetchTournamentDraw(
  competitionId: number,
  gender: "M" | "W",
  seasonYear: number
): Promise<DrawImportResult> {
  const data: ApiDraw = await fetchFromApi(
    `/competitions/${competitionId}/seasons/${seasonYear}/draw?gender=${gender}`
  );

  const players = new Map<string, DrawPlayer>();
  const matches: DrawMatch[] = [];

  const rounds = data?.draw?.rounds ?? [];

  for (const round of rounds) {
    const roundNum = round.number;
    round.matches.forEach((match, idx) => {
      const player1 = match.homeTeam
        ? {
            externalId: `${match.homeTeam.id}`,
            name: match.homeTeam.name,
            nationality: match.homeTeam.country?.name ?? null,
            seed: null,
          }
        : null;

      const player2 = match.awayTeam
        ? {
            externalId: `${match.awayTeam.id}`,
            name: match.awayTeam.name,
            nationality: match.awayTeam.country?.name ?? null,
            seed: null,
          }
        : null;

      if (player1) players.set(player1.externalId, player1);
      if (player2) players.set(player2.externalId, player2);

      matches.push({
        round: roundNum,
        position: idx + 1,
        player1: player1,
        player2: player2,
      });
    });
  }

  return {
    players: Array.from(players.values()),
    matches,
  };
}

/**
 * Fetch completed match results for a given season/competition.
 */
export async function fetchMatchResults(
  competitionId: number,
  seasonYear: number
): Promise<Array<{ round: number; position: number; winnerId: string }>> {
  const data: ApiDraw = await fetchFromApi(
    `/competitions/${competitionId}/seasons/${seasonYear}/draw`
  );

  const results: Array<{ round: number; position: number; winnerId: string }> = [];

  const rounds = data?.draw?.rounds ?? [];

  for (const round of rounds) {
    round.matches.forEach((match, idx) => {
      if (match.winner?.id) {
        results.push({
          round: round.number,
          position: idx + 1,
          winnerId: `${match.winner.id}`,
        });
      }
    });
  }

  return results;
}

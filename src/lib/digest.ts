import { prisma } from "@/lib/prisma";
import { getTournamentLeaderboard } from "@/lib/scoring";
import { isExactMatchup } from "@/lib/upset";
import { Gender } from "@/generated/prisma/client";

const UNSEEDED = 33;

export type StandingEntry = {
  userId: string;
  username: string;
  score: number;
  rank: number;
  scoreDelta: number;
  rankChange: number; // positive = moved up
  maxPossibleScore: number;
  stillInContention: boolean;
  correctPicks: number;
  pendingPicks: number;
};

export type UpsetEntry = {
  round: number;
  winnerName: string;
  winnerSeed: number | null;
  loserName: string;
  loserSeed: number | null;
  gender: Gender;
  calledBy: string[]; // usernames who picked the winner
};

export type CriticalPlayer = {
  name: string;
  seed: number | null;
  gender: Gender;
  pointsRiding: number;
  backers: number;
};

export type ChampionPick = {
  username: string;
  gender: Gender;
  playerName: string | null;
  alive: boolean;
};

export type DigestData = {
  standings: StandingEntry[];
  playerOfTheDay: { username: string; scoreDelta: number } | null;
  matchesCompletedToday: number;
  notableUpsets: UpsetEntry[];
  criticalPlayers: CriticalPlayer[];
  champions: ChampionPick[];
  leaderScore: number;
};

function seedOf(seed: number | null | undefined): number {
  return seed ?? UNSEEDED;
}

/**
 * Compute group-wide analytics for a tournament's daily digest.
 * Returns a structured blob that is stored and rendered, and fed to the
 * narrative generator.
 */
export async function computeDigestData(
  tournamentId: string,
  asOfDate?: Date
): Promise<DigestData> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      pointConfigs: true,
      draws: {
        include: {
          matches: {
            include: { player1: true, player2: true, winner: true },
          },
          brackets: {
            include: {
              user: { select: { id: true, username: true } },
              picks: { include: { match: true, pickedPlayer: true } },
            },
          },
        },
      },
    },
  });

  if (!tournament) throw new Error("Tournament not found");

  const pointsByRound = new Map<number, number>(
    tournament.pointConfigs.map((pc) => [pc.round, pc.points])
  );

  // Current scores (advancement + upset) from the canonical leaderboard
  const leaderboard = await getTournamentLeaderboard(tournamentId);
  const leaderScore = leaderboard[0]?.score ?? 0;

  // Snapshots from before the target date, for day-over-day deltas
  const targetDate = asOfDate ?? ptDateOnly(new Date());
  const priorSnapshots = await prisma.dailySnapshot.findMany({
    where: { tournamentId, date: { lt: targetDate } },
    orderBy: { date: "desc" },
  });
  const yesterdayByUser = new Map<string, { score: number; rank: number }>();
  for (const snap of priorSnapshots) {
    if (!yesterdayByUser.has(snap.userId)) {
      yesterdayByUser.set(snap.userId, { score: snap.score, rank: snap.rank });
    }
  }

  // Eliminated players per draw
  const eliminatedByDraw = new Map<string, Set<string>>();
  for (const draw of tournament.draws) {
    const elim = new Set<string>();
    for (const m of draw.matches) {
      if (m.winnerId) {
        if (m.player1Id && m.player1Id !== m.winnerId) elim.add(m.player1Id);
        if (m.player2Id && m.player2Id !== m.winnerId) elim.add(m.player2Id);
      }
    }
    eliminatedByDraw.set(draw.id, elim);
  }

  // Max possible score + critical players + champions
  const maxBonusByUser = new Map<string, number>();
  const criticalMap = new Map<
    string,
    { name: string; seed: number | null; gender: Gender; pointsRiding: number; backers: Set<string> }
  >();
  const champions: ChampionPick[] = [];

  for (const draw of tournament.draws) {
    const elim = eliminatedByDraw.get(draw.id)!;

    for (const bracket of draw.brackets) {
      const userId = bracket.user.id;

      for (const pick of bracket.picks) {
        const round = pick.match.round;
        const pts = pointsByRound.get(round) ?? 0;
        const playerAlive = !elim.has(pick.pickedPlayerId);

        // Champion pick (final round)
        if (round === 7) {
          champions.push({
            username: bracket.user.username,
            gender: draw.gender,
            playerName: pick.pickedPlayer.name,
            alive: playerAlive,
          });
        }

        // Undecided + still-alive picks contribute to max possible & critical players
        if (pick.match.winnerId === null && playerAlive) {
          maxBonusByUser.set(userId, (maxBonusByUser.get(userId) ?? 0) + pts);

          const key = `${draw.gender}:${pick.pickedPlayerId}`;
          const existing = criticalMap.get(key);
          if (existing) {
            existing.pointsRiding += pts;
            existing.backers.add(userId);
          } else {
            criticalMap.set(key, {
              name: pick.pickedPlayer.name,
              seed: pick.pickedPlayer.seed ?? null,
              gender: draw.gender,
              pointsRiding: pts,
              backers: new Set([userId]),
            });
          }
        }
      }
    }
  }

  // Build standings with deltas
  const standings: StandingEntry[] = leaderboard.map((entry, idx) => {
    const prior = yesterdayByUser.get(entry.userId);
    const maxPossible =
      Math.round((entry.score + (maxBonusByUser.get(entry.userId) ?? 0)) * 10) / 10;
    return {
      userId: entry.userId,
      username: entry.username,
      score: entry.score,
      rank: idx + 1,
      scoreDelta: prior ? Math.round((entry.score - prior.score) * 10) / 10 : 0,
      rankChange: prior ? prior.rank - (idx + 1) : 0,
      maxPossibleScore: maxPossible,
      stillInContention: maxPossible >= leaderScore,
      correctPicks: entry.correctPicks,
      pendingPicks: entry.pendingPicks,
    };
  });

  const playerOfTheDay =
    standings.length > 0
      ? standings.reduce((best, s) => (s.scoreDelta > best.scoreDelta ? s : best))
      : null;

  // Notable upsets + results since the prior digest
  const priorDigest = await prisma.dailyDigest.findFirst({
    where: { tournamentId, date: { lt: targetDate } },
    orderBy: { date: "desc" },
  });
  const since = priorDigest?.createdAt ?? new Date(0);

  // Map matchId -> usernames who picked the winner (for "called by"). Same
  // rule as the upset bonus: credit only users whose bracket predicted this
  // exact matchup (their feeder picks are the two players who actually met).
  const winnerPickers = new Map<string, string[]>();
  for (const draw of tournament.draws) {
    const matchByPos = new Map(
      draw.matches.map((m) => [`${m.round}-${m.position}`, m])
    );
    for (const bracket of draw.brackets) {
      const pickByMatch = new Map(
        bracket.picks.map((p) => [p.matchId, p.pickedPlayerId])
      );
      for (const pick of bracket.picks) {
        const m = pick.match;
        if (!m.winnerId || pick.pickedPlayerId !== m.winnerId) continue;

        let exact = m.round === 1;
        if (!exact) {
          const feeder1 = matchByPos.get(`${m.round - 1}-${m.position * 2 - 1}`);
          const feeder2 = matchByPos.get(`${m.round - 1}-${m.position * 2}`);
          exact = isExactMatchup(
            m.player1Id,
            m.player2Id,
            feeder1 ? pickByMatch.get(feeder1.id) : undefined,
            feeder2 ? pickByMatch.get(feeder2.id) : undefined
          );
        }
        if (!exact) continue;

        const arr = winnerPickers.get(pick.matchId) ?? [];
        arr.push(bracket.user.username);
        winnerPickers.set(pick.matchId, arr);
      }
    }
  }

  let matchesCompletedToday = 0;
  const upsets: UpsetEntry[] = [];
  for (const draw of tournament.draws) {
    for (const m of draw.matches) {
      if (!m.winnerId || !m.completedAt || m.completedAt <= since) continue;
      matchesCompletedToday++;

      const winnerIsP1 = m.winnerId === m.player1Id;
      const winner = winnerIsP1 ? m.player1 : m.player2;
      const loser = winnerIsP1 ? m.player2 : m.player1;
      if (!winner || !loser) continue;

      const wSeed = seedOf(winner.seed);
      const lSeed = seedOf(loser.seed);
      if (wSeed > lSeed) {
        upsets.push({
          round: m.round,
          winnerName: winner.name,
          winnerSeed: winner.seed ?? null,
          loserName: loser.name,
          loserSeed: loser.seed ?? null,
          gender: draw.gender,
          calledBy: winnerPickers.get(m.id) ?? [],
        });
      }
    }
  }
  // Biggest upsets first (largest seed gap), deepest rounds first
  upsets.sort(
    (a, b) =>
      b.round - a.round ||
      (seedOf(b.winnerSeed) - seedOf(b.loserSeed)) -
        (seedOf(a.winnerSeed) - seedOf(a.loserSeed))
  );

  // Top critical players per gender
  const criticalPlayers: CriticalPlayer[] = Array.from(criticalMap.values())
    .map((c) => ({
      name: c.name,
      seed: c.seed,
      gender: c.gender,
      pointsRiding: Math.round(c.pointsRiding * 10) / 10,
      backers: c.backers.size,
    }))
    .filter((c) => c.pointsRiding > 0);

  const topCritical = [
    ...topN(criticalPlayers.filter((c) => c.gender === "MENS"), 4),
    ...topN(criticalPlayers.filter((c) => c.gender === "WOMENS"), 4),
  ];

  return {
    standings,
    playerOfTheDay:
      playerOfTheDay && playerOfTheDay.scoreDelta > 0
        ? { username: playerOfTheDay.username, scoreDelta: playerOfTheDay.scoreDelta }
        : null,
    matchesCompletedToday,
    notableUpsets: upsets.slice(0, 6),
    criticalPlayers: topCritical,
    champions,
    leaderScore,
  };
}

function topN(arr: CriticalPlayer[], n: number): CriticalPlayer[] {
  return [...arr].sort((a, b) => b.pointsRiding - a.pointsRiding).slice(0, n);
}

/** Midnight (PT calendar date) as a Date, for the @db.Date columns. */
export function ptDateOnly(d: Date): Date {
  const pt = new Date(d.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return new Date(Date.UTC(pt.getFullYear(), pt.getMonth(), pt.getDate()));
}

// Paths-to-victory scenario analysis. STRICTLY READ-ONLY (SELECT queries only).
//
// Enumerates every possible outcome of the remaining (undecided) matches in the
// in-progress tournament and computes the final pool standings for each,
// using real picks, the exact-matchup upset-bonus rule (see src/lib/upset.ts),
// and the correct-picks tiebreaker. Prints:
//   1. Current scores recomputed from scratch — MUST match the live leaderboard
//      (if it doesn't, something is wrong; don't trust the projection).
//   2. Each contender's picks on the remaining matches.
//   3. Win counts per member across all scenarios (equally weighted coin flips —
//      NOT real-world probabilities) and a champions-pair breakdown.
//
// Usage:
//   DATABASE_URL="postgres://..." node scripts/paths-to-victory.js
// or put DATABASE_URL in .env.production.local at the repo root.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

if (!process.env.DATABASE_URL) {
  const envFile = path.join(__dirname, "..", ".env.production.local");
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, "utf8").match(/^DATABASE_URL=[\"']?([^\"'\n]+)/m);
    if (m) process.env.DATABASE_URL = m[1];
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set (env var or .env.production.local)");
  process.exit(1);
}

const UNSEEDED = 33;
const r1 = (n) => Math.round(n * 10) / 10;

function upsetBonus(s1, s2, winnerId, p1Id, pts, mult) {
  const a = s1 ?? UNSEEDED, b = s2 ?? UNSEEDED;
  if (a === b) return 0;
  const wIsP1 = winnerId === p1Id;
  const wS = wIsP1 ? a : b, lS = wIsP1 ? b : a;
  return wS > lS ? pts * mult * (wS - lS) : 0;
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const t = (await c.query(`SELECT id, "upsetMultiplier" mult FROM "Tournament" WHERE status='IN_PROGRESS'`)).rows[0];
  const pts = new Map((await c.query(`SELECT round, points FROM "PointConfig" WHERE "tournamentId"=$1`, [t.id])).rows.map((r) => [r.round, r.points]));

  const matches = (await c.query(`
    SELECT m.id, m."drawId", d.gender, m.round, m.position, m."player1Id" p1, m."player2Id" p2, m."winnerId" w,
           pl1.seed s1, pl1.name n1, pl2.seed s2, pl2.name n2
    FROM "Match" m JOIN "Draw" d ON d.id = m."drawId" AND d."tournamentId" = $1
    LEFT JOIN "Player" pl1 ON pl1.id = m."player1Id"
    LEFT JOIN "Player" pl2 ON pl2.id = m."player2Id"`, [t.id])).rows;

  const seed = new Map(), name = new Map();
  for (const m of matches) {
    if (m.p1) { seed.set(m.p1, m.s1); name.set(m.p1, m.n1); }
    if (m.p2) { seed.set(m.p2, m.s2); name.set(m.p2, m.n2); }
  }
  const byPos = new Map(matches.map((m) => [`${m.drawId}:${m.round}-${m.position}`, m]));

  const pickRows = (await c.query(`
    SELECT u.username, b."drawId", bp."matchId", bp."pickedPlayerId" pid
    FROM "BracketPick" bp JOIN "Bracket" b ON b.id = bp."bracketId"
    JOIN "User" u ON u.id = b."userId"
    JOIN "Draw" d ON d.id = b."drawId" AND d."tournamentId" = $1`, [t.id])).rows;
  const users = new Map();
  for (const p of pickRows) {
    if (!users.has(p.username)) users.set(p.username, new Map());
    users.get(p.username).set(p.matchId, p.pid);
  }

  // Exactness: user's feeder picks == actual players of the match
  function exact(u, m, p1, p2) {
    if (m.round === 1) return true;
    const f1 = byPos.get(`${m.drawId}:${m.round - 1}-${m.position * 2 - 1}`);
    const f2 = byPos.get(`${m.drawId}:${m.round - 1}-${m.position * 2}`);
    const k1 = f1 ? u.get(f1.id) : undefined, k2 = f2 ? u.get(f2.id) : undefined;
    return !!p1 && !!p2 && !!k1 && !!k2 &&
      ((k1 === p1 && k2 === p2) || (k1 === p2 && k2 === p1));
  }

  // Base score from decided matches (sanity-check against live leaderboard)
  const base = new Map();
  for (const [un, u] of users) {
    let score = 0, correct = 0;
    for (const m of matches) {
      if (!m.w) continue;
      const pick = u.get(m.id);
      if (pick !== m.w) continue;
      correct++;
      const p = pts.get(m.round) ?? 0;
      score += p;
      if (exact(u, m, m.p1, m.p2)) score += upsetBonus(seed.get(m.p1), seed.get(m.p2), m.w, m.p1, p, t.mult);
    }
    base.set(un, { score: r1(score), correct });
  }
  console.log("BASE (should match live):");
  for (const [un, b] of [...base].sort((a, z) => z[1].score - a[1].score)) console.log(" ", un.padEnd(28), b.score, "correct", b.correct);

  const undecided = matches.filter((m) => !m.w).sort((a, z) => a.round - z.round || a.position - z.position || (a.gender < z.gender ? -1 : 1));
  console.log("\nUNDECIDED:", undecided.map((m) => `${m.gender[0]}R${m.round}p${m.position}`).join(" "));

  // Everyone's picks on undecided matches, best current score first
  console.log("\nPICKS ON REMAINING MATCHES:");
  for (const [un, u] of [...users].sort((a, z) => base.get(z[0]).score - base.get(a[0]).score)) {
    const s = undecided.map((m) => `${m.gender[0]}R${m.round}p${m.position}:${name.get(u.get(m.id)) ?? "-"}`).join("; ");
    console.log(" ", un, "→", s);
  }

  // Enumerate: scenario players/winners overlay
  const wins = new Map([...users.keys()].map((k) => [k, 0]));
  const deadHeats = [];
  const byFinals = new Map(); // "mensChamp|womensChamp" -> Map(poolWinner -> count)
  const scen = { p1: new Map(), p2: new Map(), w: new Map() }; // matchId overlays
  const P1 = (m) => scen.p1.get(m.id) ?? m.p1, P2 = (m) => scen.p2.get(m.id) ?? m.p2;

  function recurse(i) {
    if (i === undecided.length) return score();
    const m = undecided[i];
    for (const winner of [P1(m), P2(m)]) {
      scen.w.set(m.id, winner);
      const nxt = byPos.get(`${m.drawId}:${m.round + 1}-${Math.ceil(m.position / 2)}`);
      const slot = m.position % 2 !== 0 ? scen.p1 : scen.p2;
      if (nxt) slot.set(nxt.id, winner);
      recurse(i + 1);
      if (nxt) slot.delete(nxt.id);
    }
    scen.w.delete(m.id);
  }

  function score() {
    let bestUn = null, best = null;
    const finals = [];
    for (const m of undecided) if (m.round === 7) finals.push(`${m.gender}:${name.get(scen.w.get(m.id))}`);
    const rows = [];
    for (const [un, u] of users) {
      let gain = 0, add = 0;
      for (const m of undecided) {
        const w = scen.w.get(m.id), pick = u.get(m.id);
        if (pick !== w) continue;
        add++;
        const p = pts.get(m.round) ?? 0;
        gain += p;
        if (exact(u, m, P1(m), P2(m))) gain += upsetBonus(seed.get(P1(m)), seed.get(P2(m)), w, P1(m), p, t.mult);
      }
      const b = base.get(un);
      rows.push({ un, score: r1(b.score + gain), correct: b.correct + add });
    }
    rows.sort((a, z) => z.score - a.score || z.correct - a.correct);
    bestUn = rows[0].un; best = rows[0];
    if (rows[1].score === best.score && rows[1].correct === best.correct) deadHeats.push(rows.slice(0, 2).map((r) => r.un).join("="));
    wins.set(bestUn, wins.get(bestUn) + 1);
    const key = finals.sort().join(" | ");
    if (!byFinals.has(key)) byFinals.set(key, new Map());
    const fm = byFinals.get(key);
    fm.set(bestUn, (fm.get(bestUn) ?? 0) + 1);
  }

  recurse(0);

  const total = [...wins.values()].reduce((a, b) => a + b, 0);
  console.log(`\nSCENARIOS: ${total}  (dead heats needing 3rd tiebreak: ${deadHeats.length})`);
  console.log("WIN COUNTS:");
  for (const [un, n] of [...wins].sort((a, z) => z[1] - a[1])) if (n) console.log(" ", un.padEnd(28), n, `(${r1((n / total) * 100)}%)`);

  console.log("\nPOOL WINNER BY CHAMPIONS (womens | mens):");
  for (const [key, fm] of [...byFinals].sort()) {
    const parts = [...fm].sort((a, z) => z[1] - a[1]).map(([un, n]) => `${un}:${n}`).join("  ");
    console.log(" ", key.padEnd(58), parts);
  }

  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });

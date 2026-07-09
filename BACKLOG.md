# Backlog

Post-tournament feedback, bugs, and feature ideas to revisit. Ordered by priority within each section.

## Bugs & Fixes

### 1. Lock time displays in the server's timezone
`src/app/tournaments/[slug]/picks/[gender]/page.tsx` formats `lockAt` with `toLocaleString(..., timeZoneName: "short")` in a server component, so on Vercel users see UTC ("Picks lock Sun, 3:00 AM UTC") instead of their local time. Move that line into a small client component. Bonus: add a countdown timer to lock.

### 2. Picks page "Score" ignores the upset bonus
`bracket-picks-client.tsx` sums only base round points, so the header score won't match the leaderboard for anyone who called an upset. (The duplicated bonus math in `bracket-view.tsx` was consolidated into `src/lib/upset.ts` as part of the exact-matchup fix shipped 2026-07-07 — this item is now just the picks-page header.)

### 3. Server-side pick validation doesn't enforce bracket consistency
`POST /api/tournaments/[id]/picks/[gender]` only validates player-in-match when both players are assigned — never true for rounds 2–7 at pick time. The cascade rule lives entirely in the client, so a crafted request can hedge across rounds or pick a player from the other draw. Fix: for each pick beyond round 1, require the picked player to equal the pick from one of the two feeder matches.

### 4. `maxPossibleScore` on LeaderboardEntry is just the current score
`src/lib/scoring.ts` sets `maxPossibleScore` to the current score; the real computation only exists in `src/lib/digest.ts`. Either compute it properly in `getTournamentLeaderboard` (needed for feature #6 below) or delete the field.

### 5. Admin-username signup backdoor
`POST /api/auth/signup` grants ADMIN and bypasses access approval to whoever signs up with `ADMIN_USERNAME` (default `"admin"`), as long as the name is unclaimed. Gate it on "no ADMIN user exists yet" so it's a one-time bootstrap.

### 6. Winner corrections don't fully un-propagate
Changing/undoing a match winner (`/api/admin/matches/[id]`) only touches the immediate next round; a winner already propagated further downstream leaves stale players. The admin PATCH and sync loop also aren't wrapped in transactions. A re-sync repairs most cases, but worth hardening.

### 7. Hygiene sweep
- Dead code: `Bracket.isLocked` is never read; `BracketPick.isCorrect` is written on every sync but never read (either use it — see perf item — or stop writing it). (`getUserScore` was removed 2026-07-07 with the exact-matchup fix.)
- The `maybeAutoLock` call in the picks POST route is unreachable-in-effect (the locked path already returned 400 above it).
- Stale docs: README and `.env.example` still describe "SportsAPI Pro" / `SPORTS_API_KEY` / competition IDs 510–513; the code uses Sportradar with `SPORTRADAR_API_KEY`.
- Branding drift: invite email says "Tennis Bracket Challenge" from `Ace Picks <noreply@acepicks.app>`; the site says "Slam Bracket".
- Hardcoded `/trial/` tier in `tennis-api.ts` base URL — make it an env var.
- `export const revalidate = 60` on pages that call `auth()` is inert (cookies force dynamic rendering).

### 8. Contention flag ignores potential upset bonuses
`maxPossibleScore` in `src/lib/digest.ts` sums only base round points for alive picks, so `stillInContention` can mark someone eliminated who still has winning scenarios via exact-matchup upset bonuses. Real case (Wimbledon 2026): kgallen showed "eliminated" but had 52/1024 winning scenarios via a Cobolli title (+84 bonus on their exactly-predicted Sinner–Cobolli final alone). Fix: include potential bonuses for alive picks when computing max possible, or compute contention by scenario enumeration.

### 9. Performance headroom (fine at current pool size)
`getTournamentLeaderboard` loads every bracket/pick/match/player relation and recomputes from scratch on every home/tournament/leaderboard render; the leaderboard page does it for all active tournaments. If the pool grows: trust the already-written `isCorrect` flag or persist scores at sync time. Also, the locked tournament page ships every user's full pick set for the All Brackets tab even if it's never opened — could be lazy-loaded.

## Feature Enhancements

### 1. Update bracket navigation UI
The bracket view navigation still needs work. Iterations so far (sliding window, dampened spacing, full tree with scroll) haven't nailed the feel. Revisit the desktop bracket navigation and whitespace handling after the tournament with fresh eyes — possibly study how ESPN/Roland Garros handle round-to-round navigation and collapsing.

### 2. Beer bet tracker
Add a beer bet tracker to the platform — let players record side bets (e.g. "loser buys winner a beer") against each other tied to the tournament outcome, and track who owes what. Pairs naturally with user profile pages (#3).

### 3. User profile pages
No per-user page exists; leaderboard rows aren't links. `DailySnapshot` already stores per-user score *and rank* per day, so a profile with a rank/score-over-time chart, champion picks, upsets they called, and links to their brackets is mostly assembling stored data.

### 4. Email the daily digest
Resend and the Claude narrative already exist, but the digest is only visible on the site. A nightly email to the pool would be a big engagement win mid-tournament.

### 5. Pick distribution on the locked bracket + "today's matches" view
Per match, show how many pool members picked each player ("4/6 on Alcaraz"). A "today" panel of undecided matches with pool splits and points at stake would be the killer active-tournament view.

### 6. Show max-possible score / "eliminated from contention" on the main leaderboard
The digest already computes this; surface it on the leaderboard everyone actually checks. Requires bug #4 first.

### 7. Picks-flow ergonomics
An unsaved-changes warning (`beforeunload`) — navigating away currently discards picks silently — plus a "fill remainder with higher seeds" chalk-fill button. 127 clicks is a real onboarding wall for new pool members.

### 8. Season-long standings
The README promises a global leaderboard, but the page is per-tournament tabs only. Cumulative points across the four slams gives the pool a year-long arc.

## Infrastructure

### 1. Migrate Neon database from Azure to AWS — deadline October 1, 2026
The production Neon Postgres currently runs on Azure (`westus3` region, per the connection host). Move it to an AWS-hosted Neon project before **October 1, 2026**. Expect some code/config changes to ride along (new `DATABASE_URL` in Vercel env vars, possibly SSL/connection-string params; verify `@prisma/adapter-pg` behavior against the new endpoint, then `prisma migrate deploy` + smoke test). Do NOT run the migration while a tournament is active — schedule it for a gap between slams (after the US Open ends, before the deadline).

---

_Add new items below as they come up._

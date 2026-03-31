# Slam Bracket — Tennis Grand Slam Challenge

Pick your winners for every match in all four Grand Slam tournaments (Australian Open, French Open, Wimbledon, US Open). Compete with friends on the leaderboard.

## Features

- **Men's & Women's brackets** for all four Grand Slams
- **Full bracket picks upfront** — fill out all 127 matches before the tournament starts
- **Visual bracket tree** with cascading picks (picking R1 automatically fills R2 slots)
- **Live scoring** — points awarded as match results come in
- **Admin panel** — create tournaments, import draws from API, enter match results
- **Customizable point values** per round
- **Leaderboard** per tournament and globally

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL (Neon recommended) |
| ORM | Prisma 7 |
| Auth | NextAuth.js v5 (Credentials) |
| UI | Tailwind CSS + shadcn/ui |
| Tennis Data | SportsAPI Pro (optional) |

## Setup

### 1. Database

Get a free PostgreSQL database at [neon.tech](https://neon.tech).

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
# PostgreSQL connection string (from Neon or any Postgres provider)
DATABASE_URL="postgresql://user:password@host/bracket-tennis?sslmode=require"

# Generate with: openssl rand -base64 32
AUTH_SECRET="your-secret-here"

# Optional: SportsAPI Pro key for importing draws automatically
# Get at https://docs.sportsapipro.com
SPORTS_API_KEY=""

# The username that gets admin role on first sign-up
ADMIN_USERNAME="admin"
```

### 3. Install & Migrate

```bash
npm install

# Run database migrations
npx prisma migrate dev --name init

# Or in production:
npx prisma migrate deploy
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage Flow

### Admin

1. Sign up with the username configured in `ADMIN_USERNAME` (default: `admin`) — you'll get admin role automatically
2. Go to `/admin` → **New Tournament** → pick the Grand Slam, year, dates, and point values
3. On the tournament management page:
   - Click **Open for Picks** → users can now submit brackets
   - Import the draw: click **Manage Draw** → **Import from API** (requires `SPORTS_API_KEY`) or **Enter Manually** (paste 128-player CSV)
4. When the tournament starts, click **Lock Picks & Start Tournament**
5. As matches complete, go to the draw page and click each match winner

### Users

1. Sign up at `/auth/signup`
2. On the home page, click a tournament's Men's or Women's bracket
3. Click players to pick winners — your picks cascade forward automatically
4. Click **Save Picks** before the tournament starts
5. Track scores on the leaderboard

## Tennis API

The app integrates with [SportsAPI Pro](https://docs.sportsapipro.com/tennis/introduction) to automatically import tournament draws and sync results. Grand Slam competition IDs:

| Tournament | ID |
|---|---|
| Australian Open | 510 |
| French Open | 511 |
| Wimbledon | 512 |
| US Open | 513 |

Without an API key, draws can be entered manually via CSV paste.

## Deployment

Recommended: [Vercel](https://vercel.com) + [Neon](https://neon.tech)

1. Push to GitHub
2. Import into Vercel
3. Add environment variables in Vercel dashboard
4. Run `npx prisma migrate deploy` via Vercel's build command or run it once manually

```bash
# Vercel build command:
npx prisma migrate deploy && next build
```

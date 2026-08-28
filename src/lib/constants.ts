import { Major, TournamentStatus, Gender } from "@/generated/prisma/client";

export const MAJOR_LABELS: Record<Major, string> = {
  AUSTRALIAN_OPEN: "Australian Open",
  FRENCH_OPEN: "French Open",
  WIMBLEDON: "Wimbledon",
  US_OPEN: "US Open",
};

export const MAJOR_SURFACE: Record<Major, string> = {
  AUSTRALIAN_OPEN: "Hard",
  FRENCH_OPEN: "Clay",
  WIMBLEDON: "Grass",
  US_OPEN: "Hard",
};

export const MAJOR_LOCATION: Record<Major, string> = {
  AUSTRALIAN_OPEN: "Melbourne, Australia",
  FRENCH_OPEN: "Paris, France",
  WIMBLEDON: "London, England",
  US_OPEN: "New York, USA",
};

export const MAJOR_COLORS: Record<Major, string> = {
  AUSTRALIAN_OPEN: "bg-blue-600",
  FRENCH_OPEN: "bg-orange-600",
  WIMBLEDON: "bg-green-700",
  US_OPEN: "bg-blue-800",
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  UPCOMING: "Upcoming",
  ACCEPTING_PICKS: "Picks Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const STATUS_COLORS: Record<TournamentStatus, string> = {
  UPCOMING: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  ACCEPTING_PICKS: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  COMPLETED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

export const GENDER_LABELS: Record<Gender, string> = {
  MENS: "Men's",
  WOMENS: "Women's",
};

export const ROUND_NAMES: Record<number, string> = {
  1: "First Round",
  2: "Second Round",
  3: "Third Round",
  4: "Fourth Round",
  5: "Quarterfinals",
  6: "Semifinals",
  7: "Final",
};

export const DEFAULT_POINT_CONFIGS = [
  { round: 1, label: "First Round", points: 1 },
  { round: 2, label: "Second Round", points: 2 },
  { round: 3, label: "Third Round", points: 3 },
  { round: 4, label: "Fourth Round", points: 5 },
  { round: 5, label: "Quarterfinals", points: 8 },
  { round: 6, label: "Semifinals", points: 13 },
  { round: 7, label: "Final", points: 21 },
];

export const TOTAL_ROUNDS = 7;
export const PLAYERS_PER_DRAW = 128;

// Placeholder player name written in for a draw slot whose real occupant
// (qualifier or lucky loser) hasn't been decided yet. Shared between the
// import layer (which writes it) and the bracket UI (which reads it to keep
// the slot informational-only, not pickable).
export const PENDING_QUALIFIER_NAME = "Qualifier/Lucky Loser";

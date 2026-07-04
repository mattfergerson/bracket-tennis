"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type TrendPoint = {
  date: string; // ISO date (YYYY-MM-DD)
  score: number;
  rank: number;
};

export type TrendSeries = {
  userId: string;
  username: string;
  points: TrendPoint[];
};

type ScoreTrendChartProps = {
  series: TrendSeries[];
  currentUserId?: string;
};

const LINE_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#d97706", // amber
  "#9333ea", // purple
  "#0891b2", // cyan
  "#db2777", // pink
  "#65a30d", // lime
  "#0d9488", // teal
  "#ea580c", // orange
];

const W = 760;
const H = 300;
const MARGIN = { top: 16, right: 20, bottom: 30, left: 40 };
const Y_TICKS = 4;

/** Round up to a "nice" axis maximum (multiples of 1/2/5 × 10^k per tick). */
function niceMax(v: number): number {
  if (v <= 0) return Y_TICKS;
  const rawStep = v / Y_TICKS;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return step * Y_TICKS;
}

function dateLabel(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTick(v: number): string {
  return String(Math.round(v * 10) / 10);
}

export function ScoreTrendChart({ series, currentUserId }: ScoreTrendChartProps) {
  const [mode, setMode] = useState<"score" | "rank">("score");
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered ?? pinned;

  const dates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date)))
  ).sort();

  if (dates.length === 0 || series.length === 0) return null;

  const dateIndex = new Map(dates.map((d, i) => [d, i]));
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;

  const xAt = (i: number) =>
    dates.length === 1
      ? MARGIN.left + innerW / 2
      : MARGIN.left + (i / (dates.length - 1)) * innerW;

  const maxRank = Math.max(
    series.length,
    ...series.flatMap((s) => s.points.map((p) => p.rank))
  );
  const maxScore = niceMax(
    Math.max(...series.flatMap((s) => s.points.map((p) => p.score)))
  );

  // Rank mode puts rank 1 at the top
  const yAt = (p: TrendPoint) =>
    mode === "score"
      ? MARGIN.top + (1 - p.score / maxScore) * innerH
      : MARGIN.top + ((p.rank - 1) / Math.max(maxRank - 1, 1)) * innerH;

  const yTicks =
    mode === "score"
      ? Array.from({ length: Y_TICKS + 1 }, (_, i) => ({
          label: formatTick((maxScore / Y_TICKS) * i),
          y: MARGIN.top + (1 - i / Y_TICKS) * innerH,
        }))
      : Array.from({ length: maxRank }, (_, i) => ({
          label: String(i + 1),
          y: MARGIN.top + (i / Math.max(maxRank - 1, 1)) * innerH,
        })).filter((_, i) => maxRank <= 12 || i % 2 === 0);

  const xLabelEvery = Math.max(1, Math.ceil(dates.length / 8));

  // Legend order matches current standings (latest rank)
  const ordered = [...series].sort((a, b) => {
    const ra = a.points[a.points.length - 1]?.rank ?? 999;
    const rb = b.points[b.points.length - 1]?.rank ?? 999;
    return ra - rb;
  });
  const colorByUser = new Map(
    ordered.map((s, i) => [s.userId, LINE_COLORS[i % LINE_COLORS.length]])
  );

  // Draw the highlighted line last so it sits on top
  const drawOrder = active
    ? [...ordered.filter((s) => s.userId !== active), ...ordered.filter((s) => s.userId === active)]
    : ordered;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Pool Trends
        </CardTitle>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["score", "rank"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                mode === m
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto min-w-[560px]"
            role="img"
            aria-label={`${mode === "score" ? "Score" : "Rank"} over time for each pool member`}
          >
            {/* Grid + y-axis labels */}
            {yTicks.map((t) => (
              <g key={t.label + t.y}>
                <line
                  x1={MARGIN.left}
                  x2={W - MARGIN.right}
                  y1={t.y}
                  y2={t.y}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={t.y + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {mode === "rank" ? `#${t.label}` : t.label}
                </text>
              </g>
            ))}

            {/* X-axis labels */}
            {dates.map((d, i) =>
              i % xLabelEvery === 0 ? (
                <text
                  key={d}
                  x={xAt(i)}
                  y={H - MARGIN.bottom + 18}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {dateLabel(d)}
                </text>
              ) : null
            )}

            {/* One line per user */}
            {drawOrder.map((s) => {
              const color = colorByUser.get(s.userId)!;
              const dimmed = !!active && active !== s.userId;
              const isCurrent = s.userId === currentUserId;
              const path = s.points
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${xAt(dateIndex.get(p.date)!)} ${yAt(p)}`
                )
                .join(" ");
              return (
                <g
                  key={s.userId}
                  opacity={dimmed ? 0.15 : 1}
                  style={{ transition: "opacity 150ms" }}
                  onMouseEnter={() => setHovered(s.userId)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={isCurrent ? 3 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {s.points.map((p) => (
                    <circle
                      key={p.date}
                      cx={xAt(dateIndex.get(p.date)!)}
                      cy={yAt(p)}
                      r={active === s.userId ? 4.5 : 3.5}
                      fill={color}
                    >
                      <title>
                        {`${s.username} — ${dateLabel(p.date)}: ${p.score} pts (rank ${p.rank})`}
                      </title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-1.5">
          {ordered.map((s) => {
            const color = colorByUser.get(s.userId)!;
            const last = s.points[s.points.length - 1];
            const dimmed = !!active && active !== s.userId;
            return (
              <button
                key={s.userId}
                onClick={() => setPinned(pinned === s.userId ? null : s.userId)}
                onMouseEnter={() => setHovered(s.userId)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all",
                  pinned === s.userId && "bg-muted border-foreground/20",
                  dimmed && "opacity-40"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="font-medium">
                  {s.username}
                  {s.userId === currentUserId && (
                    <span className="ml-1 font-normal text-muted-foreground">(you)</span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {last ? (mode === "rank" ? `#${last.rank}` : `${last.score}`) : ""}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

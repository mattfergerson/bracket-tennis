"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function LockCountdown({ lockAt }: { lockAt: string }) {
  // Render nothing until mounted: the server doesn't know the viewer's
  // timezone, so any prerendered time would cause a hydration mismatch.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const lockDate = new Date(lockAt);
  const remaining = lockDate.getTime() - now.getTime();

  if (remaining <= 0) {
    return (
      <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">
        Picks are now locked.
      </p>
    );
  }

  return (
    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">
      Picks lock{" "}
      {lockDate.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })}{" "}
      — in {formatRemaining(remaining)}
    </p>
  );
}

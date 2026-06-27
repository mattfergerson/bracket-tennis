"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";

/**
 * Convert a Date (or ISO string) to the value a datetime-local input expects,
 * rendered in the browser's local timezone.
 */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function LockTimeEditor({
  tournamentId,
  lockAt,
}: {
  tournamentId: string;
  lockAt: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(toLocalInputValue(lockAt));
  const [loading, setLoading] = useState(false);

  async function save(newValue: string | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // datetime-local has no timezone; new Date() interprets it as local time
          lockAt: newValue ? new Date(newValue).toISOString() : null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save lock time");
      } else {
        toast.success(newValue ? "Pick lock time saved" : "Pick lock time cleared");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pick Lock Time
        </CardTitle>
        <CardDescription>
          Picks lock automatically at this time and the tournament moves to In
          Progress. Leave blank to lock manually. Uses your local timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-auto"
          />
          <Button size="sm" onClick={() => save(value)} disabled={loading || !value}>
            <Save className="h-4 w-4 mr-1" />
            {loading ? "Saving..." : "Save"}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue("");
                save(null);
              }}
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

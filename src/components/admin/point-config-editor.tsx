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
import { Save } from "lucide-react";

type PointConfig = { round: number; label: string; points: number };

export function PointConfigEditor({
  tournamentId,
  pointConfigs,
}: {
  tournamentId: string;
  pointConfigs: PointConfig[];
}) {
  const router = useRouter();
  const [configs, setConfigs] = useState<PointConfig[]>(
    pointConfigs.map((c) => ({ ...c }))
  );
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  function updatePoints(round: number, points: number) {
    setConfigs((prev) =>
      prev.map((c) => (c.round === round ? { ...c, points } : c))
    );
    setDirty(true);
  }

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointConfigs: configs }),
    });

    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to save point config");
    } else {
      toast.success("Point values saved");
      setDirty(false);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Point Values</CardTitle>
            <CardDescription>
              Points awarded per correct pick per round
            </CardDescription>
          </div>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-1" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {configs.map((config) => (
            <div key={config.round} className="flex items-center gap-4">
              <div className="w-40 text-sm font-medium">
                Round {config.round}: {config.label}
              </div>
              <Input
                type="number"
                value={config.points}
                onChange={(e) =>
                  updatePoints(config.round, Number(e.target.value))
                }
                min={0}
                max={1000}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">pts</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

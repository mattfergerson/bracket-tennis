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
  upsetMultiplier: initialUpsetMultiplier,
}: {
  tournamentId: string;
  pointConfigs: PointConfig[];
  upsetMultiplier: number;
}) {
  const router = useRouter();
  const [configs, setConfigs] = useState<PointConfig[]>(
    pointConfigs.map((c) => ({ ...c }))
  );
  const [upsetMultiplier, setUpsetMultiplier] = useState(initialUpsetMultiplier);
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
      body: JSON.stringify({ pointConfigs: configs, upsetMultiplier }),
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
            <CardTitle>Scoring Configuration</CardTitle>
            <CardDescription>
              Base points per round + upset bonus multiplier
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
      <CardContent className="space-y-6">
        {/* Upset multiplier */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm font-medium">Upset Multiplier</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Bonus = round pts × multiplier × seed gap. Picking a 28-seed over a 5-seed
                with multiplier {upsetMultiplier} in QF ({configs.find(c => c.round === 5)?.points ?? 8}pts) = {
                  Math.round((configs.find(c => c.round === 5)?.points ?? 8) * upsetMultiplier * 23 * 10) / 10
                } bonus pts
              </div>
            </div>
            <Input
              type="number"
              value={upsetMultiplier}
              onChange={(e) => {
                setUpsetMultiplier(Number(e.target.value));
                setDirty(true);
              }}
              min={0}
              max={10}
              step={0.05}
              className="w-24"
            />
          </div>
        </div>

        {/* Base points per round */}
        <div>
          <div className="text-sm font-medium mb-3">Base Points Per Round</div>
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
        </div>
      </CardContent>
    </Card>
  );
}

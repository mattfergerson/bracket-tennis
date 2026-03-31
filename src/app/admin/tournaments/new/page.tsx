"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { DEFAULT_POINT_CONFIGS, MAJOR_LABELS } from "@/lib/constants";
import { toast } from "sonner";

type PointConfig = { round: number; label: string; points: number };

export default function NewTournamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pointConfigs, setPointConfigs] = useState<PointConfig[]>(
    DEFAULT_POINT_CONFIGS.map((c) => ({ ...c }))
  );

  function updatePoints(round: number, points: number) {
    setPointConfigs((prev) =>
      prev.map((c) => (c.round === round ? { ...c, points } : c))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const year = Number(formData.get("year"));
    const major = formData.get("major") as string;

    const name = `${MAJOR_LABELS[major as keyof typeof MAJOR_LABELS]} ${year}`;

    const res = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        major,
        year,
        startDate: formData.get("startDate"),
        endDate: formData.get("endDate"),
        pointConfigs,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create tournament");
    } else {
      toast.success("Tournament created successfully");
      router.push("/admin");
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Tournament</CardTitle>
            <CardDescription>
              Set up a new Grand Slam bracket challenge
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grand Slam</Label>
                <Select name="major" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAJOR_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  defaultValue={currentYear}
                  min={2020}
                  max={2100}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Point Values</CardTitle>
            <CardDescription>
              Customize how many points each round is worth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pointConfigs.map((config) => (
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

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Creating..." : "Create Tournament"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

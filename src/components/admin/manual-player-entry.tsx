"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";

type PlayerEntry = { name: string; seed: number | null; nationality: string };

const EMPTY_PLAYER = (): PlayerEntry => ({ name: "", seed: null, nationality: "" });

export function ManualPlayerEntry({ drawId }: { drawId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<PlayerEntry[]>([]);

  function parseCsv() {
    const lines = csvText.trim().split("\n");
    const entries: PlayerEntry[] = [];

    for (const line of lines) {
      const [name, seed, nationality] = line.split(",").map((s) => s.trim());
      if (name) {
        entries.push({
          name,
          seed: Number(seed) || null,
          nationality: nationality ?? "",
        });
      }
    }

    if (entries.length !== 128) {
      toast.error(`Expected 128 players, got ${entries.length}`);
      return;
    }

    setParsed(entries);
    toast.success(`Parsed ${entries.length} players`);
  }

  async function handleSubmit() {
    if (parsed.length !== 128) {
      toast.error("Parse 128 players first");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/admin/draws/${drawId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: parsed }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create players");
    } else {
      toast.success("Players and matches created");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Enter Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Player Entry</DialogTitle>
          <DialogDescription>
            Paste 128 players as CSV: <code>Name, Seed, Nationality</code> (one per line). Each consecutive pair of rows is a match — rows 1+2 = match 1, rows 3+4 = match 2, etc.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Players CSV (128 rows)</Label>
            <textarea
              className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
              placeholder={"Novak Djokovic, 1, SRB\nAlcaraz Carlos, 2, ESP\n..."}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={parseCsv}>
              Parse CSV
            </Button>
            {parsed.length === 128 && (
              <span className="text-sm text-green-600">
                ✓ {parsed.length} players ready
              </span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || parsed.length !== 128}>
            <Upload className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Create Draw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

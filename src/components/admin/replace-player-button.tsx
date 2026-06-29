"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserMinus, Check } from "lucide-react";

type PlayerOption = { id: string; name: string };

export function ReplacePlayerButton({
  drawId,
  players,
}: {
  drawId: string;
  players: PlayerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerId, setPlayerId] = useState<string>("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  const selected = players.find((p) => p.id === playerId);

  function reset() {
    setPlayerId("");
    setQuery("");
  }

  async function handleReplace() {
    if (!playerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/draws/${drawId}/replace-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Replacement failed");
      } else {
        toast.success(`Replaced ${data.replaced} with ${data.with}`);
        setOpen(false);
        reset();
        router.refresh();
      }
    } catch {
      toast.error("Replacement failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserMinus className="h-4 w-4 mr-2" />
          Replace Player
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace a withdrawn player</DialogTitle>
          <DialogDescription>
            Pull the lucky-loser replacement from Sportradar and slot them into
            this player&apos;s spot. Submitted brackets are preserved — every
            pick on the withdrawn player becomes a pick on the replacement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label>Withdrawn player</Label>
          <Input
            autoFocus
            placeholder="Search players..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                No players match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlayerId(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    p.id === playerId && "bg-primary/10 font-medium"
                  )}
                >
                  {p.name}
                  {p.id === playerId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Only works once Sportradar has published the replacement in the
            draw. If it hasn&apos;t yet, you&apos;ll get a message to retry
            later.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleReplace} disabled={!playerId || loading}>
            {loading
              ? "Replacing..."
              : selected
              ? `Replace ${selected.name}`
              : "Fetch & Replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

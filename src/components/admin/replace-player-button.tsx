"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";

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
        setPlayerId("");
        router.refresh();
      }
    } catch {
      toast.error("Replacement failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select the player who withdrew" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            {loading ? "Replacing..." : "Fetch & Replace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

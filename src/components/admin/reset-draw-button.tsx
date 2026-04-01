"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ResetDrawButton({ drawId }: { drawId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/draws/${drawId}/players`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to reset draw");
      toast.success("Draw cleared — you can now re-import players");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to reset draw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Reset Draw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset this draw?</DialogTitle>
          <DialogDescription>
            This will delete all players, matches, and any bracket picks submitted
            for this draw. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={loading}>
            {loading ? "Resetting..." : "Yes, reset draw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

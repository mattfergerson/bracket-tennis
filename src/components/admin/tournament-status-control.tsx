"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TournamentStatus } from "@/generated/prisma/client";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

const TRANSITIONS: Record<TournamentStatus, { next: TournamentStatus; label: string; variant: "default" | "destructive" | "outline" }> = {
  UPCOMING: {
    next: "ACCEPTING_PICKS",
    label: "Open for Picks",
    variant: "default",
  },
  ACCEPTING_PICKS: {
    next: "IN_PROGRESS",
    label: "Lock Picks & Start Tournament",
    variant: "destructive",
  },
  IN_PROGRESS: {
    next: "COMPLETED",
    label: "Mark as Completed",
    variant: "outline",
  },
  COMPLETED: {
    next: "COMPLETED",
    label: "Already Completed",
    variant: "outline",
  },
};

export function TournamentStatusControl({
  tournamentId,
  currentStatus,
}: {
  tournamentId: string;
  currentStatus: TournamentStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const transition = TRANSITIONS[currentStatus];

  async function advanceStatus() {
    if (currentStatus === "COMPLETED") return;
    setLoading(true);

    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: transition.next }),
    });

    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to update status");
    } else {
      toast.success("Tournament status updated");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tournament Status</CardTitle>
        <CardDescription>
          Control when users can submit picks and when results are entered
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm">
            {currentStatus === "UPCOMING" &&
              "Tournament is not yet open. Open it to allow users to submit picks."}
            {currentStatus === "ACCEPTING_PICKS" &&
              "Users can currently submit and edit their brackets. Lock picks when the tournament begins."}
            {currentStatus === "IN_PROGRESS" &&
              "Tournament is underway. Enter match results as they happen."}
            {currentStatus === "COMPLETED" &&
              "Tournament is finished. Final scores are locked."}
          </div>
          {currentStatus !== "COMPLETED" && (
            <Button
              onClick={advanceStatus}
              disabled={loading}
              variant={transition.variant}
              className="shrink-0"
            >
              <ChevronRight className="h-4 w-4 mr-1" />
              {loading ? "Updating..." : transition.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

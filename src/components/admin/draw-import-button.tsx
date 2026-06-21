"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";

export function DrawImportButton({ drawId }: { drawId: string }) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch(`/api/admin/draws/${drawId}/import`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Import failed");
      } else {
        const data = await res.json();
        toast.success(`Imported ${data.players} players and ${data.matches} matches`);
        router.refresh();
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/draws/${drawId}/import`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Sync failed");
      } else {
        const data = await res.json();
        toast.success(`Synced ${data.synced} new results (${data.total} total completed)`);
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleImport} disabled={importing || syncing}>
        <Download className="h-4 w-4 mr-2" />
        {importing ? "Importing..." : "Import Draw"}
      </Button>
      <Button variant="outline" onClick={handleSync} disabled={importing || syncing}>
        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Results"}
      </Button>
    </div>
  );
}

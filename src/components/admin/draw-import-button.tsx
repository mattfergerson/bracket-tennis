"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";

export function DrawImportButton({ drawId }: { drawId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    setLoading(true);
    const res = await fetch(`/api/admin/draws/${drawId}/import`, {
      method: "POST",
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Import failed");
    } else {
      const data = await res.json();
      toast.success(`Imported ${data.players} players and ${data.matches} matches`);
      router.refresh();
    }
  }

  return (
    <Button variant="outline" onClick={handleImport} disabled={loading}>
      <Download className="h-4 w-4 mr-2" />
      {loading ? "Importing..." : "Import from API"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Newspaper } from "lucide-react";

export function GenerateDigestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/daily-digest", { method: "GET" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate digest");
      } else if (!data.ran) {
        toast.message(data.reason ?? "Nothing to run (tournament not in progress)");
      } else {
        toast.success("Digest generated");
        router.refresh();
      }
    } catch {
      toast.error("Failed to generate digest");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <Newspaper className="h-4 w-4 mr-2" />
      {loading ? "Generating..." : "Generate Digest Now"}
    </Button>
  );
}

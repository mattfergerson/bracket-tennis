"use client";

import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "idle" | "sending" | "sent" | "error";

export function ResendInviteButton({ requestId }: { requestId: string }) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleClick() {
    setState("sending");
    setErrorMsg("");

    const res = await fetch(`/api/admin/requests/${requestId}/resend-invite`, {
      method: "POST",
    });

    if (res.ok) {
      setState("sent");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Failed to send invite");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
        <CheckCircle className="h-3.5 w-3.5" />
        Invite Sent
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={state === "sending"}
      >
        <Send className="h-3 w-3 mr-1" />
        {state === "sending" ? "Sending…" : "Send Invite"}
      </Button>
      {state === "error" && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}

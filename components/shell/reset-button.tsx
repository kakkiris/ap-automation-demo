"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/use-json";

export function ResetButton({ resetPath, label = "Reset demo", className }: { resetPath: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function reset() {
    setBusy(true);
    try {
      await postJson(resetPath);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={reset} disabled={busy} className={className}>
      {busy ? "Resetting" : label}
    </Button>
  );
}

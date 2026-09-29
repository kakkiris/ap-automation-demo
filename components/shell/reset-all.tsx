"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/use-json";
import { resetPaths } from "@/lib/registry";

export function ResetAll() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  async function resetAll() {
    setBusy(true);
    try {
      for (const r of resetPaths()) await postJson(r.path);
      setDone("Every demo is back at its starting state.");
    } catch (err) {
      setDone(`Reset stopped: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={resetAll} disabled={busy}>
        {busy ? "Resetting" : "Reset all demos"}
      </Button>
      {done && <span className="text-sm text-muted-foreground" role="status">{done}</span>}
    </div>
  );
}

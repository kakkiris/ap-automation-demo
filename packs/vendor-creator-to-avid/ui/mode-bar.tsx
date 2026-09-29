"use client";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/shell/kit";
import { cn } from "@/lib/utils";
import { useMode } from "./mode";

// The assisted or automatic toggle for tonight's run. It renders inside the shell's
// ModuleBar on every screen of the module; the ModuleBar owns the bar itself (border,
// width, padding), so this is only the row of controls.
const EXPLAIN = {
  assisted: "Tonight's run produces an import file and a task list.",
  automatic: "Tonight's run creates vendors in Avid directly.",
} as const;

export function ModeBar() {
  const { mode, saving, error, setMode } = useMode();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">{"Tonight's run"}</span>
      <span className={cn(mode === "assisted" ? "font-medium" : "text-muted-foreground")}>Assisted</span>
      <Switch
        aria-label="Automatic mode"
        data-testid="mode-toggle"
        checked={mode === "automatic"}
        disabled={mode === null || saving}
        onCheckedChange={(checked) => void setMode(checked ? "automatic" : "assisted")}
      />
      <span className={cn(mode === "automatic" ? "font-medium" : "text-muted-foreground")}>Automatic</span>
      {mode && (
        <StatusPill data-testid="mode-label" tone={mode === "automatic" ? "paid" : "neutral"} className="font-mono">
          {mode}
        </StatusPill>
      )}
      {mode && <span className="text-muted-foreground">{EXPLAIN[mode]}</span>}
      {error && <span className="text-risk">{error}</span>}
    </div>
  );
}

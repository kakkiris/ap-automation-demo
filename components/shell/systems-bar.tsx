import { cn } from "@/lib/utils";
import type { SystemRef, SystemRole } from "@/lib/registry";

// Which of the client's own systems a screen would read from and write to. Nothing is
// connected in the demo, and the strip says so once rather than on every chip.
const ROLE_WORD: Record<SystemRole, string> = {
  reads: "reads",
  receives: "receives",
  replaces: "replaces",
  unchanged: "unchanged",
};

const ROLE_CLASS: Record<SystemRole, string> = {
  reads: "bg-info-soft text-info ring-info/25",
  receives: "bg-dept-soft text-dept ring-dept/25",
  replaces: "bg-lag-soft text-lag ring-lag/25",
  unchanged: "bg-muted text-muted-foreground ring-border",
};

export function SystemsBar({ systems, className }: { systems: SystemRef[]; className?: string }) {
  if (systems.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs", className)} aria-label="Connected systems">
      <span className="font-medium text-muted-foreground">Connects to</span>
      {systems.map((s) => (
        <span
          key={`${s.name}-${s.role}`}
          data-system={s.name}
          title={`${s.name} ${ROLE_WORD[s.role]}: ${s.note}`}
          className={cn("inline-flex items-baseline gap-1.5 rounded-md px-2 py-0.5 ring-1 ring-inset", ROLE_CLASS[s.role])}
        >
          <span className="font-medium">{s.name}</span>
          <span className="opacity-75">{ROLE_WORD[s.role]}</span>
        </span>
      ))}
      <span className="text-muted-foreground">nothing is connected in the demo</span>
    </div>
  );
}

/** The same systems as one sentence, for a card that has no room for chips. */
export function systemsSentence(systems: SystemRef[]): string {
  const names = Array.from(new Set(systems.map((s) => s.name)));
  if (names.length === 0) return "";
  if (names.length === 1) return `Connects to ${names[0]}.`;
  return `Connects to ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
}

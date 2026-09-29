import Link from "next/link";
import { cn } from "@/lib/utils";

// The shared kit every module draws on: one status palette, one way to show a number,
// one card shape, one empty state. Department color comes from the scope, not from here.

export type Tone = "paid" | "risk" | "signal" | "lag" | "info" | "neutral" | "dept";

const PILL: Record<Tone, string> = {
  paid: "bg-paid-soft text-paid ring-paid/25",
  risk: "bg-risk-soft text-risk ring-risk/25",
  signal: "bg-signal-soft text-signal ring-signal/30",
  lag: "bg-lag-soft text-lag ring-lag/25",
  info: "bg-info-soft text-info ring-info/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  dept: "bg-dept-soft text-dept ring-dept/25",
};

/** A status word with its color. Tone carries the meaning; the text stays the client's word. */
export function StatusPill({ tone = "neutral", className, children, ...props }: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", PILL[tone], className)} {...props}>
      {children}
    </span>
  );
}

/** Small label above a title or a section, in the department hue. */
export function Eyebrow({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-dept", className)} {...props}>
      {children}
    </div>
  );
}

/** A big number and its label; tabular figures, display face. */
export function Stat({ value, label, tone = "neutral", className, ...props }: React.ComponentProps<"div"> & { value: React.ReactNode; label: React.ReactNode; tone?: Tone }) {
  const color = tone === "neutral" ? "text-foreground" : tone === "dept" ? "text-dept" : `text-${tone}`;
  return (
    <div className={cn("rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10", className)} {...props}>
      <div className={cn("font-heading text-3xl font-semibold leading-none tabular-nums", color)}>{value}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Identifiers and amounts: the mono face with tabular figures. */
export function Mono({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono tabular-nums", className)} {...props} />;
}

/** A card with a title row. `accent` draws the department rule down its left edge. */
export function Panel({ title, eyebrow, right, accent, className, bodyClassName, children, ...props }: Omit<React.ComponentProps<"section">, "title"> & { title?: React.ReactNode; eyebrow?: React.ReactNode; right?: React.ReactNode; accent?: boolean; bodyClassName?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10", accent && "shadow-[inset_3px_0_0_var(--dept)]", className)} {...props}>
      {(title || right || eyebrow) && (
        <div className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && <h2 className="truncate text-base font-semibold">{title}</h2>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** An empty screen is an invitation to act: the step, then where it starts. */
export function EmptyState({ title, hint, action, className, ...props }: React.ComponentProps<"div"> & { title: React.ReactNode; hint?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div role="status" className={cn("rounded-lg border border-dashed bg-card/60 px-6 py-8 text-center", className)} {...props}>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && (
        <Link href={action.href} className="mt-3 inline-block text-sm font-medium text-dept underline-offset-4 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** A key the presenter can press, drawn as a keycap. */
export function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{children}</kbd>;
}

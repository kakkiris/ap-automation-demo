"use client";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { locate, systemsFor } from "@/lib/registry";
import { annotationFor, usePanel, PANEL_KEY } from "./annotations";
import { Eyebrow, Key } from "./kit";
import { SystemsBar } from "./systems-bar";

/**
 * Every screen opens the same way: where you are, what the screen is for, and the
 * narration (today, with this screen, what it protects) the presenter reads from.
 */
export function ScreenHeader({ screen, title, right }: { screen: string; title: string; right?: React.ReactNode }) {
  const a = annotationFor(screen);
  const here = locate(usePathname());
  const { open, setOpen } = usePanel();
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {here && (
            <Eyebrow className="mb-1">
              {here.department.label} <span className="text-muted-foreground/70">/</span> {here.module.name}
            </Eyebrow>
          )}
          <h1 className="text-[1.75rem] font-semibold leading-tight">{title}</h1>
          {a?.purpose && <p className="mt-1 max-w-3xl text-[15px] text-muted-foreground">{a.purpose}</p>}
          {here && <SystemsBar systems={systemsFor(here.module, here.screen)} className="mt-2.5" />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {a?.panel && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="narration">
              {open ? "Hide narration" : "Show narration"}
            </Button>
          )}
        </div>
      </div>
      {open && a?.panel && (
        <aside id="narration" role="note" aria-label="narration" className="mt-4 grid gap-x-6 gap-y-3 rounded-lg bg-dept-soft px-5 py-4 text-sm shadow-[inset_3px_0_0_var(--dept)] md:grid-cols-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-dept">Today</div>
            <p className="mt-1 leading-relaxed">{a.panel.today || "Not written yet."}</p>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-dept">With this screen</div>
            <p className="mt-1 leading-relaxed">{a.panel.here || "Not written yet."}</p>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-dept">What it protects</div>
            <p className="mt-1 leading-relaxed">{a.panel.protects || "Not written yet."}</p>
          </div>
          <div className="text-xs text-muted-foreground md:col-span-3">
            <Key>{PANEL_KEY}</Key> shows or hides the narration on any screen. <Key>[</Key> and <Key>]</Key> move between screens.
          </div>
        </aside>
      )}
    </div>
  );
}

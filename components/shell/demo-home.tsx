import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { departments, moduleHref, navScreens, type Department } from "@/lib/registry";
import { moduleIcon } from "./module-icons";
import { Eyebrow, Key } from "./kit";
import { systemsSentence } from "./systems-bar";
import { ResetAll } from "./reset-all";
import { ResetButton } from "./reset-button";

export function DemoHome({ department }: { department?: string }) {
  const shown: Department[] = department ? departments.filter((d) => d.slug === department) : departments;
  return (
    <main className="mx-auto max-w-6xl px-8 pb-16 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <Eyebrow className="text-muted-foreground">Demo home</Eyebrow>
          <h1 className="mt-2 text-[2.5rem] font-semibold leading-[1.05]">The work, shown being done.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {department ? (
              <>
                Showing {shown[0]?.label ?? department}.{" "}
                <Link href="/" className="text-foreground underline underline-offset-4">
                  Show both departments
                </Link>
              </>
            ) : (
              "Eight demos for two accounting teams. Pick a department, then a demo; Start opens its first screen. Every screen narrates what happens today, what happens here, and what that protects."
            )}
          </p>
        </div>
        <ResetAll />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-card px-5 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
        <span>
          <span className="font-medium text-foreground">Sidebar</span> lists the modules; open one to see its screens in the order the work happens.
        </span>
        <span>
          <Key>[</Key> <Key>]</Key> previous and next screen
        </span>
        <span>
          <Key>a</Key> narration on or off
        </span>
        <span>
          <span className="font-medium text-foreground">Reset</span> returns a demo to its starting state.
        </span>
      </div>

      {shown.map((dept) => (
        <section key={dept.slug} data-department={dept.slug} className="mt-12" aria-labelledby={`dept-${dept.slug}`}>
          <div className="flex items-baseline gap-3 border-b-2 border-dept pb-2">
            <h2 id={`dept-${dept.slug}`} className="text-2xl font-semibold text-dept">
              {dept.label}
            </h2>
            <p className="text-sm text-muted-foreground">{dept.blurb}</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {dept.modules.map((m) => {
              const Icon = moduleIcon(m.slug);
              const screens = navScreens(m);
              return (
                <article key={m.slug} data-module-card={m.slug} className="flex flex-col rounded-lg bg-card p-5 ring-1 ring-foreground/10 shadow-[inset_3px_0_0_var(--dept)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-dept-soft text-dept">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">{m.name}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.sentence}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {m.entry ? "Opens inside AP Inbox." : `${screens.length} ${screens.length === 1 ? "screen" : "screens"}: ${screens.map((s) => s.label).join(", ")}.`}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-dept">{systemsSentence(m.systems)}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <LinkButton href={moduleHref(m)}>Start</LinkButton>
                    <ResetButton resetPath={m.resetPath} label="Reset this demo" />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}

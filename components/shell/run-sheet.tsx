"use client";
import { useEffect, useState } from "react";
import { Eyebrow } from "./kit";

// The presenter run sheet is docs/walkthrough.md, staged as a static asset by scripts/stage-public.ts
// and fetched here, because Workers cannot read repo files at runtime.
export function RunSheet() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/run-sheet.md", { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("The run sheet is not available in this build."))))
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <main className="mx-auto max-w-4xl px-8 pb-16 pt-10">
      <Eyebrow className="text-muted-foreground">Presenter run sheet</Eyebrow>
      <h1 className="mt-2 text-[2rem] font-semibold leading-tight">How to walk the demos</h1>
      <p className="mt-2 text-sm text-muted-foreground">One paragraph per demo, in the order the presenter walks them.</p>
      {error && <p className="mt-6 text-sm text-risk">{error}</p>}
      {!text && !error && <p className="mt-6 text-sm text-muted-foreground">Loading the run sheet.</p>}
      {text && <pre className="mt-6 whitespace-pre-wrap rounded-lg bg-card p-6 font-sans text-sm leading-6 ring-1 ring-foreground/10">{text}</pre>}
    </main>
  );
}

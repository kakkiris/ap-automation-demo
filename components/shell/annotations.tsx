"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import annotations from "@/data/annotations.json";

export interface Annotation {
  screen: string;
  audience: "client" | "internal";
  purpose: string;
  panel: { today: string; here: string; protects: string } | null;
}

export const AUDIENCE: "client" | "internal" = process.env.NEXT_PUBLIC_DEMO_AUDIENCE === "internal" ? "internal" : "client";
export const PANEL_KEY = "a";
const OPEN_KEY = "demo-narration-open";
const listeners = new Set<() => void>();

function readOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeOpen(open: boolean) {
  try {
    window.sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // storage unavailable; the panel state lives in memory for this page
  }
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const PanelContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: true, setOpen: () => {} });

/** The narration on every screen is open until the presenter hides it; `a` toggles, Escape hides. */
export function AnnotationsProvider({ children }: { children: React.ReactNode }) {
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (typing) return;
      if (e.key === PANEL_KEY) {
        e.preventDefault();
        writeOpen(!readOpen());
      }
      if (e.key === "Escape") writeOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <PanelContext.Provider value={{ open, setOpen: writeOpen }}>{children}</PanelContext.Provider>;
}

export function usePanel(): { open: boolean; setOpen: (open: boolean) => void } {
  return useContext(PanelContext);
}

export function usePanelOpen(): boolean {
  return useContext(PanelContext).open;
}

/** The entry for this audience, falling back to the client entry so every screen narrates. */
export function annotationFor(screen: string): Annotation | undefined {
  const all = annotations as Annotation[];
  return all.find((a) => a.screen === screen && a.audience === AUDIENCE) ?? all.find((a) => a.screen === screen && a.audience === "client");
}

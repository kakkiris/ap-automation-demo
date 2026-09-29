"use client";
import { useSyncExternalStore } from "react";

// Sidebar state kept for the session: which module is expanded and whether the sidebar
// is open. Lives in sessionStorage so it survives a reload; Reset demo never touches it.
const EXPANDED_KEY = "demo-sidebar-expanded";
const OPEN_KEY = "demo-sidebar-open";
const listeners = new Set<() => void>();

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable; the state lives in memory for this page
  }
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useExpandedModule(): [string | null, (slug: string | null) => void] {
  const value = useSyncExternalStore(subscribe, () => read(EXPANDED_KEY) || null, () => null);
  return [value, (slug) => write(EXPANDED_KEY, slug ?? "")];
}

export function useSidebarOpen(): [boolean, (open: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => read(OPEN_KEY) !== "0", () => true);
  return [value, (open) => write(OPEN_KEY, open ? "1" : "0")];
}

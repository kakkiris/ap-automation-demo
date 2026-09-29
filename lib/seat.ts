"use client";
import { useSyncExternalStore } from "react";

export type Seat = "lead" | "operator";
export const SEAT_KEY = "demo-seat";
export const SEAT_LABEL: Record<Seat, string> = { lead: "accounting lead", operator: "AP operator" };

const listeners = new Set<() => void>();

export function readSeat(): Seat {
  if (typeof window === "undefined") return "lead";
  try {
    return window.localStorage.getItem(SEAT_KEY) === "operator" ? "operator" : "lead";
  } catch {
    return "lead";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function writeSeat(s: Seat) {
  try {
    window.localStorage.setItem(SEAT_KEY, s);
  } catch {
    // storage unavailable; listeners still re-read the default
  }
  for (const cb of listeners) cb();
}

export function useSeat(): [Seat, (s: Seat) => void] {
  const seat = useSyncExternalStore(subscribe, readSeat, () => "lead" as Seat);
  return [seat, writeSeat];
}

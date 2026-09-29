import type { Store } from "./types";

// The store's logical clock and the date helpers. Nothing here reads the real time.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Advance the clock by one minute and return the timestamp: demoDate 09:00Z plus clock minutes. */
export function stamp(store: Store): string {
  store.clock += 1;
  return clockIso(store.demoDate, store.clock);
}

export function clockIso(demoDate: string, minutes: number): string {
  const base = Date.UTC(year(demoDate), month(demoDate) - 1, day(demoDate), 9, 0, 0);
  return new Date(base + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const year = (d: string) => parseInt(d.slice(0, 4), 10);
const month = (d: string) => parseInt(d.slice(5, 7), 10);
const day = (d: string) => parseInt(d.slice(8, 10), 10);

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD from a UTC millisecond value. */
export function isoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM-DD plus a number of days. */
export function shiftDays(date: string, days: number): string {
  return isoDate(Date.UTC(year(date), month(date) - 1, day(date) + days));
}

/** YYYY-MM-DD plus a number of months, the day clamped to the month's end. */
export function shiftMonths(date: string, months: number): string {
  const y = year(date);
  const m = month(date) - 1 + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoDate(Date.UTC(y, m, Math.min(day(date), lastDay)));
}

/** The Monday on or before a date or timestamp. */
export function mondayOf(dateOrIso: string): string {
  const d = dateOrIso.slice(0, 10);
  const ms = Date.UTC(year(d), month(d) - 1, day(d));
  const weekday = new Date(ms).getUTCDay(); // 0 Sunday
  const back = (weekday + 6) % 7;
  return isoDate(ms - back * 86_400_000);
}

/** "Sep 3, 2026" from a date or timestamp. */
export function fmtDate(dateOrIso: string | null | undefined): string {
  if (!dateOrIso) return "";
  const d = dateOrIso.slice(0, 10);
  return `${MONTHS[month(d) - 1]} ${day(d)}, ${year(d)}`;
}

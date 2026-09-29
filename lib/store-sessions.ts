import { currentSession } from "./session";

// One demo store per browser session, so two people on the same shared link never collide:
// one person pressing Reset demo cannot wipe what another is halfway through.
//
// The map lives on globalThis because `next dev` can load a module more than once and every
// route handler must still see the same store, and because the Cloudflare entry point and the
// Next.js server are bundled separately and must reach the same one.
//
// Without a session (dev, tests) the key is "shared", which is the single store the suite has
// always used.

const MAX_SESSIONS = 8;

type Registry = Map<string, Map<string, unknown>>;
type GlobalWithStores = typeof globalThis & { __demoStores?: Registry };

function registry(): Registry {
  const g = globalThis as GlobalWithStores;
  if (!g.__demoStores) g.__demoStores = new Map();
  return g.__demoStores;
}

function bucket(name: string): Map<string, unknown> {
  const all = registry();
  let b = all.get(name);
  if (!b) {
    b = new Map();
    all.set(name, b);
  }
  return b;
}

export interface SessionStores<T> {
  get(): T;
  reset(): T;
}

export function sessionStores<T>(name: string, create: () => T): SessionStores<T> {
  const key = () => currentSession() ?? "shared";
  return {
    get(): T {
      const b = bucket(name);
      const k = key();
      let store = b.get(k) as T | undefined;
      if (store === undefined) {
        store = create();
        b.set(k, store);
        // Keep the isolate's memory bounded: drop the least recently created session.
        while (b.size > MAX_SESSIONS) {
          const oldest = b.keys().next().value as string | undefined;
          if (oldest === undefined || oldest === k) break;
          b.delete(oldest);
        }
      }
      return store;
    },
    reset(): T {
      const store = create();
      bucket(name).set(key(), store);
      return store;
    },
  };
}

// Below: how one session's stores are handed to and from the Durable Object that keeps them,
// so a viewer who steps away for a while comes back to the demo as they left it.

/** Every pack store this session has opened, as plain JSON. Null when it has opened none. */
export function snapshotSession(id: string): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  let found = false;
  for (const [name, b] of registry()) {
    const store = b.get(id);
    if (store !== undefined) {
      out[name] = store;
      found = true;
    }
  }
  return found ? out : null;
}

/** Put a saved snapshot back, so the next getStore() finds it instead of re-seeding. */
export function restoreSession(id: string, data: Record<string, unknown>): void {
  for (const [name, store] of Object.entries(data)) bucket(name).set(id, store);
}

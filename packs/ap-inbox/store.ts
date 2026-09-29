import seedJson from "./seed/seed.json";
import type { Seed, Store } from "./lib/types";
import { sessionStores } from "@/lib/store-sessions";

// The in-memory store for the intake pack: the seed plus the session state, one copy per
// browser session (see lib/store-sessions.ts). Reset re-seeds
// and drops every draft, update, batch and upload; items go back to New and stay New
// until the arrive action drafts them.

// Bundled rather than read from disk: the demo runs on Workers, which have no filesystem.
export function loadSeed(): Seed {
  return seedJson as unknown as Seed;
}

export function createStore(seed: Seed): Store {
  return {
    ...structuredClone(seed),
    clock: 0,
    drafts: {},
    trackerUpdates: [],
    batches: [],
    uploads: {},
    nextCardNumber: 8801,
    nextItemNumber: 9001,
    nextVendorNumber: 41,
    nextPropertyNumber: 21601,
    nextUpdateNumber: 1,
  };
}

// One store per browser session when the demo is hosted, so two people on the same link
// never collide; a single shared store under next dev and in the tests.
const stores = sessionStores<Store>("ap-inbox", () => createStore(loadSeed()));

export function getStore(): Store {
  return stores.get();
}

export function resetStore(): Store {
  return stores.reset();
}

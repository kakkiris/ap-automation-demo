import seedJson from "./seed/seed.json";
import type { Seed, Store } from "./lib/types";
import { sessionStores } from "@/lib/store-sessions";

// Bundled rather than read from disk: the demo runs on Workers, which have no filesystem.
export function loadSeed(): Seed {
  return seedJson as unknown as Seed;
}

/** A fresh store from the seed: assisted mode, no runs, no decisions beyond the seed's, invoices not yet received. */
export function createStore(seed: Seed): Store {
  return {
    ...structuredClone(seed),
    mode: "assisted",
    sync_runs: [],
    delta_items: [],
    import_rows: [],
    tasks: [],
    invoices_received: false,
    next_run_number: 1,
    next_task_number: 1,
  };
}

// One store per browser session when the demo is hosted, so two people on the same link
// never collide; a single shared store under next dev and in the tests.
const stores = sessionStores<Store>("vendor-creator-to-avid", () => createStore(loadSeed()));

export function getStore(): Store {
  return stores.get();
}

export function resetStore(): Store {
  return stores.reset();
}

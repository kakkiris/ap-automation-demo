import seedJson from "./seed/seed.json";
import type { Seed, Store } from "./lib/types";
import { sessionStores } from "@/lib/store-sessions";

// Bundled rather than read from disk: the demo runs on Workers, which have no filesystem.
export function loadSeed(): Seed {
  return seedJson as unknown as Seed;
}

/** Seed clone plus empty session state. The seed's status fields are expected outcomes; Receive invoices recomputes them. */
export function createStore(seed: Seed): Store {
  return {
    ...structuredClone(seed),
    received: false,
    extractions: {},
    descriptions: {},
    suggestions: {},
    feedback: [],
  };
}

// One store per browser session when the demo is hosted, so two people on the same link
// never collide; a single shared store under next dev and in the tests.
const stores = sessionStores<Store>("invoice-description-writer", () => createStore(loadSeed()));

export function getStore(): Store {
  return stores.get();
}

export function resetStore(): Store {
  return stores.reset();
}

import seedJson from "../../data/seed.json";
import type { Seed, Store } from "./types";
import { sessionStores } from "@/lib/store-sessions";

// Bundled rather than read from disk: the demo runs on Workers, which have no filesystem.
export function loadSeed(): Seed {
  return seedJson as unknown as Seed;
}

export function createStore(seed: Seed): Store {
  return {
    ...structuredClone(seed),
    exceptions: structuredClone(seed.exceptions ?? []),
    runs: {},
    events: [],
    bill_backs: [],
    transfer_drafts: [],
    call_notes: [],
    checklists: [],
    verify_items: [],
    done_actions: [],
    snapshots: {},
    provider_import_done: false,
    site_visit_done: false,
    operator_steps: {},
    undo: null,
    undo_label: null,
  };
}

// One store per browser session when the demo is hosted, so two people on the same link
// never collide; a single shared store under next dev and in the tests.
const stores = sessionStores<Store>("utility-bills-to-yardi", () => createStore(loadSeed()));

export function getStore(): Store {
  return stores.get();
}

export function resetStore(): Store {
  return stores.reset();
}

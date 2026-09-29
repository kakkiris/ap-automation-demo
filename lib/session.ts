import { AsyncLocalStorage } from "node:async_hooks";

// Who is asking. On Cloudflare the Worker entry (worker.ts) puts a per browser session id
// here for the length of the request, so every viewer of the shared link gets their own copy
// of the demo state. Under `next dev` and in the tests nothing sets it, so everything shares
// one store exactly as before.
//
// The instance is pinned to globalThis on purpose: the Worker entry and the Next.js server
// are bundled separately and would otherwise each hold their own AsyncLocalStorage, so the id
// set by one would be invisible to the other.
export const SESSION_COOKIE = "demo-session";

type GlobalWithSession = typeof globalThis & { __demoSessionContext?: AsyncLocalStorage<string> };

function context(): AsyncLocalStorage<string> {
  const g = globalThis as GlobalWithSession;
  if (!g.__demoSessionContext) g.__demoSessionContext = new AsyncLocalStorage<string>();
  return g.__demoSessionContext;
}

export function runWithSession<T>(id: string, fn: () => T): T {
  return context().run(id, fn);
}

export function currentSession(): string | null {
  return context().getStore() ?? null;
}

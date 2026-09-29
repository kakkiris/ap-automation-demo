"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { postJson, useJson } from "@/lib/use-json";
import { vendorCreatorToAvidPack as pack } from "@/packs/vendor-creator-to-avid/module";
import type { StatePayload, SyncMode } from "@/packs/vendor-creator-to-avid/lib/types";

interface ModeContextValue {
  /** null until the stored mode has loaded. */
  mode: SyncMode | null;
  /** True while a mode change is being saved. Screens disable their action buttons meanwhile. */
  saving: boolean;
  error: string | null;
  setMode: (mode: SyncMode) => Promise<void>;
  /** Bumps after every saved mode change. Screens refetch their data when it changes. */
  version: number;
}

const ModeContext = createContext<ModeContextValue>({
  mode: null,
  saving: false,
  error: null,
  setMode: async () => {},
  version: 0,
});

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { data, error: loadError } = useJson<StatePayload>(`${pack.apiBase}/state`);
  const [override, setOverride] = useState<SyncMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const mode = override ?? data?.mode ?? null;

  const setMode = useCallback(async (next: SyncMode) => {
    setSaving(true);
    try {
      const body = await postJson<StatePayload>(`${pack.apiBase}/mode`, { mode: next });
      setOverride(body.mode);
      setSaveError(null);
      setVersion((v) => v + 1);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo<ModeContextValue>(
    () => ({ mode, saving, error: saveError ?? loadError, setMode, version }),
    [mode, saving, saveError, loadError, setMode, version],
  );
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}

/** Turns a thrown fetch error (often a JSON body like {"error":"..."}) into one plain line. */
export function errorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // plain text, not JSON
  }
  return raw || "Something went wrong.";
}

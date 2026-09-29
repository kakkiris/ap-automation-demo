"use client";
import { useState } from "react";
import { Mono, StatusPill } from "@/components/shell/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LookupView } from "@/packs/property-owner-lookup/lib/lookup";
import type { ParcelRecord } from "@/packs/property-owner-lookup/lib/types";
import { propertyOwnerLookupPack } from "@/packs/property-owner-lookup/module";

type LookupResult = LookupView & { matches?: ParcelRecord[] };

const DEFAULT_PATH = `${propertyOwnerLookupPack.apiBase}/lookup`;

/**
 * Property Owner Lookup: an address or a parcel number in, one owner record out.
 * Used as the side panel from the top bar on every Family Office screen, as the module's own
 * screen, and inside AP Inbox with that module's lookup route (which adds its property list).
 */
export function LookupPanel({ lookupPath = DEFAULT_PATH, layout = "panel", autoFocus = false }: { lookupPath?: string; layout?: "panel" | "bar"; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookUp() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    try {
      const res = await fetch(`${lookupPath}?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as LookupResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  const bar = layout === "bar";
  return (
    <div className={bar ? "flex flex-wrap items-start gap-x-6 gap-y-2" : "space-y-3"}>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookUp();
        }}
      >
        <Input
          aria-label="Address or parcel"
          placeholder="Address or parcel number"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          className={bar ? "h-7 w-72 bg-card text-sm" : "w-80 bg-card"}
        />
        <Button type="submit" size={bar ? "sm" : "default"} disabled={busy}>
          Look up
        </Button>
      </form>
      <div data-testid="parcel-lookup-result" className={bar ? "min-h-6 flex-1 text-xs" : "text-sm"}>
        {!result && !error && <span className="text-muted-foreground">Type an address or a parcel number to see who owns it.</span>}
        {error && <span className="text-risk">{error}</span>}
        {result && <LookupBody view={result} />}
      </div>
    </div>
  );
}

function LookupBody({ view }: { view: LookupResult }) {
  const r = view.result;
  if (r.kind === "one") {
    const p = r.parcel;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Mono className="font-medium">{p.parcelId}</Mono>
          <span>
            {p.address}, {p.city}, {p.state} {p.zip}
          </span>
          {view.systemProperty !== undefined && !view.systemProperty && <StatusPill tone="signal">Not in the property list</StatusPill>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Owner</dt>
          <dd>{p.holdingCompany}</dd>
          <dt className="text-muted-foreground">Entity</dt>
          {view.entity ? (
            <dd>
              <Mono>{view.entity.entityCode}</Mono>, cash account <Mono>{view.entity.cashAccount}</Mono>
            </dd>
          ) : (
            <dd className="text-muted-foreground">No entity on file for this owner</dd>
          )}
          {view.systemProperty && (
            <>
              <dt className="text-muted-foreground">Property code</dt>
              <dd>
                <Mono>{view.systemProperty.propertyCode}</Mono>
              </dd>
            </>
          )}
        </dl>
      </div>
    );
  }
  if (r.kind === "many") {
    return (
      <div className="space-y-1.5">
        <div className="font-medium">{r.candidates.length} parcels match</div>
        <ul className="divide-y">
          {r.candidates.map((c) => (
            <li key={c.parcelId} className="py-1">
              <Mono>{c.parcelId}</Mono> {c.address}, {c.city}, {c.state}, {c.holdingCompany}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <span className="text-muted-foreground">No parcel found</span>;
}

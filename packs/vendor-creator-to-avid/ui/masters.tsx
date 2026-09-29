"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mono, Panel, StatusPill } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { screenHref } from "@/lib/registry";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { vendorCreatorToAvidPack as pack } from "@/packs/vendor-creator-to-avid/module";
import type { AvidVendor, CreateVendorPayload, MastersPayload, VendorStatus, YardiVendor } from "@/packs/vendor-creator-to-avid/lib/types";
import { errorText, useMode } from "./mode";

export function Masters() {
  const { version } = useMode();
  const { data, error, refetch } = useJson<MastersPayload>(`${pack.apiBase}/masters`);
  useEffect(() => {
    if (version > 0) void refetch();
  }, [version, refetch]);
  return (
    <div>
      <ScreenHeader screen="vendor-creator-to-avid/create-the-vendor-once-in-yardi" title="Create the vendor once in Yardi" />
      <p className="mb-4 text-sm text-muted-foreground">
        Yardi is the master. Avid should carry every active Yardi vendor and never did on its own. Example data.
      </p>
      {error && <p className="mb-4 text-sm text-risk">{error}</p>}
      {!data && !error && <p className="text-muted-foreground">Loading the masters.</p>}
      {data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <VendorList system="Yardi" countTestId="yardi-count" listTestId="yardi-list" count={data.yardi.length}>
            {data.yardi.map((v) => (
              <YardiRow key={v.yardi_vendor_id} vendor={v} />
            ))}
          </VendorList>
          <div className="flex flex-col items-center justify-center gap-3 lg:w-60">
            <Link
              data-testid="gap-counter"
              href={screenHref(pack, "run-the-nightly-sync-to-avid")}
              className="block w-full rounded-lg bg-card px-4 py-3 text-center text-sm shadow-[inset_3px_0_0_var(--dept)] ring-1 ring-foreground/10 transition-colors hover:bg-dept-soft"
            >
              <span className="block text-xs text-muted-foreground">In Yardi, not in Avid:{" "}</span>
              <span className="mt-1.5 block font-heading text-3xl font-semibold leading-none tabular-nums text-dept">{data.gap}</span>
            </Link>
            <Link
              data-testid="held-counter"
              href={screenHref(pack, "decide-the-near-matches")}
              className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Near matches waiting for a decision: <span className="font-semibold tabular-nums text-signal">{data.held}</span>
            </Link>
          </div>
          <VendorList system="Avid" countTestId="avid-count" listTestId="avid-list" count={data.avid.length}>
            {data.avid.map((v) => (
              <AvidRow key={v.avid_vendor_id} vendor={v} />
            ))}
          </VendorList>
        </div>
      )}
      <Suspense fallback={null}>
        <CreateVendorFormFromQuery onCreated={refetch} />
      </Suspense>
    </div>
  );
}

function VendorList({
  system,
  count,
  countTestId,
  listTestId,
  children,
}: {
  system: string;
  count: number;
  countTestId: string;
  listTestId: string;
  children: React.ReactNode;
}) {
  return (
    <Panel
      title={system}
      className="min-w-0"
      bodyClassName="p-0"
      right={
        <span className="flex items-baseline gap-1 text-sm text-muted-foreground">
          <span data-testid={countTestId} className="font-heading text-2xl font-semibold leading-none tabular-nums text-foreground">
            {count}
          </span>{" "}
          vendors
        </span>
      }
    >
      <div data-testid={listTestId} className="max-h-[520px] overflow-y-auto">
        {children}
      </div>
    </Panel>
  );
}

const ROW = "grid items-center gap-2 border-b border-border/70 px-3 py-1.5 text-sm last:border-b-0";

function YardiRow({ vendor: v }: { vendor: YardiVendor }) {
  return (
    <div data-testid={`yardi-${v.yardi_vendor_id}`} className={cn(ROW, "grid-cols-[5.5rem_1fr_auto_5.5rem]")}>
      <Mono className="text-xs">{v.yardi_vendor_id}</Mono>
      <span className="truncate">{v.name}</span>
      <StatusPill tone={v.status === "active" ? "paid" : "lag"}>{v.status}</StatusPill>
      <span className="text-right text-xs tabular-nums text-muted-foreground">{v.created_at}</span>
    </div>
  );
}

function AvidRow({ vendor: v }: { vendor: AvidVendor }) {
  return (
    <div data-testid={`avid-${v.avid_vendor_id}`} className={cn(ROW, "grid-cols-[5.5rem_1fr_auto_5.5rem]")}>
      <Mono className="text-xs">{v.avid_vendor_id}</Mono>
      <span className="truncate">{v.name}</span>
      <StatusPill tone={v.source === "synced" ? "paid" : "neutral"}>{v.source}</StatusPill>
      <span className="text-right text-xs tabular-nums text-muted-foreground">{v.created_at}</span>
    </div>
  );
}

function CreateVendorFormFromQuery({ onCreated }: { onCreated: () => Promise<void> }) {
  const params = useSearchParams();
  const prefill = params.get("name") ?? "";
  return <CreateVendorForm key={prefill} initialName={prefill} onCreated={onCreated} />;
}

function CreateVendorForm({ initialName, onCreated }: { initialName: string; onCreated: () => Promise<void> }) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<VendorStatus>("active");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      const res = await postJson<CreateVendorPayload>(`${pack.apiBase}/masters/create`, { name, address_line: address, status });
      setNote(`${res.created.yardi_vendor_id} ${res.created.name} created in Yardi. It syncs tonight.`);
      setName("");
      setAddress("");
      setStatus("active");
      await onCreated();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-lg font-semibold">Create vendor in Yardi</h2>
      <p className="mb-3 text-sm text-muted-foreground">A stand-in for the Yardi vendor screen. This is the only place anyone types a vendor.</p>
      <Panel>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vendor-name">Name</Label>
            <Input id="vendor-name" name="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vendor-address">Address line</Label>
            <Input id="vendor-address" name="address_line" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Status</legend>
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="vendor-status" value="active" className="accent-dept" checked={status === "active"} onChange={() => setStatus("active")} />
                Active
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="vendor-status" value="inactive" className="accent-dept" checked={status === "inactive"} onChange={() => setStatus("inactive")} />
                Inactive
              </label>
            </div>
          </fieldset>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating" : "Create vendor in Yardi"}
          </Button>
          {note && (
            <p data-testid="create-note" className="rounded-md bg-paid-soft px-3 py-2 text-sm text-paid ring-1 ring-inset ring-paid/25">
              {note}
            </p>
          )}
          {problem && <p className="text-sm text-risk">{problem}</p>}
        </form>
      </Panel>
    </section>
  );
}

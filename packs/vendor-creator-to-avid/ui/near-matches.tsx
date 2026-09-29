"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState, Mono, StatusPill } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { screenHref } from "@/lib/registry";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import { vendorCreatorToAvidPack as pack } from "@/packs/vendor-creator-to-avid/module";
import type { DecideBody, NearMatchesPayload, PairView } from "@/packs/vendor-creator-to-avid/lib/types";
import { errorText, useMode } from "./mode";

type DecisionChoice = DecideBody["decision"];

export function NearMatches() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading near matches.</p>}>
      <NearMatchesInner />
    </Suspense>
  );
}

function NearMatchesInner() {
  const params = useSearchParams();
  const highlight = params.get("pair");
  const { version, saving } = useMode();
  const { data, error, refetch } = useJson<NearMatchesPayload>(`${pack.apiBase}/near-matches`);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    if (version > 0) void refetch();
  }, [version, refetch]);

  async function decide(pair: PairView, decision: DecisionChoice) {
    const y = pair.candidate.yardi_vendor_id;
    const a = pair.candidate.avid_vendor_id;
    setBusy(y);
    setProblem(null);
    try {
      const body: DecideBody = { yardi_vendor_id: y, avid_vendor_id: a, decision };
      await postJson<NearMatchesPayload>(`${pack.apiBase}/near-matches/decide`, body);
      setNote(
        decision === "link"
          ? `Linked ${y} to ${a}. Nothing was created.`
          : decision === "create"
            ? `${y} will be created as a separate vendor.`
            : `${y} stays held.`,
      );
      await refetch();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ScreenHeader
        screen="vendor-creator-to-avid/decide-the-near-matches"
        title="Decide the near matches"
        right={
          <LinkButton variant="outline" href={screenHref(pack, "run-the-nightly-sync-to-avid")}>
            Back to Run the nightly sync to Avid
          </LinkButton>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">Two names that might be the same vendor. It does not guess; it asks.</p>
      {error && <p className="mb-4 text-sm text-risk">{error}</p>}
      {problem && <p className="mb-4 text-sm text-risk">{problem}</p>}
      {note && (
        <p data-testid="decision-note" className="mb-4 rounded-md bg-paid-soft px-3 py-2 text-sm text-paid ring-1 ring-inset ring-paid/25">
          {note}
        </p>
      )}
      {!data && !error && <p className="text-muted-foreground">Loading near matches.</p>}
      {data && data.held.length === 0 && (
        <EmptyState title="No near matches waiting. Run the nightly sync to Avid to compare the two masters; any pair that might be the same vendor lands here." />
      )}
      {data && data.held.length > 0 && (
        <div className="space-y-4">
          {data.held.map((pair) => (
            <PairCard
              key={`${pair.candidate.yardi_vendor_id}-${pair.candidate.avid_vendor_id}`}
              pair={pair}
              highlighted={highlight === pair.candidate.yardi_vendor_id}
              busy={busy === pair.candidate.yardi_vendor_id || saving}
              onDecide={(d) => void decide(pair, d)}
            />
          ))}
        </div>
      )}
      {data && (
        <section data-testid="decided-list" className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Decided</h2>
          {data.decided.length === 0 && <EmptyState title="Nothing decided yet. Press Same vendor, link or Different, create on a pair above." />}
          <ul className="space-y-1.5 text-sm">
            {data.decided.map((p) => {
              const y = p.candidate.yardi_vendor_id;
              const a = p.candidate.avid_vendor_id;
              return (
                <li key={`${y}-${a}`} data-testid={`decided-${y}-${a}`} className="rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10">
                  <Mono className="text-xs">{y}</Mono> {p.yardi.name} <span className="text-muted-foreground">and</span>{" "}
                  <Mono className="text-xs">{a}</Mono> {p.avid.name}:{" "}
                  <span className="font-medium">{p.candidate.decision === "link" ? "Same vendor, linked by hand" : "Different vendor, created"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function PairCard({ pair, highlighted, busy, onDecide }: { pair: PairView; highlighted: boolean; busy: boolean; onDecide: (d: DecisionChoice) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  const y = pair.candidate.yardi_vendor_id;
  const a = pair.candidate.avid_vendor_id;
  const id = `pair-${y}-${a}`;
  return (
    <Card ref={ref} data-testid={id} className={cn(highlighted && "ring-2 ring-dept")}>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <RecordColumn
            system="Yardi"
            id={y}
            name={pair.yardi.name}
            normalized={pair.yardi_normalized}
            normalizedTestId={`${id}-yardi-normalized`}
            address={pair.yardi.address_line}
            taxLast4={pair.yardi.tax_id_last4}
          />
          <RecordColumn
            system="Avid"
            id={a}
            name={pair.avid.name}
            normalized={pair.avid_normalized}
            normalizedTestId={`${id}-avid-normalized`}
            address={pair.avid.address_line}
            taxLast4={pair.avid.tax_id_last4 ?? "unknown"}
          />
        </div>
        <div className="mt-4 text-sm">
          <Mono className="text-xs">score {pair.candidate.score.toFixed(2)}</Mono>
          <ul data-testid={`${id}-reasons`} className="mt-1 flex flex-wrap gap-1.5">
            {pair.candidate.reasons.map((r) => (
              <li key={r}>
                <StatusPill tone="neutral">{r}</StatusPill>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onDecide("link")} disabled={busy}>
            Same vendor, link
          </Button>
          <Button variant="outline" onClick={() => onDecide("create")} disabled={busy}>
            Different, create
          </Button>
          <Button variant="ghost" onClick={() => onDecide("later")} disabled={busy}>
            Decide later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordColumn({
  system,
  id,
  name,
  normalized,
  normalizedTestId,
  address,
  taxLast4,
}: {
  system: string;
  id: string;
  name: string;
  normalized: string;
  normalizedTestId: string;
  address: string;
  taxLast4: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3 text-sm ring-1 ring-inset ring-border">
      <h3 className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{system}</h3>
      <div>
        <Mono className="text-xs">{id}</Mono>
      </div>
      <div className="font-medium">{name}</div>
      <div className="font-mono text-xs text-muted-foreground" data-testid={normalizedTestId}>
        normalized: {normalized}
      </div>
      <div className="mt-1">{address}</div>
      <div className="text-muted-foreground">
        tax id ends <Mono>{taxLast4}</Mono>
      </div>
    </div>
  );
}

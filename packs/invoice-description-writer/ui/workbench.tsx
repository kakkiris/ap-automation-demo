"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState, Mono, StatusPill } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { postJson, useJson } from "@/lib/use-json";
import { screenHref } from "@/lib/registry";
import { invoiceDescriptionWriterPack as pack } from "@/packs/invoice-description-writer/module";
import { DESCRIPTION_MAX_LENGTH } from "@/packs/invoice-description-writer/lib/types";
import type { FeedbackRequest, FieldReading, InboxPayload, WorkbenchPayload } from "@/packs/invoice-description-writer/lib/types";
import { errorText } from "./format";
import { CopyButton } from "./copy-button";
import { StatusBadge, TierBadge } from "./status-badge";

export function Workbench() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const inbox = useJson<InboxPayload>(id ? null : `${pack.apiBase}/inbox`);
  const bench = useJson<WorkbenchPayload>(id ? `${pack.apiBase}/workbench?id=${encodeURIComponent(id)}` : null);

  const firstId = inbox.data?.items[0]?.invoice_id ?? null;
  useEffect(() => {
    if (!id && firstId) router.replace(`${screenHref(pack, "write-the-invoice-description")}?id=${firstId}`);
  }, [id, firstId, router]);

  if (!id) {
    if (inbox.error) return <NotOpen text={errorText(inbox.error)} />;
    if (inbox.data && !inbox.data.received) return <NotOpen text="Press Receive invoices first." />;
    if (inbox.data) return <NotOpen text="Pick an invoice from today's invoices to write its description." />;
    return <p className="text-muted-foreground">Loading today&apos;s invoices.</p>;
  }
  if (bench.error) return <NotOpen text={errorText(bench.error)} />;
  const payload = bench.data && bench.data.invoice.invoice_id === id ? bench.data : null;
  if (!payload) return <p className="text-muted-foreground">Loading the invoice.</p>;
  return <InvoiceView key={id} initial={payload} />;
}

function NotOpen({ text }: { text: string }) {
  return (
    <div>
      <ScreenHeader screen="invoice-description-writer/write-the-invoice-description" title="Write the invoice description" />
      <EmptyState title={text} action={{ href: screenHref(pack, "receive-todays-invoices"), label: "Back to today's invoices" }} />
    </div>
  );
}

function feedbackNote(view: WorkbenchPayload): string | null {
  const f = view.feedback;
  if (!f) return null;
  if (f.outcome === "used") return "Recorded: used as is.";
  const code = f.corrected_gl ?? "";
  const name = view.gl_accounts.find((g) => g.gl_code === code)?.gl_name;
  return `Recorded: corrected to ${name ? `${code} ${name}` : code}.`;
}

/** One invoice. Keyed by invoice id from the parent so local state starts fresh on every move. */
function InvoiceView({ initial }: { initial: WorkbenchPayload }) {
  const [local, setLocal] = useState<WorkbenchPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const view = local ?? initial;
  const inv = view.invoice;
  const routed = view.routed_note !== null;
  const manual = inv.status === "manual";

  async function send(body: FeedbackRequest) {
    setBusy(true);
    setProblem(null);
    try {
      const next = await postJson<WorkbenchPayload>(`${pack.apiBase}/feedback`, body);
      setLocal(next);
      setPicking(false);
      setChoice("");
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const note = feedbackNote(view);
  const basis_total = view.suggestion?.basis_total ?? 0;

  return (
    <div>
      <ScreenHeader
        screen="invoice-description-writer/write-the-invoice-description"
        title="Write the invoice description"
        right={
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground tabular-nums" data-testid="position">
              {view.position} of {view.total}
            </span>
            {view.prev_id && (
              <LinkButton variant="outline" size="sm" href={`${screenHref(pack, "write-the-invoice-description")}?id=${view.prev_id}`}>
                Previous invoice
              </LinkButton>
            )}
            {view.next_id && (
              <LinkButton variant="outline" size="sm" href={`${screenHref(pack, "write-the-invoice-description")}?id=${view.next_id}`}>
                Next invoice
              </LinkButton>
            )}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={inv.preview_path} alt={`Invoice ${inv.invoice_id}`} className="w-full" />
          </div>
          <a href={inv.pdf_path} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-dept underline underline-offset-4">
            Open PDF
          </a>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Mono className="text-base font-semibold">{inv.invoice_id}</Mono>
            <StatusBadge status={inv.status} data-testid="invoice-status" />
            {view.vendor ? (
              <Link data-testid="vendor-link" className="font-medium text-dept underline underline-offset-4" href={`${screenHref(pack, "how-this-vendor-was-coded-before")}?vendor_id=${view.vendor.vendor_id}`}>
                {view.vendor.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">{view.vendor_name_as_read ?? "vendor not read"}</span>
            )}
          </div>

          {routed && (
            <Card data-testid="routed-note">
              <CardHeader>
                <CardTitle>Routed out</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p>{view.routed_note}</p>
                <p className="text-muted-foreground">Nothing to paste here.</p>
              </CardContent>
            </Card>
          )}

          {!routed && <FieldsPanel fields={view.fields} />}

          {manual && view.extraction && (
            <Card data-testid="manual-card" className="ring-signal/40">
              <CardHeader>
                <CardTitle>Needs manual entry</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>The reader could not find these fields:</p>
                <ul data-testid="manual-fields" className="list-disc pl-5">
                  {view.manual_entry.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                {view.extraction.reasons.map((r) => (
                  <p key={r} className="text-xs text-muted-foreground">
                    {r}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {view.description && (
            <Card data-testid="description-card" className="shadow-[inset_3px_0_0_var(--dept)]">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p data-testid="description-text" className="rounded-md bg-muted p-3 font-mono text-sm leading-relaxed tabular-nums break-words">{view.description.text}</p>
                <p data-testid="template-line" className="font-mono text-xs text-muted-foreground/70">
                  {view.template}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <CopyButton text={view.description.text} label="Copy description" variant="default" size="default" />
                  {view.description.truncated && (
                    <span className="text-xs text-muted-foreground">Shortened to fit {DESCRIPTION_MAX_LENGTH} characters.</span>
                  )}
                  {view.description.missing_fields.length > 0 && (
                    <span className="text-xs text-muted-foreground">Stated as missing, never guessed.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {view.suggestion && (
            <Card data-testid="gl-card">
              <CardHeader>
                <CardTitle>Suggested code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {view.suggestion.tier === "none" ? (
                  <p data-testid="gl-none" className="text-muted-foreground">
                    no history for this vendor
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <span data-testid="gl-code" className="text-lg font-semibold">
                        <Mono>{view.suggestion.gl_code}</Mono> {view.suggestion.gl_name}
                      </span>
                      <TierBadge tier={view.suggestion.tier} data-testid="gl-tier" />
                    </div>
                    <p data-testid="gl-basis" className="text-muted-foreground">
                      coded to this {view.suggestion.basis_count} of {view.suggestion.basis_total} times
                    </p>
                    {view.suggestion.alternatives.length > 0 && (
                      <ul data-testid="gl-alternatives" className="text-muted-foreground">
                        {view.suggestion.alternatives.map((a) => (
                          <li key={a.gl_code}>
                            also used: <Mono>{a.gl_code}</Mono> {a.gl_name}, {a.count} of {basis_total}
                          </li>
                        ))}
                      </ul>
                    )}
                    {view.suggestion.gl_code && <CopyButton text={view.suggestion.gl_code} label="Copy code" />}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {view.suggestion && (
            <Card>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => send({ invoice_id: inv.invoice_id, outcome: "used" })} disabled={busy || !view.suggestion.gl_code}>
                    Used as is
                  </Button>
                  <Button variant="outline" onClick={() => setPicking(true)} disabled={busy}>
                    Corrected
                  </Button>
                </div>
                {picking && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Corrected code"
                      data-testid="corrected-code"
                      className="h-7 rounded-md border bg-background px-2 text-sm"
                      value={choice}
                      onChange={(e) => setChoice(e.target.value)}
                    >
                      <option value="">Pick the right code</option>
                      {view.gl_accounts.map((g) => (
                        <option key={g.gl_code} value={g.gl_code}>
                          {g.gl_code} {g.gl_name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => send({ invoice_id: inv.invoice_id, outcome: "corrected", corrected_gl: choice })} disabled={!choice || busy}>
                      Record correction
                    </Button>
                  </div>
                )}
                {note && (
                  <p data-testid="feedback-note" className="font-medium text-paid">
                    {note}
                  </p>
                )}
                {problem && <p className="rounded-md border border-risk/30 bg-risk-soft p-2 text-risk">{problem}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Fields the reader prints as identifiers or money; they take the mono face with tabular figures. */
const MONO_FIELDS = new Set<string>(["invoice_number", "amount", "account_number", "meter_number"]);

function FieldsPanel({ fields }: { fields: FieldReading[] }) {
  return (
    <div data-testid="fields" className="divide-y overflow-hidden rounded-xl bg-card text-sm ring-1 ring-foreground/10">
      {fields.map((f) => (
        <div key={f.key} data-testid={`field-${f.key}`} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-baseline gap-3 px-4 py-1.5">
          <span className="text-muted-foreground">{f.label}</span>
          {f.value !== null ? <span className={MONO_FIELDS.has(f.key) ? "font-mono tabular-nums" : undefined}>{f.value}</span> : <span className="text-muted-foreground/70">not on invoice</span>}
          <StatusPill data-testid={`marker-${f.key}`} tone={f.read ? "paid" : "lag"}>
            {f.read ? "read from PDF" : "not on invoice"}
          </StatusPill>
        </div>
      ))}
    </div>
  );
}

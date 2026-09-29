"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/link-button";
import { EmptyState, Mono, Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { cn } from "@/lib/utils";
import { useJson } from "@/lib/use-json";
import { screenHref } from "@/lib/registry";
import { invoiceDescriptionWriterPack as pack } from "@/packs/invoice-description-writer/module";
import type { VendorHistoryPayload, VendorSummary } from "@/packs/invoice-description-writer/lib/types";
import { errorText } from "./format";

const DEFAULT_VENDOR = "V-01";

const TH = "px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function VendorHistory() {
  const params = useSearchParams();
  const router = useRouter();
  const vendorId = params.get("vendor_id") ?? DEFAULT_VENDOR;
  const vendors = useJson<{ vendors: VendorSummary[] }>(`${pack.apiBase}/vendors`);
  const history = useJson<VendorHistoryPayload>(`${pack.apiBase}/vendor-history?vendor_id=${encodeURIComponent(vendorId)}`);
  const data = history.data && history.data.vendor.vendor_id === vendorId ? history.data : null;

  const picker = (
    <div className="flex items-center gap-2">
      <select
        aria-label="Vendor"
        data-testid="vendor-picker"
        className="h-7 rounded-md border bg-background px-2 text-sm"
        value={vendorId}
        onChange={(e) => router.replace(`${screenHref(pack, "how-this-vendor-was-coded-before")}?vendor_id=${e.target.value}`)}
      >
        {(vendors.data?.vendors ?? []).map((v) => (
          <option key={v.vendor_id} value={v.vendor_id}>
            {v.vendor_id} {v.name}
          </option>
        ))}
        {!vendors.data && <option value={vendorId}>{vendorId}</option>}
      </select>
      <LinkButton variant="outline" size="sm" href={screenHref(pack, "write-the-invoice-description")}>
        Back to the invoice description
      </LinkButton>
    </div>
  );

  if (history.error) {
    return (
      <div>
        <ScreenHeader screen="invoice-description-writer/how-this-vendor-was-coded-before" title="How this vendor was coded before" right={picker} />
        <p className="text-sm text-risk">{errorText(history.error)}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <ScreenHeader screen="invoice-description-writer/how-this-vendor-was-coded-before" title="How this vendor was coded before" right={picker} />
        <p className="text-muted-foreground">Loading how this vendor was coded before.</p>
      </div>
    );
  }

  const v = data.vendor;
  return (
    <div>
      <ScreenHeader screen="invoice-description-writer/how-this-vendor-was-coded-before" title="How this vendor was coded before" right={picker} />
      <p className="mb-3 text-sm">
        <span className="font-semibold">{v.name}</span>, {v.service_type === "single" ? "single-service vendor" : "multi-service vendor"}
        {v.default_gl && <>, default code <Mono>{v.default_gl}</Mono></>}
      </p>
      {data.rows.length === 0 ? (
        <EmptyState title="No codings on record for this vendor." />
      ) : (
        <Panel accent bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Code</TableHead>
                <TableHead className={TH}>Name</TableHead>
                <TableHead className={cn(TH, "text-right")}>Codings</TableHead>
                <TableHead className={TH}>Last used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.gl_code} data-testid={`history-row-${r.gl_code}`}>
                  <TableCell className="px-3 font-mono font-medium tabular-nums">{r.gl_code}</TableCell>
                  <TableCell className="px-3">{r.gl_name}</TableCell>
                  <TableCell className="px-3 text-right font-mono tabular-nums">{r.count}</TableCell>
                  <TableCell className="px-3 text-muted-foreground tabular-nums">{r.last_used}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">{data.total} codings in the last six months, example data.</p>

      <section className="mt-6">
        <h2 className="mb-2 text-base font-semibold">This session</h2>
        {data.session.length === 0 ? (
          <p data-testid="session-empty" className="text-sm text-muted-foreground">
            No corrections or confirmations yet.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.session.map((line, i) => (
              <li key={`${line.invoice_id}-${i}`} data-testid="session-line" className="rounded-md bg-paid-soft px-3 py-1.5 text-paid ring-1 ring-inset ring-paid/25">
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";
import Link from "next/link";
import { Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { ArchiveView } from "@/packs/ap-inbox/lib/types";
import { apiBase, ErrorLine, ExampleData, fmtWhen, Loading, reviewHref, SourceBadge, StateBadge, TD, TH, THEAD, TR } from "./shared";

export function Archive() {
  const { data, error } = useJson<ArchiveView>(`${apiBase}/archive`);
  return (
    <div>
      <ScreenHeader screen="ap-inbox/document-archive" title="Document archive" />
      <p className="mb-1 text-sm text-muted-foreground">Every document that came in, by week, with the door it used and the invoice it became. Each one is filed to the shared drive on arrival.</p>
      <ExampleData />
      {error && <ErrorLine text={error} />}
      {!data && !error && <Loading what="the weeks" />}
      {data &&
        data.weeks.map((week) => (
          <Panel key={week.weekStart} title={week.label} className="mt-4" bodyClassName="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>File</th>
                  <th className={TH}>Received</th>
                  <th className={TH}>Source</th>
                  <th className={TH}>Payee</th>
                  <th className={TH}>State</th>
                  <th className={TH}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {week.documents.map((d) => (
                  <tr key={d.itemId} data-testid={`archive-row-${d.itemId}`} className={TR}>
                    <td className={cn(TD, "font-mono text-xs tabular-nums")}>
                      <a href={d.documentUrl} target="_blank" rel="noreferrer" className="hover:underline">
                        {d.fileName}
                      </a>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-muted-foreground tabular-nums")}>{fmtWhen(d.receivedAt)}</td>
                    <td className={TD}>
                      <SourceBadge source={d.source} />
                    </td>
                    <td className={TD}>{d.payee ?? ""}</td>
                    <td className={TD}>
                      <StateBadge state={d.state} testId="archive-state" />
                    </td>
                    <td className={TD}>
                      <Link href={reviewHref(d.itemId)} className="hover:underline">
                        Review this invoice
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">{d.itemId}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
    </div>
  );
}

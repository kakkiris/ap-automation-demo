"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, StatusPill, type Tone } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";
import type { TrackerReason, TrackerView } from "@/packs/ap-inbox/lib/types";
import { apiBase, ErrorLine, ExampleData, fmtWhen, href, ItemLink, Loading, SourceBadge } from "./shared";

// Why a message was posted: captured is informational, submitted is the department's move, paid is paid.
const REASON_TONE: Record<TrackerReason, Tone> = {
  captured: "info",
  submitted: "dept",
  paid: "paid",
};

const FILTER_LABEL = "came by email, not on a Monday.com card before";

export function Tracker() {
  const { data, error } = useJson<TrackerView>(`${apiBase}/tracker`);
  const [emailOnly, setEmailOnly] = useState(false);
  const cards = data ? (emailOnly ? data.cards.filter((c) => c.cameByEmailNotInTrackerBefore) : data.cards) : [];

  return (
    <div>
      <ScreenHeader screen="ap-inbox/property-tracker-updates" title="Property tracker updates" />
      {error && <ErrorLine text={error} />}
      {!data && !error && <Loading what="the cards" />}
      {data && (
        <>
          <p className="mb-1 text-sm text-muted-foreground">
            What this week would post to each property&apos;s Monday.com card: {data.updateCount} messages on {data.cards.length} cards. Nothing is sent from the demo.
          </p>
          <ExampleData />
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
            <Switch id="email-filter" data-testid="email-filter" aria-label={FILTER_LABEL} checked={emailOnly} onCheckedChange={(checked) => setEmailOnly(checked)} />
            <Label htmlFor="email-filter" className="cursor-pointer font-normal">
              {FILTER_LABEL}
            </Label>
            <span className="text-xs text-muted-foreground">
              {data.emailNewCount} {data.emailNewCount === 1 ? "card" : "cards"} this week
            </span>
            {emailOnly && <span className="ml-auto text-xs text-muted-foreground">Showing {cards.length}</span>}
          </div>
          {cards.length === 0 ? (
            emailOnly ? (
              <EmptyState title="No card came by email without a Monday.com card before." />
            ) : (
              <EmptyState title="No messages yet. Open this week's arrivals to capture the week." action={{ href: href("this-weeks-arrivals"), label: "Open this week's arrivals" }} />
            )
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {cards.map((c) => {
                const paid = c.updates.some((u) => u.reason === "paid");
                return (
                  <Card key={c.cardRef} data-testid={`tracker-card-${c.cardRef}`} className={cn(c.cameByEmailNotInTrackerBefore && "ring-signal/40")}>
                    <CardHeader>
                      <CardTitle>
                        <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                          <span>
                            <span className="font-mono tabular-nums">{c.cardRef}</span> {c.address}
                          </span>
                          {c.newCard && <StatusPill tone="signal">New card</StatusPill>}
                          {paid && <StatusPill tone="paid">Paid</StatusPill>}
                        </h2>
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">{c.parcelId}</span>
                        {c.itemIds.map((id) => (
                          <ItemLink key={id} itemId={id} className="text-xs" />
                        ))}
                        {c.cameByEmailNotInTrackerBefore && <span className="text-signal">Came by email, not in tracker before</span>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {c.updates.map((u) => (
                          <li key={u.updateId} className="flex items-start gap-2 text-sm">
                            <StatusPill tone={REASON_TONE[u.reason]} className="mt-0.5 shrink-0">
                              {u.reason}
                            </StatusPill>
                            <div className="min-w-0">
                              <div>{u.message}</div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="tabular-nums">{fmtWhen(u.createdAt)}</span>
                                <SourceBadge source={u.source} className="px-1 py-0 text-[10px]" />
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

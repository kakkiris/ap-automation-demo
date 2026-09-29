"use client";
import { Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { LookupPanel } from "./lookup-panel";

export function LookupScreen() {
  return (
    <div>
      <ScreenHeader screen="property-owner-lookup/look-up-an-owner" title="Look up an owner" />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        A parcel number is matched first; a street address is cleaned and matched second. One owner comes back, or the parcels that could be meant, or nothing. The same lookup runs inside AP Inbox on every invoice.
      </p>
      <Panel accent className="max-w-3xl">
        <LookupPanel autoFocus />
      </Panel>
    </div>
  );
}

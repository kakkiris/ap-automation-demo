"use client";
import { Mono, Panel } from "@/components/shell/kit";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useJson } from "@/lib/use-json";
import type { Entity } from "@/packs/property-owner-lookup/lib/entities";
import { propertyOwnerLookupPack } from "@/packs/property-owner-lookup/module";

const TH = "text-xs uppercase tracking-wide text-muted-foreground";

/** Owner to entity map: one row per owner, the entity code and cash account an invoice for its property carries. */
export function EntityMap() {
  const { data, error } = useJson<{ entities: Entity[]; parcelsPerOwner: Record<string, number> }>(`${propertyOwnerLookupPack.apiBase}/entities`);
  return (
    <div>
      <ScreenHeader screen="property-owner-lookup/owner-to-entity-map" title="Owner to entity map" />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Every parcel has one owner. Every owner has one entity code and one cash account. This is the map the lookup and the coding rules read; it is example data.
      </p>
      {error && <p className="text-sm text-risk">{error}</p>}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading the map.</p>}
      {data && (
        <Panel accent bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={`${TH} px-4`}>Owner</TableHead>
                <TableHead className={TH}>Entity code</TableHead>
                <TableHead className={TH}>Cash account</TableHead>
                <TableHead className={TH}>Kind</TableHead>
                <TableHead className={`${TH} px-4 text-right`}>Parcels</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entities.map((e) => (
                <TableRow key={e.entityCode} data-entity={e.entityCode}>
                  <TableCell className="px-4 font-medium">{e.name}</TableCell>
                  <TableCell>
                    <Mono>{e.entityCode}</Mono>
                  </TableCell>
                  <TableCell>
                    <Mono>{e.cashAccount}</Mono>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.kind === "operating" ? "operating company" : "holding company"}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{data.parcelsPerOwner[e.name] ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}

import type { Resolution } from "./types";
import { loadParcels } from "./registry";
import { findParcelText } from "./resolve";
import { entityForOwner, type Entity } from "./entities";

/** What the lookup panel shows: the resolution, the owner's entity, and optionally the
 *  importing module's own note about the parcel (AP Inbox adds its property list). */
export interface LookupView {
  query: string;
  result: Resolution;
  entity: Entity | null;
  systemProperty?: { propertyCode: string } | null;
}

export function lookupView(query: string): LookupView {
  const result = findParcelText(query, loadParcels());
  const parcel = result.kind === "one" ? result.parcel : null;
  return { query, result, entity: parcel ? entityForOwner(parcel.holdingCompany) : null };
}

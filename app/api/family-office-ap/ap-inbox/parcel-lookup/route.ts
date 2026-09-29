import { loadParcels, searchParcels } from "@/packs/property-owner-lookup/lib";
import { getStore } from "@/packs/ap-inbox/store";
import { parcelLookupView } from "@/packs/ap-inbox/lib/views";
import { run } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
// The shared lookup plus this module's own note: whether the parcel is on the property list.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(0, parseInt(url.searchParams.get("limit") ?? "0", 10) || 0));
  return run(() => ({ ...parcelLookupView(getStore(), q), matches: limit > 0 ? searchParcels(q, loadParcels(), limit) : [] }));
}

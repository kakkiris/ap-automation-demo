import { json } from "@/lib/api";
import { entityList, loadParcels } from "@/packs/property-owner-lookup/lib";
export const dynamic = "force-dynamic";
export async function GET() {
  const parcelsPerOwner: Record<string, number> = {};
  for (const p of loadParcels()) parcelsPerOwner[p.holdingCompany] = (parcelsPerOwner[p.holdingCompany] ?? 0) + 1;
  return json({ entities: entityList(), parcelsPerOwner });
}

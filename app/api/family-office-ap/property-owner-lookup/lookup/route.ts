import { json, fail } from "@/lib/api";
import { loadParcels, searchParcels } from "@/packs/property-owner-lookup/lib";
import { lookupView } from "@/packs/property-owner-lookup/lib/lookup";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(50, Math.max(0, parseInt(url.searchParams.get("limit") ?? "0", 10) || 0));
    return json({ ...lookupView(q), matches: limit > 0 ? searchParcels(q, loadParcels(), limit) : [] });
  } catch (err) {
    return fail((err as Error).message, 500);
  }
}

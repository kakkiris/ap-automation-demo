import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { siteChecklist } from "@/packs/utility-bills-to-yardi/lib/mechanisms";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const store = getStore();
  const site = new URL(req.url).searchParams.get("site");
  if (!site) return fail("site is required");
  const property = store.properties.find((p) => p.id === site);
  if (!property) return fail("site not found", 404);
  return json({ property, checklist: siteChecklist(store, site, store.demo_month) });
}

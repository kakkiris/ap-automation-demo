import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { masterView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const store = getStore();
  const site = new URL(req.url).searchParams.get("site") ?? store.scripted["A"];
  const view = masterView(store, site);
  return view ? json(view) : fail("site not found", 404);
}

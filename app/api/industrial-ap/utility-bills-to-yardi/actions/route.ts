import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { actionList } from "@/packs/utility-bills-to-yardi/lib/actions";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const store = getStore();
  const site = new URL(req.url).searchParams.get("site");
  return json(actionList(store, site && site !== "all" ? site : null, store.demo_month));
}

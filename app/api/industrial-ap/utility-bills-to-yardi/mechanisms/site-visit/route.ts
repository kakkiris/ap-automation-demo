import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { applySiteVisit } from "@/packs/utility-bills-to-yardi/lib/mechanisms";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  return json(applySiteVisit(store, store.demo_month));
}

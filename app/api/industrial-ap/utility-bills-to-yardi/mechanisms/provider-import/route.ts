import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { providerImport } from "@/packs/utility-bills-to-yardi/lib/mechanisms";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  return json(providerImport(store, store.demo_month));
}

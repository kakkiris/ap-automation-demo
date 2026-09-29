import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { yardiImport } from "@/packs/utility-bills-to-yardi/lib/import";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  try {
    return json(yardiImport(store, store.demo_month));
  } catch (err) {
    return fail((err as Error).message);
  }
}

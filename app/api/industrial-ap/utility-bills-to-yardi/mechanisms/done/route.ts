import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  store.operator_steps.done = true;
  return json({ ok: true });
}

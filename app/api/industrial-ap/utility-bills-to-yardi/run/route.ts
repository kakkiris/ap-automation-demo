import { fail, json } from "@/lib/api";
import cannedJson from "@/data/canned-extractions.json";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { runMonth, snapshot, type Canned } from "@/packs/utility-bills-to-yardi/lib/run";
import { captureView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  if (store.runs[store.demo_month]) return fail("this month already ran");
  const canned = cannedJson as unknown as Canned;
  snapshot(store, `run ${store.demo_month}`);
  const report = runMonth(store, store.demo_month, canned);
  return json({ report, capture: captureView(store) });
}

import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { doBillBack } from "@/packs/utility-bills-to-yardi/lib/actions";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { meter_id?: string };
  if (!body.meter_id) return fail("meter_id is required");
  try {
    const store = getStore();
    return json({ row: doBillBack(store, body.meter_id, store.demo_month) });
  } catch (err) {
    return fail((err as Error).message);
  }
}

import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { markCalled } from "@/packs/utility-bills-to-yardi/lib/actions";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { account_number?: string; provider?: string; note?: string };
  if (!body.account_number || !body.provider) return fail("account_number and provider are required");
  const store = getStore();
  return json({ note: markCalled(store, body.account_number, body.provider, body.note ?? "called", store.demo_month) });
}

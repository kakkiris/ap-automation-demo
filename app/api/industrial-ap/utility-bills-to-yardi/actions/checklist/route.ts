import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { makeChecklist } from "@/packs/utility-bills-to-yardi/lib/actions";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { site?: string };
  if (!body.site) return fail("site is required");
  const store = getStore();
  return json({ checklist: makeChecklist(store, body.site, store.demo_month) });
}

import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { whyView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const meter = u.searchParams.get("meter");
  const month = u.searchParams.get("month") ?? getStore().demo_month;
  if (!meter) return fail("meter is required");
  const view = whyView(getStore(), meter, month);
  return view ? json(view) : fail("meter not found", 404);
}

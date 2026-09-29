import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { gridView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get("site");
  if (!site) return fail("site is required");
  const view = gridView(getStore(), site);
  return view ? json(view) : fail("site not found", 404);
}

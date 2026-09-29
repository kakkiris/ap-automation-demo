import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { confirmMatch } from "@/packs/utility-bills-to-yardi/lib/matches";
import { matchesView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { line_id?: string; account_number?: string };
  if (!body.line_id || !body.account_number) return fail("line_id and account_number are required");
  try {
    confirmMatch(getStore(), body.line_id, body.account_number);
    const store = getStore();
    if (matchesView(store).items.length === 0) store.operator_steps.matches = true;
    return json(matchesView(store));
  } catch (err) {
    return fail((err as Error).message);
  }
}

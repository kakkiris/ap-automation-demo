import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { resolveException, type ExceptionAction } from "@/packs/utility-bills-to-yardi/lib/exceptions";
import { queueView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: ExceptionAction };
  if (!body.id || !body.action) return fail("id and action are required");
  try {
    const ex = resolveException(getStore(), body.id, body.action);
    return json({ exception: ex, queue: queueView(getStore()) });
  } catch (err) {
    return fail((err as Error).message);
  }
}

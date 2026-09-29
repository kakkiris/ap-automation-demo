import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { decide, nearMatchesPayload } from "@/packs/vendor-creator-to-avid/lib/sync";
import type { DecideBody } from "@/packs/vendor-creator-to-avid/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<DecideBody>;
  if (typeof body.yardi_vendor_id !== "string" || typeof body.avid_vendor_id !== "string") return fail("yardi_vendor_id and avid_vendor_id are required");
  if (body.decision !== "link" && body.decision !== "create" && body.decision !== "later") return fail("decision must be link, create, or later");
  try {
    const store = getStore();
    decide(store, body.yardi_vendor_id, body.avid_vendor_id, body.decision);
    return json(nearMatchesPayload(store));
  } catch (err) {
    return fail((err as Error).message);
  }
}

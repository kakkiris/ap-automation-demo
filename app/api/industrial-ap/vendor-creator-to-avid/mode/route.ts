import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { statePayload } from "@/packs/vendor-creator-to-avid/lib/sync";
import type { ModeBody } from "@/packs/vendor-creator-to-avid/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<ModeBody>;
  if (body.mode !== "assisted" && body.mode !== "automatic") return fail("mode must be assisted or automatic");
  const store = getStore();
  store.mode = body.mode;
  return json(statePayload(store));
}

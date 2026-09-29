import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { createYardiVendor, mastersPayload } from "@/packs/vendor-creator-to-avid/lib/sync";
import type { CreateVendorBody, CreateVendorPayload } from "@/packs/vendor-creator-to-avid/lib/types";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateVendorBody;
  try {
    const store = getStore();
    const created = createYardiVendor(store, body);
    const payload: CreateVendorPayload = { ...mastersPayload(store), created };
    return json(payload);
  } catch (err) {
    return fail((err as Error).message);
  }
}

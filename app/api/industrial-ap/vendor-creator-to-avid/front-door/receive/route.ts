import { json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { frontDoorPayload, receiveInvoices } from "@/packs/vendor-creator-to-avid/lib/frontdoor";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = getStore();
  receiveInvoices(store);
  return json(frontDoorPayload(store));
}

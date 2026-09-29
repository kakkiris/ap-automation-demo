import { json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { frontDoorPayload } from "@/packs/vendor-creator-to-avid/lib/frontdoor";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(frontDoorPayload(getStore()));
}

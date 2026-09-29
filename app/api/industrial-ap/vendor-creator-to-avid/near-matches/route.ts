import { json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { nearMatchesPayload } from "@/packs/vendor-creator-to-avid/lib/sync";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(nearMatchesPayload(getStore()));
}

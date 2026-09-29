import { json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { mastersPayload } from "@/packs/vendor-creator-to-avid/lib/sync";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(mastersPayload(getStore()));
}

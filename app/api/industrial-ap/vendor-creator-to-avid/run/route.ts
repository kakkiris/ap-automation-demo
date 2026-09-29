import { json } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { runPayload, runSync } from "@/packs/vendor-creator-to-avid/lib/sync";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(runPayload(getStore()));
}
export async function POST() {
  const store = getStore();
  runSync(store);
  return json(runPayload(store));
}

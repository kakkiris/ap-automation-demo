import { json } from "@/lib/api";
import { resetStore } from "@/packs/vendor-creator-to-avid/store";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = resetStore();
  return json({ ok: true, mode: store.mode });
}

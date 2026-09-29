import { json } from "@/lib/api";
import { resetStore } from "@/packs/invoice-description-writer/store";
export const dynamic = "force-dynamic";
export async function POST() {
  resetStore();
  return json({ ok: true });
}

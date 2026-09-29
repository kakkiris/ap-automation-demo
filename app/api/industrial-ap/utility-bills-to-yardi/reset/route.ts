import { json } from "@/lib/api";
import { resetStore } from "@/packs/utility-bills-to-yardi/store";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = resetStore();
  return json({ ok: true, demo_month: store.demo_month });
}

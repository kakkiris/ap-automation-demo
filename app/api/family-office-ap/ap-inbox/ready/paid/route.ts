import { getStore } from "@/packs/ap-inbox/store";
import { markPaid } from "@/packs/ap-inbox/lib/actions";
import { run } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST() {
  return run(() => markPaid(getStore()));
}

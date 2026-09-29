import { getStore } from "@/packs/ap-inbox/store";
import { trackerView } from "@/packs/ap-inbox/lib/views";
import { run } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function GET() {
  return run(() => trackerView(getStore()));
}

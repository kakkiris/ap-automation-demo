import { getStore } from "@/packs/ap-inbox/store";
import { arrive } from "@/packs/ap-inbox/lib/actions";
import { run } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST() {
  return run(() => arrive(getStore()));
}

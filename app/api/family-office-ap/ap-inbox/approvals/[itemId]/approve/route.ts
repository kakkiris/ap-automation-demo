import { getStore } from "@/packs/ap-inbox/store";
import { approve } from "@/packs/ap-inbox/lib/actions";
import { run, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(_req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  return run(() => approve(getStore(), itemId));
}

import { getStore } from "@/packs/ap-inbox/store";
import { chooseLedger } from "@/packs/ap-inbox/lib/actions";
import { readBody, run, str, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ glAccount: string }>(req);
  return run(() => chooseLedger(getStore(), itemId, str(body.glAccount)));
}

import { getStore } from "@/packs/ap-inbox/store";
import { confirmField } from "@/packs/ap-inbox/lib/actions";
import { readBody, run, str, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ field: string }>(req);
  return run(() => confirmField(getStore(), itemId, str(body.field)));
}

import { getStore } from "@/packs/ap-inbox/store";
import { setField } from "@/packs/ap-inbox/lib/actions";
import { readBody, run, str, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ field: string; value: string | null }>(req);
  return run(() => setField(getStore(), itemId, str(body.field), body.value === null ? null : str(body.value)));
}

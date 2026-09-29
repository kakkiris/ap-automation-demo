import { getStore } from "@/packs/ap-inbox/store";
import { chooseLineParcel } from "@/packs/ap-inbox/lib/actions";
import { num, readBody, run, str, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ lineNumber: number; parcelId: string }>(req);
  return run(() => chooseLineParcel(getStore(), itemId, num(body.lineNumber), str(body.parcelId)));
}

import { getStore } from "@/packs/ap-inbox/store";
import { createProperty } from "@/packs/ap-inbox/lib/actions";
import { num, readBody, run, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ lineNumber: number }>(req);
  return run(() => createProperty(getStore(), itemId, num(body.lineNumber)));
}

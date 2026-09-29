import { fail } from "@/lib/api";
import { getStore } from "@/packs/ap-inbox/store";
import { setMode } from "@/packs/ap-inbox/lib/actions";
import { readBody, run, type ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const body = await readBody<{ mode: string }>(req);
  if (body.mode !== "single" && body.mode !== "splitter") return fail("mode must be single or splitter");
  const mode = body.mode;
  return run(() => setMode(getStore(), itemId, mode));
}

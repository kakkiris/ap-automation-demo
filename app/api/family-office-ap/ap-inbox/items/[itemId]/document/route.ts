import { fail } from "@/lib/api";
import { getStore } from "@/packs/ap-inbox/store";
import type { ItemParams } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: ItemParams) {
  const { itemId } = await params;
  const upload = getStore().uploads[itemId];
  if (!upload || !upload.base64) return fail("No document is stored for this item", 404);
  const bytes = Buffer.from(upload.base64, "base64");
  return new Response(bytes, {
    headers: { "content-type": upload.mimeType || "application/pdf", "content-disposition": `inline; filename="${upload.fileName}"` },
  });
}

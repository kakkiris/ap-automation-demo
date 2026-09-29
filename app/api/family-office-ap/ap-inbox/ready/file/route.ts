import { getStore } from "@/packs/ap-inbox/store";
import { readyView } from "@/packs/ap-inbox/lib/views";
import { writeImportFile } from "@/packs/ap-inbox/lib/importfile";
export const dynamic = "force-dynamic";
export async function GET() {
  const view = readyView(getStore());
  return new Response(writeImportFile(view.rows), {
    headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="${view.fileName}"` },
  });
}

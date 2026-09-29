import { fail } from "@/lib/api";
import { getStore } from "@/packs/vendor-creator-to-avid/store";
import { importCsv } from "@/packs/vendor-creator-to-avid/lib/sync";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const run = new URL(req.url).searchParams.get("run") ?? undefined;
  try {
    const file = importCsv(getStore(), run);
    return new Response(file.text, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file.file_name}"` },
    });
  } catch (err) {
    return fail((err as Error).message, 404);
  }
}

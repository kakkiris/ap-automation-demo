import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { buildUpload, fileText } from "@/packs/utility-bills-to-yardi/lib/export";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const store = getStore();
  const month = store.demo_month;
  const name = new URL(req.url).searchParams.get("name");
  const { files } = buildUpload(store, month);
  if (name) {
    const f = files.find((x) => x.name === name);
    if (!f) return json({ error: "file not found" }, 404);
    return new Response(fileText(f.rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` } });
  }
  return json({ month, files: files.map((f) => ({ name: f.name, property_id: f.property_id, provider: f.provider, rows: f.rows.length })), exported: Boolean(store.runs[month]?.exported) });
}

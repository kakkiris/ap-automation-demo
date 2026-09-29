import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { fail } from "@/lib/api";
import { blockedDuplicates } from "@/packs/utility-bills-to-yardi/lib/exceptions";
import { billBacksCsv, buildUpload, buildZip, markExported } from "@/packs/utility-bills-to-yardi/lib/export";
import { snapshot } from "@/packs/utility-bills-to-yardi/lib/run";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = getStore();
  const month = store.demo_month;
  if (!store.runs[month]) return fail("run the month first");
  if (blockedDuplicates(store, month).length > 0) return fail("resolve the blocked duplicates first");
  if (!store.runs[month].exported) {
    snapshot(store, `export ${month}`);
    markExported(store, month);
    store.operator_steps.export = true;
  }
  const { files } = buildUpload(store, month);
  const zip = buildZip(files, billBacksCsv(store, month), month);
  return new Response(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="yardi-upload-${month}.zip"` } });
}

import { fail } from "@/lib/api";
import { getStore } from "@/packs/ap-inbox/store";
import { addUpload } from "@/packs/ap-inbox/lib/actions";
import { run } from "@/packs/ap-inbox/lib/route-helpers";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    file = null;
  }
  if (!file || file.size === 0) return fail("Add a PDF to upload");
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || (file.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "application/pdf");
  return run(() => addUpload(getStore(), file.name, mimeType, bytes));
}

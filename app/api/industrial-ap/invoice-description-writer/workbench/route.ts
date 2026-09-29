import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/invoice-description-writer/store";
import { workbenchView } from "@/packs/invoice-description-writer/lib/views";
import { failFrom } from "../_shared";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("id is required");
  try {
    return json(workbenchView(getStore(), id));
  } catch (err) {
    return failFrom(err);
  }
}

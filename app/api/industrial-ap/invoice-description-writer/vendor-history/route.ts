import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/invoice-description-writer/store";
import { vendorHistoryView } from "@/packs/invoice-description-writer/lib/views";
import { failFrom } from "../_shared";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const vendorId = new URL(req.url).searchParams.get("vendor_id");
  if (!vendorId) return fail("vendor_id is required");
  try {
    return json(vendorHistoryView(getStore(), vendorId));
  } catch (err) {
    return failFrom(err);
  }
}

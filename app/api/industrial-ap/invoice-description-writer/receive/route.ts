import { json } from "@/lib/api";
import { getStore } from "@/packs/invoice-description-writer/store";
import { receiveInvoices } from "@/packs/invoice-description-writer/lib/receive";
import { failFrom } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    return json(await receiveInvoices(getStore()));
  } catch (err) {
    return failFrom(err);
  }
}

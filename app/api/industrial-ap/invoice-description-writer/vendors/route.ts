import { json } from "@/lib/api";
import { getStore } from "@/packs/invoice-description-writer/store";
import { vendorsView } from "@/packs/invoice-description-writer/lib/views";
import { failFrom } from "../_shared";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return json(vendorsView(getStore()));
  } catch (err) {
    return failFrom(err);
  }
}

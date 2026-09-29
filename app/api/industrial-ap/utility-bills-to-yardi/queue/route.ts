import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { queueView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(queueView(getStore()));
}

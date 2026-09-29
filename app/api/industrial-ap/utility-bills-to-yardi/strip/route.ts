import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { stripView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(stripView(getStore()));
}

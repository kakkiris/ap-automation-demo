import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { unplacedView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET() {
  return json(unplacedView(getStore()));
}

import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { undoLast } from "@/packs/utility-bills-to-yardi/lib/run";
export const dynamic = "force-dynamic";
export async function POST() {
  const label = undoLast(getStore());
  return json({ undone: label });
}

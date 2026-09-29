import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { stepMonth } from "@/packs/utility-bills-to-yardi/lib/mechanisms";
export const dynamic = "force-dynamic";
export async function POST() {
  try {
    return json({ demo_month: stepMonth(getStore()) });
  } catch (err) {
    return fail((err as Error).message);
  }
}

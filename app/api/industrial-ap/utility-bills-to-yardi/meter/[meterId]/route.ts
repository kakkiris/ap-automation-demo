import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { meterView } from "@/packs/utility-bills-to-yardi/lib/views";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ meterId: string }> }) {
  const { meterId } = await params;
  const view = meterView(getStore(), meterId);
  return view ? json(view) : fail("meter not found", 404);
}

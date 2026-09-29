import { json } from "@/lib/api";
import { resetStore } from "@/packs/ap-inbox/store";
import { ITEM_STATES, type ItemState, type ResetResult } from "@/packs/ap-inbox/lib/types";
export const dynamic = "force-dynamic";
export async function POST() {
  const store = resetStore();
  const states = Object.fromEntries(ITEM_STATES.map((s) => [s, 0])) as Record<ItemState, number>;
  for (const item of store.items) states[item.state] += 1;
  const result: ResetResult = { ok: true, items: store.items.length, states };
  return json(result);
}

import { redirect } from "next/navigation";
import { screenHref } from "@/lib/registry";
import { apInboxPack } from "@/packs/ap-inbox/module";
import { getStore } from "@/packs/ap-inbox/store";
import { inboxView } from "@/packs/ap-inbox/lib/views";
import type { ItemState } from "@/packs/ap-inbox/lib/types";

export const dynamic = "force-dynamic";

const SCRIPTED_SPLIT = "I-0007";
const notSubmitted = (state: ItemState) => state === "New" || state === "Drafted" || state === "Needs attention";

// The splitter entry in the sidebar and the ] key land here without an item: open the
// scripted nine-lot invoice while it is still open, else the first multi-property draft
// still open, else this week's arrivals.
export default function SplitIndex() {
  const store = getStore();
  const scripted = store.items.find((i) => i.itemId === SCRIPTED_SPLIT);
  if (scripted && notSubmitted(scripted.state)) redirect(screenHref(apInboxPack, "split-across-properties", SCRIPTED_SPLIT));
  const next = inboxView(store).items.find((r) => notSubmitted(r.state) && store.drafts[r.item.itemId]?.mode === "splitter");
  redirect(next ? screenHref(apInboxPack, "split-across-properties", next.item.itemId) : screenHref(apInboxPack, "this-weeks-arrivals"));
}

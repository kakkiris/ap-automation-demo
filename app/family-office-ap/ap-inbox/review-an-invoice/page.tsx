import { redirect } from "next/navigation";
import { screenHref } from "@/lib/registry";
import { apInboxPack } from "@/packs/ap-inbox/module";
import { getStore } from "@/packs/ap-inbox/store";
import { inboxView } from "@/packs/ap-inbox/lib/views";

export const dynamic = "force-dynamic";

// The sidebar and the ] key land here without an item: open the first draft still open,
// in arrival order, else go back to this week's arrivals so the week can arrive first.
export default function ReviewIndex() {
  const open = inboxView(getStore()).items.find((r) => r.state === "Drafted" || r.state === "Needs attention");
  redirect(open ? screenHref(apInboxPack, "review-an-invoice", open.item.itemId) : screenHref(apInboxPack, "this-weeks-arrivals"));
}

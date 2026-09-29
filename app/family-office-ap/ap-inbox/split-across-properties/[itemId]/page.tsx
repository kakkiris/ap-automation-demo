import { Review } from "@/packs/ap-inbox/ui/review";
import { getStore } from "@/packs/ap-inbox/store";
import { ensureDrafted, setMode } from "@/packs/ap-inbox/lib/actions";

export const dynamic = "force-dynamic";

// The URL alone puts the draft in the splitter: draft the item if the week has not
// arrived yet, then switch its mode while it is still open. An unknown item falls
// through to the screen, which shows the not-found words from the item route.
export default async function Page({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const store = getStore();
  try {
    const v = await ensureDrafted(store, itemId);
    const open = v.item.state === "Drafted" || v.item.state === "Needs attention";
    if (open && v.draft.mode !== "splitter") setMode(store, itemId, "splitter");
  } catch {
    // the screen reports it
  }
  return <Review itemId={itemId} screen="split" />;
}

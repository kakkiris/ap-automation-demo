import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { multiPropertySplitPack } from "@/packs/ap-inbox/module";

// The splitter is a mode of AP Inbox; this entry opens it there.
export default function SplitterEntry() {
  redirect(moduleHref(multiPropertySplitPack));
}

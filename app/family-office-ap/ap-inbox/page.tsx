import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { apInboxPack } from "@/packs/ap-inbox/module";

export default function ModuleIndex() {
  redirect(moduleHref(apInboxPack));
}

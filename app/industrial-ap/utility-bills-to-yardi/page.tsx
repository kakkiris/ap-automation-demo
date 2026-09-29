import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { utilityBillsToYardiPack } from "@/packs/utility-bills-to-yardi/module";

export default function ModuleIndex() {
  redirect(moduleHref(utilityBillsToYardiPack));
}

import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { meterRegisterPack } from "@/packs/utility-bills-to-yardi/module";

export default function ModuleIndex() {
  redirect(moduleHref(meterRegisterPack));
}

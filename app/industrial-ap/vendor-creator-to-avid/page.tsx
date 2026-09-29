import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { vendorCreatorToAvidPack } from "@/packs/vendor-creator-to-avid/module";

export default function ModuleIndex() {
  redirect(moduleHref(vendorCreatorToAvidPack));
}

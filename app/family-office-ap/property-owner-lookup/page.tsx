import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { propertyOwnerLookupPack } from "@/packs/property-owner-lookup/module";

export default function ModuleIndex() {
  redirect(moduleHref(propertyOwnerLookupPack));
}

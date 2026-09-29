import { redirect } from "next/navigation";
import { moduleHref } from "@/lib/registry";
import { invoiceDescriptionWriterPack } from "@/packs/invoice-description-writer/module";

export default function ModuleIndex() {
  redirect(moduleHref(invoiceDescriptionWriterPack));
}

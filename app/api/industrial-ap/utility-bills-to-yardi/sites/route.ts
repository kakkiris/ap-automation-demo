import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
export const dynamic = "force-dynamic";
export async function GET() {
  const store = getStore();
  return json({ sites: [...store.properties].sort((a, b) => (a.id < b.id ? -1 : 1)), scripted: store.scripted });
}

import { fail, json } from "@/lib/api";
import cannedJson from "@/data/canned-extractions.json";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { runMonth, snapshot, type Canned } from "@/packs/utility-bills-to-yardi/lib/run";
export const dynamic = "force-dynamic";
// A dropped PDF resolves only to a scripted bill (B-4.pdf, A-5.pdf, and so on) or a bill id.
export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { filename?: string };
  const name = (body.filename ?? "").replace(/\.pdf$/i, "").trim();
  if (!name) return fail("filename is required");
  const id = store.scripted[name] ?? name;
  const bill = store.bills.find((b) => b.id === id && b.arrival_month === store.demo_month);
  if (!bill) return fail("Not a scripted bill in this phase.", 404);
  if (bill.status === "unarrived") {
    const canned = cannedJson as unknown as Canned;
    snapshot(store, `drop ${bill.id}`);
    const others = store.bills.filter((b) => b.arrival_month === store.demo_month && b.id !== bill.id && b.status === "unarrived");
    for (const o of others) o.status = "exported" as never;
    const keep = new Map(others.map((o) => [o.id, o.status]));
    runMonth(store, store.demo_month, canned);
    for (const o of others) o.status = "unarrived";
    delete store.runs[store.demo_month];
    void keep;
  }
  return json({ bill });
}

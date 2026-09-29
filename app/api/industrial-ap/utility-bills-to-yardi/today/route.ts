import { json } from "@/lib/api";
import { getStore } from "@/packs/utility-bills-to-yardi/store";
import { DEMO_STEPS, MANUAL_STEPS, discrepancySummary, rentRollRows, trackerTabs } from "@/packs/utility-bills-to-yardi/lib/today";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const store = getStore();
  const site = new URL(req.url).searchParams.get("site") ?? store.scripted["A"];
  const tabs = trackerTabs(store);
  const tab = tabs.find((t) => t.property.id === site) ?? tabs[0];
  return json({
    demo_month: store.demo_month,
    sites: tabs.map((t) => ({ id: t.property.id, name: t.property.name })),
    tab,
    rent_roll: rentRollRows(store).filter((r) => r.property_code === tab.property.code),
    discrepancies: { summary: discrepancySummary(store), detail: store.discrepancies.filter((d) => d.property_id === tab.property.id) },
    manual_steps: MANUAL_STEPS,
    demo_steps: DEMO_STEPS,
    run: store.runs[store.demo_month] ?? null,
  });
}

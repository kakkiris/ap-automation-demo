"use client";
import { useJson } from "@/lib/use-json";
import { utilityBillsToYardiPack } from "@/packs/utility-bills-to-yardi/module";
import type { Property } from "@/packs/utility-bills-to-yardi/types";

export function SitePicker({ value, onChange, allowAll }: { value: string; onChange: (id: string) => void; allowAll?: boolean }) {
  const { data } = useJson<{ sites: Property[] }>(`${utilityBillsToYardiPack.apiBase}/sites`);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Site</span>
      <select className="h-8 rounded-lg border border-input bg-card px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="all">All sites</option>}
        {(data?.sites ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

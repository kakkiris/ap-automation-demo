import { Inbox, Search, Split, Zap, Gauge, Grid3x3, PenLine, UserPlus, LayoutGrid, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "ap-inbox": Inbox,
  "property-owner-lookup": Search,
  "multi-property-split": Split,
  "utility-bills-to-yardi": Zap,
  "meter-register": Gauge,
  "utility-payment-reconciliation": Grid3x3,
  "invoice-description-writer": PenLine,
  "vendor-creator-to-avid": UserPlus,
};

export function moduleIcon(slug: string): LucideIcon {
  return ICONS[slug] ?? LayoutGrid;
}

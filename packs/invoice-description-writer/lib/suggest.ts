// GL suggestion from the vendor's coding history. History only; default_gl plays no part.
import { STRONG_MIN_COUNT, STRONG_SHARE_PERCENT, type CodingHistory, type GlSuggestion } from "./types";

/** Count descending, then last_used descending, then gl_code ascending. */
export function sortHistory(rows: CodingHistory[]): CodingHistory[] {
  return [...rows].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.last_used !== b.last_used) return a.last_used < b.last_used ? 1 : -1;
    if (a.gl_code !== b.gl_code) return a.gl_code < b.gl_code ? -1 : 1;
    return 0;
  });
}

function none(): Omit<GlSuggestion, "invoice_id"> {
  return { gl_code: null, gl_name: null, basis_count: 0, basis_total: 0, tier: "none", alternatives: [] };
}

export function suggestGl(vendor_id: string | null, history: CodingHistory[]): Omit<GlSuggestion, "invoice_id"> {
  if (!vendor_id) return none();
  const rows = sortHistory(history.filter((r) => r.vendor_id === vendor_id));
  if (rows.length === 0) return none();
  const top = rows[0];
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const strong = top.count >= STRONG_MIN_COUNT && top.count * 100 >= STRONG_SHARE_PERCENT * total;
  return {
    gl_code: top.gl_code,
    gl_name: top.gl_name,
    basis_count: top.count,
    basis_total: total,
    tier: strong ? "strong" : "weak",
    alternatives: rows.slice(1).map((r) => ({ gl_code: r.gl_code, gl_name: r.gl_name, count: r.count, last_used: r.last_used })),
  };
}

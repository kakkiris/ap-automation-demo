import { fail, json } from "@/lib/api";
import { getStore } from "@/packs/invoice-description-writer/store";
import { recordFeedback } from "@/packs/invoice-description-writer/lib/feedback";
import type { FeedbackRequest } from "@/packs/invoice-description-writer/lib/types";
import { failFrom } from "../_shared";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<FeedbackRequest>;
  if (!body.invoice_id) return fail("invoice_id is required");
  if (!body.outcome) return fail("outcome is required");
  try {
    return json(recordFeedback(getStore(), { invoice_id: body.invoice_id, outcome: body.outcome, corrected_gl: body.corrected_gl }));
  } catch (err) {
    return failFrom(err);
  }
}

// Feedback: the coder keeps the decision; the demo records it for the session only.
import { PackError } from "./errors";
import { workbenchView } from "./views";
import { GL_CODES, type Feedback, type FeedbackRequest, type SessionLine, type Store, type WorkbenchPayload } from "./types";

const OUTCOMES = new Set(["used", "corrected"]);
const OPEN_STATUSES = new Set(["ready", "used", "corrected"]);

export function recordFeedback(store: Store, body: FeedbackRequest): WorkbenchPayload {
  if (!store.received) throw new PackError("Press Receive invoices first.", 409);
  const invoice = store.invoices.find((i) => i.invoice_id === body.invoice_id);
  if (!invoice) throw new PackError("No invoice with that id.", 404);
  if (!OUTCOMES.has(body.outcome)) throw new PackError("Outcome must be used or corrected.", 400);
  if (!OPEN_STATUSES.has(invoice.status)) {
    if (invoice.status === "routed") throw new PackError("This invoice was routed out, so there is nothing to record.", 400);
    throw new PackError("This invoice needs manual entry, so there is no suggestion to record.", 400);
  }
  let corrected_gl: string | null = null;
  if (body.outcome === "corrected") {
    if (!body.corrected_gl || !(GL_CODES as readonly string[]).includes(body.corrected_gl)) throw new PackError("Pick a code from the chart of accounts.", 400);
    corrected_gl = body.corrected_gl;
  }
  const record: Feedback = { invoice_id: invoice.invoice_id, outcome: body.outcome, corrected_gl, at: store.feedback.length + 1 };
  store.feedback.push(record);
  invoice.status = body.outcome;
  return workbenchView(store, invoice.invoice_id);
}

/** One line per feedback record whose invoice resolved to this vendor, in the order recorded. */
export function sessionLines(store: Store, vendor_id: string): SessionLine[] {
  const lines: SessionLine[] = [];
  for (const f of store.feedback) {
    const extraction = store.extractions[f.invoice_id];
    if (!extraction || extraction.resolved_vendor_id !== vendor_id) continue;
    if (f.outcome === "used") {
      const s = store.suggestions[f.invoice_id];
      if (!s || !s.gl_code || !s.gl_name) continue;
      lines.push({ invoice_id: f.invoice_id, outcome: "used", gl_code: s.gl_code, gl_name: s.gl_name, text: `Recorded this session: ${f.invoice_id} used ${s.gl_code} ${s.gl_name} as is.` });
    } else if (f.corrected_gl) {
      const gl_name = store.gl_accounts.find((g) => g.gl_code === f.corrected_gl)?.gl_name ?? "";
      lines.push({ invoice_id: f.invoice_id, outcome: "corrected", gl_code: f.corrected_gl, gl_name, text: `Recorded this session: ${f.invoice_id} corrected to ${f.corrected_gl} ${gl_name}.`.replace(/\s+\./, ".") });
    }
  }
  return lines;
}

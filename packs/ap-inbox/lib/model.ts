import cannedJson from "../seed/canned.json";
import { z } from "zod";
import type { Extraction, InboxItem, Store } from "./types";

// The document reader. Scripted items always serve their canned extraction from
// packs/ap-inbox/seed/canned/<itemId>.json and never touch the network.
// Other documents are read live when ANTHROPIC_API_KEY is set; without a key, on any
// failure, or when the reply does not validate, the reader returns null and the draft
// opens in the "enter fields by hand" state. The reader only reads documents and
// returns checked fields; every decision after that is plain code in draft.ts.

export const DEFAULT_MODEL = "claude-sonnet-5";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

const confidence = z.number().min(0).max(1);
const lineSchema = z.object({
  description: z.string().default(""),
  address: z.string().nullable().default(null),
  amount: z.string().nullable().default(null),
  chargeType: z.string().nullable().default(null),
});

export const extractionSchema = z.object({
  kind: z.enum(["invoice", "list", "statement"]).default("invoice"),
  payee: z.string().nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  invoiceDate: z.string().nullable().default(null),
  totalAmount: z.string().nullable().default(null),
  serviceAddressLines: z.array(z.string()).default([]),
  parcelRefs: z.array(z.string()).default([]),
  utilityAccountNumber: z.string().nullable().default(null),
  lineItems: z.array(lineSchema).default([]),
  confidence: z
    .object({
      payee: confidence.default(0.9),
      invoiceNumber: confidence.default(0.9),
      invoiceDate: confidence.default(0.9),
      totalAmount: confidence.default(0.9),
      address: confidence.default(0.9),
    })
    .default({ payee: 0.9, invoiceNumber: 0.9, invoiceDate: 0.9, totalAmount: 0.9, address: 0.9 }),
  notesHint: z.string().nullable().default(null),
});

export function validateExtraction(data: unknown): Extraction | null {
  const parsed = extractionSchema.safeParse(data);
  return parsed.success ? (parsed.data as Extraction) : null;
}

// The canned outputs ship bundled (packs/ap-inbox/seed/canned.json, built by
// npm run seed:canned) rather than read from disk: the demo runs on Workers.
const CANNED = cannedJson as Record<string, unknown>;

export function readCanned(itemId: string): Extraction | null {
  const raw = CANNED[itemId];
  return raw === undefined ? null : validateExtraction(raw);
}

const INSTRUCTIONS = [
  "Read this invoice document and reply with one JSON object only, no other text.",
  "Shape: { kind: \"invoice\" | \"list\" | \"statement\", payee: string | null, invoiceNumber: string | null, invoiceDate: \"YYYY-MM-DD\" | null,",
  "totalAmount: string | null (as printed, e.g. \"6,988.40\"), serviceAddressLines: string[] (property or service address lines as printed),",
  "parcelRefs: string[] (parcel ids printed on the document, shape P-12345), utilityAccountNumber: string | null,",
  "lineItems: [{ description: string, address: string | null, amount: string | null, chargeType: string | null }],",
  "confidence: { payee, invoiceNumber, invoiceDate, totalAmount, address } each 0 to 1, notesHint: string | null (a short charge description under ten words) }.",
  "Use kind \"list\" for a list of properties with no per-item prices, \"statement\" for a statement itemised by property, otherwise \"invoice\".",
  "Amounts stay as printed with two decimals. Leave a field null when it is not on the document.",
].join(" ");

function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

function contentBlock(mimeType: string, data: string): Record<string, unknown> {
  if (mimeType === "application/pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mimeType)) return { type: "image", source: { type: "base64", media_type: mimeType, data } };
  return { type: "text", text: Buffer.from(data, "base64").toString("utf8").slice(0, 20_000) };
}

/** Read a document: canned for scripted items, live for others when a key is present, null otherwise. */
export async function readDocument(item: InboxItem, store: Store, bytesBase64?: string): Promise<Extraction | null> {
  if (item.scripted) return readCanned(item.itemId);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const upload = store.uploads[item.itemId];
  const data = bytesBase64 ?? upload?.base64 ?? null;
  if (!data) return null;
  const mimeType = upload?.mimeType ?? "application/pdf";
  try {
    const res = await fetch(MESSAGES_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEMO_MODEL ?? DEFAULT_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: [contentBlock(mimeType, data), { type: "text", text: INSTRUCTIONS }] }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (body.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
    return validateExtraction(firstJsonObject(text));
  } catch {
    return null;
  }
}

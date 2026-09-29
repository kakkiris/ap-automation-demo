// The one reading step. Scripted invoices always serve canned; unscripted invoices may be read
// live when a key is present, with canned as the fallback on any error, timeout, or bad output.
// Unit tests inject fetch and env so they never touch the network.
import fs from "node:fs";
import path from "node:path";
import cannedJson from "../seed/canned.json";
import { z } from "zod";
import { EXTRACTION_FIELD_KEYS, type ExtractionFields, type ExtractionSource, type Invoice } from "./types";

export const DEFAULT_MODEL = "claude-sonnet-5";
export const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface ExtractOptions {
  /** Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Reads canned outputs from this directory instead of the bundled map. Tests only. */
  cannedDir?: string;
  /** Defaults to public under process.cwd(); pdf_path is joined onto it. */
  publicDir?: string;
  timeoutMs?: number;
}

export interface ExtractResult {
  fields: ExtractionFields;
  source: ExtractionSource;
}

export const fieldsSchema = z.strictObject({
  vendor_name: z.string().nullable(),
  property_hint: z.string().nullable(),
  unit_hint: z.string().nullable(),
  service_short: z.string().nullable(),
  service_from: z.string().nullable(),
  service_to: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),
  amount: z.number().nullable(),
  due_date: z.string().nullable(),
  account_number: z.string().nullable(),
  meter_number: z.string().nullable(),
});

export function defaultCannedDir(): string {
  return path.join(process.cwd(), "packs", "invoice-description-writer", "seed", "canned");
}

export function defaultPublicDir(): string {
  return path.join(process.cwd(), "public");
}

export function emptyFields(): ExtractionFields {
  return Object.fromEntries(EXTRACTION_FIELD_KEYS.map((k) => [k, null])) as unknown as ExtractionFields;
}

/** Builds fields from a canned file leniently: a key with the wrong type or no key at all reads as null. */
export function coerceFields(raw: unknown): ExtractionFields | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out = emptyFields();
  for (const key of EXTRACTION_FIELD_KEYS) {
    const value = obj[key];
    if (key === "amount") out.amount = typeof value === "number" && Number.isFinite(value) ? value : null;
    else out[key] = typeof value === "string" ? value : null;
  }
  return out;
}

// The canned outputs ship bundled (packs/invoice-description-writer/seed/canned.json,
// built by npm run seed:canned) rather than read from disk: the demo runs on Workers.
// A directory may still be passed, which is how the unit tests point at their fixtures.
const CANNED = cannedJson as Record<string, unknown>;

export function readCanned(invoice_id: string, cannedDir?: string): ExtractionFields | null {
  if (cannedDir === undefined) {
    const raw = CANNED[invoice_id];
    return raw === undefined ? null : coerceFields(raw);
  }
  const file = path.join(cannedDir, `${invoice_id}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    return coerceFields(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** The first balanced JSON object in a reply, or null. Brace counting skips braces inside strings. */
export function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const INSTRUCTION = [
  "Read this invoice and reply with one JSON object and nothing else.",
  `Keys, all required: ${EXTRACTION_FIELD_KEYS.join(", ")}.`,
  "Use null for anything not printed on the invoice; never guess.",
  "Dates as YYYY-MM-DD strings. amount as a number with no currency sign.",
  "service_short is two to five plain words for the work done.",
  "property_hint is the property code printed on the invoice and unit_hint the unit label, when printed.",
  "account_number and meter_number only when the invoice prints them.",
].join(" ");

function textOf(body: unknown): string {
  const content = (body as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: string; text: string } => typeof c === "object" && c !== null && (c as { type?: unknown }).type === "text" && typeof (c as { text?: unknown }).text === "string")
    .map((c) => c.text)
    .join("\n");
}

async function readLive(invoice: Invoice, key: string, model: string, fetchImpl: typeof fetch, publicDir: string, timeoutMs: number): Promise<ExtractionFields | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Reading the document off disk works in dev; on Workers there is no filesystem, so this
    // throws and the caller falls back to the canned output, which is what the demo serves.
    const data = fs.readFileSync(path.join(publicDir, invoice.pdf_path)).toString("base64");
    const request = fetchImpl(MESSAGES_URL, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
              { type: "text", text: INSTRUCTION },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    const gaveUp = new Promise<null>((resolve) => controller.signal.addEventListener("abort", () => resolve(null)));
    const res = await Promise.race([request, gaveUp]);
    if (!res || !res.ok) return null;
    const body: unknown = await res.json();
    const parsed = fieldsSchema.safeParse(firstJsonObject(textOf(body)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractInvoice(invoice: Invoice, options: ExtractOptions = {}): Promise<ExtractResult> {
  const env = options.env ?? process.env;
  const cannedDir = options.cannedDir;
  const key = env.ANTHROPIC_API_KEY;
  if (!invoice.scripted && key) {
    const model = env.DEMO_MODEL && env.DEMO_MODEL.trim().length > 0 ? env.DEMO_MODEL : DEFAULT_MODEL;
    const live = await readLive(invoice, key, model, options.fetchImpl ?? fetch, options.publicDir ?? defaultPublicDir(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (live) return { fields: live, source: "live" };
  }
  const canned = readCanned(invoice.invoice_id, cannedDir);
  if (canned) return { fields: canned, source: "canned" };
  return { fields: emptyFields(), source: "unavailable" };
}

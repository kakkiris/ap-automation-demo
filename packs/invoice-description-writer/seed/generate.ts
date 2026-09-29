// Seed generator for the invoice description writer module.
// Run from the repo root: npx tsx packs/invoice-description-writer/seed/generate.ts
// A seeded generator with a fixed seed constant drives every random choice; no clock,
// no Math.random, no current date. Two runs write byte-identical files.
//
// Writes:
//   packs/invoice-description-writer/seed/seed.json
//   packs/invoice-description-writer/seed/canned/<invoice_id>.json (all 30)
//   public/demo/invoice-description-writer/<invoice_id>.pdf and .svg (all 30)
//
// Every vendor, property, address, amount, account number, and meter number is invented.
// Markers: account numbers are 99 plus eight digits, meter numbers M9 plus eight digits,
// invoice ids INV-30xx, vendor ids V-01 to V-14, GL codes the 12 allowed in markers.json.

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { GL_CODES } from "../lib/types";
import type { CodingHistory, ExtractionFields, GlAccount, Invoice, Seed, Vendor } from "../lib/types";

// ---------- Paths ----------

const ROOT = process.cwd();
const PACK_DIR = path.join(ROOT, "packs", "invoice-description-writer");
const SEED_DIR = path.join(PACK_DIR, "seed");
const CANNED_DIR = path.join(SEED_DIR, "canned");
const DOC_DIR = path.join(ROOT, "public", "demo", "invoice-description-writer");
const DOC_URL = "/demo/invoice-description-writer";

if (!fs.existsSync(path.join(PACK_DIR, "lib", "types.ts"))) {
  throw new Error("run from the repo root: npx tsx packs/invoice-description-writer/seed/generate.ts");
}

// ---------- Seeded generator ----------

const SEED = 20260902;
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const rand = mulberry32(SEED);
const intBetween = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const digits = (n: number) => Array.from({ length: n }, () => String(intBetween(0, 9))).join("");
const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`seed assertion failed: ${msg}`);
};

// ---------- Dates (UTC, YYYY-MM-DD strings only) ----------

const dateOf = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = dateOf(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const daysBetween = (lo: string, hi: string) => Math.round((dateOf(hi).getTime() - dateOf(lo).getTime()) / 86400000);
const dayBetween = (lo: string, hi: string) => addDays(lo, intBetween(0, daysBetween(lo, hi)));
const FIXED_DOC_DATE = new Date("2026-08-31T00:00:00Z");

// ---------- Money (integer cents in, display string out; no arithmetic elsewhere) ----------

const centsToAmount = (cents: number) => cents / 100;
const money = (amount: number) => {
  const cents = Math.round(amount * 100);
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `$${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
};

// ---------- Chart of accounts (the 12 codes fixed by the recorded decision) ----------

const GL_ACCOUNTS: GlAccount[] = [
  { gl_code: "6110", gl_name: "Electric" },
  { gl_code: "6120", gl_name: "Water and sewer" },
  { gl_code: "6310", gl_name: "Repairs and maintenance" },
  { gl_code: "6320", gl_name: "Roofing repairs" },
  { gl_code: "6420", gl_name: "Landscaping" },
  { gl_code: "6510", gl_name: "Plumbing repairs" },
  { gl_code: "6520", gl_name: "Plumbing capital" },
  { gl_code: "7010", gl_name: "Legal" },
  { gl_code: "7110", gl_name: "Professional fees" },
  { gl_code: "7210", gl_name: "Supplies" },
  { gl_code: "7310", gl_name: "Cleaning" },
  { gl_code: "7410", gl_name: "Pest control" },
];
assert(JSON.stringify(GL_ACCOUNTS.map((g) => g.gl_code)) === JSON.stringify([...GL_CODES]), "chart matches GL_CODES in lib/types.ts");
const glName = (code: string) => {
  const hit = GL_ACCOUNTS.find((g) => g.gl_code === code);
  assert(hit !== undefined, `gl code ${code} is in the chart`);
  return hit!.gl_name;
};

// ---------- Vendors (fictional; place words, materials, and trade words only) ----------

interface VendorDef extends Vendor {
  prefix: string; // two capital letters that start the vendor's own invoice numbers
  address: [string, string]; // invented street address, no phone numbers
}

const VENDOR_DEFS: VendorDef[] = [
  { vendor_id: "V-01", name: "Coral Ridge Roofing", service_type: "multi", default_gl: null, prefix: "CR", address: ["1180 Marlstone Road", "Palmetto Harbor, SC 29405"] },
  { vendor_id: "V-02", name: "Brightline Landscaping", service_type: "single", default_gl: "6420", prefix: "BL", address: ["2275 Seagrape Avenue", "Heron Cove, SC 29407"] },
  { vendor_id: "V-03", name: "Tidewater Plumbing", service_type: "multi", default_gl: null, prefix: "TP", address: ["640 Coquina Street, Bay 3", "Sandpiper Key, SC 29412"] },
  { vendor_id: "V-04", name: "Saltmarsh Pest Control", service_type: "single", default_gl: "7410", prefix: "SM", address: ["915 Osprey Lane", "Palmetto Harbor, SC 29405"] },
  { vendor_id: "V-05", name: "Harborline Cleaning", service_type: "single", default_gl: "7310", prefix: "HC", address: ["3320 Driftwood Boulevard", "Marlin Shores, SC 29414"] },
  { vendor_id: "V-06", name: "Mangrove Bay Law Office", service_type: "single", default_gl: "7010", prefix: "MB", address: ["500 Lantern Key Drive, Suite 800", "Heron Cove, SC 29407"] },
  { vendor_id: "V-07", name: "Cypress Point Supply", service_type: "single", default_gl: "7210", prefix: "CP", address: ["7810 Sawgrass Parkway", "Sandpiper Key, SC 29412"] },
  { vendor_id: "V-08", name: "Kestrel Door Systems", service_type: "single", default_gl: "6310", prefix: "KD", address: ["1490 Ibis Landing Road", "Marlin Shores, SC 29414"] },
  { vendor_id: "V-09", name: "Sunline Power", service_type: "single", default_gl: "6110", prefix: "SP", address: ["PO Box 4200", "Palmetto Harbor, SC 29405"] },
  { vendor_id: "V-10", name: "Osprey Ridge Surveying", service_type: "single", default_gl: "7110", prefix: "OR", address: ["212 Turtle Run Court", "Heron Cove, SC 29407"] },
  { vendor_id: "V-11", name: "Sandbar Fire Protection", service_type: "single", default_gl: "6310", prefix: "SF", address: ["5605 Pelican Way", "Marlin Shores, SC 29414"] },
  { vendor_id: "V-12", name: "Palmgrove Irrigation", service_type: "multi", default_gl: null, prefix: "PI", address: ["880 Cormorant Trail", "Sandpiper Key, SC 29412"] },
  { vendor_id: "V-13", name: "Seagrass Building Services", service_type: "multi", default_gl: null, prefix: "SB", address: ["4025 Saltgrass Road", "Palmetto Harbor, SC 29405"] },
  { vendor_id: "V-14", name: "Keys Gate Fencing", service_type: "single", default_gl: null, prefix: "KG", address: ["1735 Sable Palm Highway", "Marlin Shores, SC 29414"] },
];
const vendorById = new Map(VENDOR_DEFS.map((v) => [v.vendor_id, v]));
const vendorDef = (id: string) => {
  const v = vendorById.get(id);
  assert(v !== undefined, `vendor ${id} exists`);
  return v!;
};
const UNSEEN_VENDOR = "V-14";
const UTILITY_VENDOR = "V-09";
const PEST_VENDOR = "V-04";

// ---------- Properties (fictional; two-letter codes) ----------

interface PropertyDef {
  code: string;
  name: string;
  street: string;
}
const PROPERTIES: PropertyDef[] = [
  { code: "PR", name: "Palmetto Row Commerce Park", street: "4410 Palmetto Row" },
  { code: "HL", name: "Harbor Lane Flex Center", street: "1200 Harbor Lane" },
  { code: "SG", name: "Seagrass Commons", street: "8800 Seagrass Boulevard" },
  { code: "CK", name: "Cypress Key Industrial", street: "310 Cypress Key Road" },
];
const propertyByCode = new Map(PROPERTIES.map((p) => [p.code, p]));

// ---------- Coding history (aggregated rows; six months behind the vendors) ----------

const HISTORY_FROM = "2026-03-01";
const HISTORY_TO = "2026-08-28";

interface MultiRow {
  gl_code: string;
  count: number;
  last_used: string;
}
// Multi-service vendors: V-01 strong (14 of 16), V-03 weak (9 of 15), V-12 strong (11 of 15), V-13 weak (7 of 14).
const MULTI_HISTORY: Record<string, MultiRow[]> = {
  "V-01": [
    { gl_code: "6320", count: 14, last_used: "2026-08-21" },
    { gl_code: "6310", count: 2, last_used: "2026-05-03" },
  ],
  "V-03": [
    { gl_code: "6510", count: 9, last_used: "2026-08-27" },
    { gl_code: "6520", count: 6, last_used: "2026-07-15" },
  ],
  "V-12": [
    { gl_code: "6420", count: 11, last_used: "2026-08-19" },
    { gl_code: "6510", count: 3, last_used: "2026-06-09" },
    { gl_code: "6310", count: 1, last_used: "2026-04-14" },
  ],
  "V-13": [
    { gl_code: "6310", count: 7, last_used: "2026-08-25" },
    { gl_code: "7310", count: 5, last_used: "2026-08-06" },
    { gl_code: "7210", count: 2, last_used: "2026-05-20" },
  ],
};

function buildCodingHistory(): CodingHistory[] {
  const rows: CodingHistory[] = [];
  for (const v of VENDOR_DEFS) {
    if (v.vendor_id === UNSEEN_VENDOR) continue;
    if (v.service_type === "single") {
      assert(v.default_gl !== null, `${v.vendor_id} single vendor has a default code`);
      const count = v.vendor_id === PEST_VENDOR ? intBetween(8, 20) : intBetween(6, 20);
      const last_used = dayBetween(HISTORY_FROM, HISTORY_TO);
      rows.push({ vendor_id: v.vendor_id, gl_code: v.default_gl!, gl_name: glName(v.default_gl!), count, last_used });
    } else {
      const multi = MULTI_HISTORY[v.vendor_id];
      assert(multi !== undefined && multi.length >= 2 && multi.length <= 3, `${v.vendor_id} has two or three history rows`);
      const dates = new Set(multi.map((r) => r.last_used));
      assert(dates.size === multi.length, `${v.vendor_id} last_used dates are distinct`);
      for (const r of multi) rows.push({ vendor_id: v.vendor_id, gl_code: r.gl_code, gl_name: glName(r.gl_code), count: r.count, last_used: r.last_used });
    }
  }
  for (const r of rows) assert(r.last_used >= HISTORY_FROM && r.last_used <= HISTORY_TO, `${r.vendor_id} ${r.gl_code} last_used within the six month window`);
  return rows;
}

// ---------- The day's folder (30 invoices in inbox order) ----------

interface Plan {
  id: string;
  vendor: string;
  property: string;
  unit: number | null; // null renders as whole-property work ("no unit")
  service: string; // two to five plain lowercase words, as printed on the invoice
  scripted?: boolean;
  utility?: boolean;
  noDates?: boolean; // the invoice prints no service period
  account?: boolean; // a customer account number printed on a service invoice
  failed?: boolean; // stylized document; the canned reading fails
}

const PLAN: Plan[] = [
  { id: "INV-3004", vendor: "V-05", property: "HL", unit: 18, service: "monthly janitorial service" },
  { id: "INV-3005", vendor: "V-07", property: "PR", unit: 33, service: "air filters and belts" },
  { id: "INV-3006", vendor: "V-12", property: "SG", unit: null, service: "irrigation zone repair" },
  { id: "INV-3007", vendor: "V-01", property: "PR", unit: 12, service: "roof leak repair", scripted: true },
  { id: "INV-3008", vendor: "V-02", property: "CK", unit: null, service: "monthly grounds maintenance" },
  { id: "INV-3009", vendor: "V-08", property: "HL", unit: 41, service: "overhead door repair" },
  { id: "INV-3010", vendor: "V-06", property: "SG", unit: 27, service: "lease renewal review" },
  { id: "INV-3011", vendor: "V-03", property: "CK", unit: 15, service: "drain line clearing" },
  { id: "INV-3012", vendor: "V-04", property: "HL", unit: 22, service: "quarterly pest treatment", scripted: true, noDates: true },
  { id: "INV-3013", vendor: "V-10", property: "SG", unit: null, service: "boundary survey update" },
  { id: "INV-3014", vendor: "V-11", property: "PR", unit: 20, service: "annual sprinkler inspection" },
  { id: "INV-3015", vendor: "V-05", property: "CK", unit: 36, service: "common area cleaning" },
  { id: "INV-3016", vendor: "V-09", property: "HL", unit: null, service: "electric service", utility: true },
  { id: "INV-3017", vendor: "V-07", property: "SG", unit: 44, service: "restroom paper supplies" },
  { id: "INV-3018", vendor: "V-13", property: "CK", unit: 29, service: "wall patch and paint" },
  { id: "INV-3019", vendor: "V-14", property: "PR", unit: 38, service: "chain link fence repair", scripted: true },
  { id: "INV-3020", vendor: "V-02", property: "HL", unit: null, service: "tree trimming and removal" },
  { id: "INV-3021", vendor: "V-13", property: "SG", unit: 11, service: "loading dock repair", scripted: true, failed: true },
  { id: "INV-3022", vendor: "V-08", property: "CK", unit: 24, service: "dock door spring replacement" },
  { id: "INV-3023", vendor: "V-06", property: "PR", unit: 45, service: "lease amendment review" },
  { id: "INV-3024", vendor: "V-01", property: "HL", unit: 30, service: "gutter and downspout repair" },
  { id: "INV-3025", vendor: "V-09", property: "SG", unit: null, service: "electric service", scripted: true, utility: true },
  { id: "INV-3026", vendor: "V-12", property: "PR", unit: null, service: "sprinkler head replacement" },
  { id: "INV-3027", vendor: "V-04", property: "CK", unit: null, service: "rodent bait station service" },
  { id: "INV-3028", vendor: "V-10", property: "HL", unit: 13, service: "site elevation survey" },
  { id: "INV-3029", vendor: "V-11", property: "SG", unit: 39, service: "fire extinguisher service" },
  { id: "INV-3030", vendor: "V-03", property: "PR", unit: 26, service: "water heater replacement", scripted: true },
  { id: "INV-3031", vendor: "V-05", property: "SG", unit: 47, service: "post construction cleanup" },
  { id: "INV-3032", vendor: "V-07", property: "CK", unit: 17, service: "light bulbs and ballasts" },
  { id: "INV-3033", vendor: "V-02", property: "PR", unit: null, service: "monthly landscape contract", scripted: true, account: true },
];

const INVOICE_FROM = "2026-08-24";
const INVOICE_TO = "2026-08-31";
const MONTH_START = "2026-08-01";

// Vendor invoice numbers count upward per vendor; V-01 starts at 88213 so INV-3007 is CR-88213.
const nextNumber = new Map<string, number>([["V-01", 88213]]);
function invoiceNumber(v: VendorDef): string {
  const current = nextNumber.get(v.vendor_id) ?? intBetween(10000, 89000);
  nextNumber.set(v.vendor_id, current + intBetween(3, 40));
  return `${v.prefix}-${String(current).padStart(5, "0")}`;
}

function buildInvoices(): Invoice[] {
  const out: Invoice[] = [];
  for (const p of PLAN) {
    const v = vendorDef(p.vendor);
    assert(propertyByCode.has(p.property), `${p.id} property ${p.property} exists`);
    const words = p.service.split(" ");
    assert(words.length >= 2 && words.length <= 5 && p.service === p.service.toLowerCase(), `${p.id} service_short is two to five lowercase words`);

    const fixed = p.id === "INV-3007";
    const invoice_date = fixed ? "2026-08-28" : dayBetween(INVOICE_FROM, INVOICE_TO);
    const due_date = addDays(invoice_date, 30);
    const invoice_number = invoiceNumber(v);

    let service_from: string | null;
    let service_to: string | null;
    if (fixed) {
      service_from = "2026-08-24";
      service_to = "2026-08-26";
    } else if (p.utility) {
      service_from = MONTH_START;
      service_to = addDays(invoice_date, -intBetween(2, 5));
    } else {
      service_to = addDays(invoice_date, -intBetween(0, 4));
      service_from = addDays(service_to, -intBetween(0, 6));
    }
    if (p.noDates) {
      service_from = null;
      service_to = null;
    }
    if (service_from !== null && service_to !== null) {
      assert(service_from >= MONTH_START && service_to <= INVOICE_TO && service_from <= service_to, `${p.id} service dates within August and in order`);
    }

    const amount = fixed ? 2400 : centsToAmount(p.utility ? intBetween(6000, 45000) : intBetween(4500, 480000));
    const account_number = p.utility || p.account ? `99${digits(8)}` : null;
    const meter_number = p.utility ? `M9${digits(8)}` : null;

    out.push({
      invoice_id: p.id,
      vendor_id: v.vendor_id,
      property_code: p.property,
      unit_label: p.unit === null ? null : `${p.property}-${p.unit}`,
      invoice_number,
      invoice_date,
      amount,
      due_date,
      service_from,
      service_to,
      account_number,
      meter_number,
      invoice_type: p.utility ? "utility" : "service",
      pdf_path: `${DOC_URL}/${p.id}.pdf`,
      preview_path: `${DOC_URL}/${p.id}.svg`,
      service_short: p.service,
      scripted: p.scripted === true,
      extraction_status: p.failed ? "failed" : "read",
      status: p.utility ? "routed" : p.failed ? "manual" : "ready",
    });
  }
  return out;
}

// ---------- Canned reader output (the ground truth stored beside each document) ----------

function cannedFor(inv: Invoice): ExtractionFields {
  const v = vendorDef(inv.vendor_id);
  if (inv.extraction_status === "failed") {
    // The stylized document: the vendor name sits inside a logo, so the reader returns
    // only what is printed in plain text.
    return {
      vendor_name: null,
      property_hint: inv.property_code,
      unit_hint: null,
      service_short: null,
      service_from: null,
      service_to: null,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      amount: null,
      due_date: null,
      account_number: null,
      meter_number: null,
    };
  }
  return {
    vendor_name: v.name,
    property_hint: inv.property_code,
    unit_hint: inv.unit_label,
    service_short: inv.service_short,
    service_from: inv.service_from,
    service_to: inv.service_to,
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date,
    amount: inv.amount,
    due_date: inv.due_date,
    account_number: inv.account_number,
    meter_number: inv.meter_number,
  };
}

// ---------- Documents (the same invoice as a PDF and as an SVG preview) ----------

interface DocModel {
  vendor: VendorDef;
  stylized: boolean; // vendor name drawn inside a logo shape, no plain vendor line
  title: string;
  meta: [string, string][]; // invoice number, invoice date, due date
  billTo: string[];
  detail: [string, string][]; // service, service period, account number, meter number
  amount: string;
  footer: string[];
}

function docModel(inv: Invoice): DocModel {
  const v = vendorDef(inv.vendor_id);
  const property = propertyByCode.get(inv.property_code)!;
  const detail: [string, string][] = [["Service", inv.service_short ?? ""]];
  if (inv.service_from !== null && inv.service_to !== null) detail.push(["Service period", `${inv.service_from} to ${inv.service_to}`]);
  if (inv.account_number !== null) detail.push(["Account number", inv.account_number]);
  if (inv.meter_number !== null) detail.push(["Meter number", inv.meter_number]);
  return {
    vendor: v,
    stylized: inv.extraction_status === "failed",
    title: inv.invoice_type === "utility" ? "ELECTRIC BILL" : "INVOICE",
    meta: [
      ["Invoice number", inv.invoice_number],
      ["Invoice date", inv.invoice_date],
      ["Due date", inv.due_date],
    ],
    billTo: [
      "Property management office",
      `Property ${inv.property_code}, ${property.name}`,
      property.street,
      inv.unit_label === null ? "Whole property, no unit" : `Unit ${inv.unit_label}`,
    ],
    detail,
    amount: money(inv.amount),
    footer: [
      "Example data for a demo. Every name, address, number, and amount on this document is invented.",
      "Terms: net 30 days from the invoice date.",
    ],
  };
}

// Layout in a 612 by 792 page; y values are baselines measured from the top edge.
const LEFT = 60;
const RIGHT = 400;
const Y = {
  vendor: 84,
  address1: 106,
  address2: 122,
  title: 84,
  metaStart: 112,
  metaStep: 16,
  rule1: 160,
  billToHead: 196,
  billToStart: 214,
  billToStep: 15,
  detailHead: 306,
  detailStart: 326,
  detailStep: 18,
  rule2: 440,
  amountLabel: 470,
  amountValue: 500,
  footer1: 730,
  footer2: 746,
};

const LOGO_WORDS = (name: string) => name.toUpperCase().split(" ");
// The stylized badge on the failed document; the address lines sit below it and above the first rule.
const LOGO = { cx: 190, cy: 82, rx: 125, ry: 40, addressShift: 28 };

async function renderPdf(m: DocModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${m.meta[0][1]}`);
  if (!m.stylized) doc.setAuthor(m.vendor.name); // the stylized document names its vendor nowhere in plain text
  doc.setSubject("Example data for a demo");
  doc.setProducer("ap-automation-demo seed");
  doc.setCreator("ap-automation-demo seed");
  doc.setCreationDate(FIXED_DOC_DATE);
  doc.setModificationDate(FIXED_DOC_DATE);
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.07, 0.07, 0.07);
  const gray = rgb(0.45, 0.45, 0.45);
  const text = (str: string, x: number, yTop: number, size: number, f: PDFFont = font, color = black) => page.drawText(str, { x, y: 792 - yTop, size, font: f, color });
  const rule = (yTop: number) => page.drawLine({ start: { x: LEFT, y: 792 - yTop }, end: { x: 552, y: 792 - yTop }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });

  if (m.stylized) drawPdfLogo(page, bold, m.vendor.name);
  else text(m.vendor.name, LEFT, Y.vendor, 22, bold);
  text(m.vendor.address[0], LEFT, m.stylized ? Y.address1 + LOGO.addressShift : Y.address1, 10);
  text(m.vendor.address[1], LEFT, m.stylized ? Y.address2 + LOGO.addressShift : Y.address2, 10);

  text(m.title, RIGHT, Y.title, 20, bold);
  m.meta.forEach(([label, value], i) => {
    const y = Y.metaStart + i * Y.metaStep;
    text(`${label}:`, RIGHT, y, 10, bold);
    text(value, RIGHT + 90, y, 10);
  });
  rule(Y.rule1);

  text("Bill to", LEFT, Y.billToHead, 11, bold);
  m.billTo.forEach((line, i) => text(line, LEFT, Y.billToStart + i * Y.billToStep, 10));

  text("Details", LEFT, Y.detailHead, 11, bold);
  m.detail.forEach(([label, value], i) => {
    const y = Y.detailStart + i * Y.detailStep;
    text(`${label}:`, LEFT, y, 11, bold);
    text(value, LEFT + 120, y, 11);
  });
  rule(Y.rule2);

  text("Amount due", LEFT, Y.amountLabel, 12, bold);
  text(m.amount, LEFT, Y.amountValue, 22, bold);

  text(m.footer[0], LEFT, Y.footer1, 9, font, gray);
  text(m.footer[1], LEFT, Y.footer2, 9, font, gray);
  return doc.save();
}

function drawPdfLogo(page: PDFPage, bold: PDFFont, name: string) {
  // A badge with the vendor name broken across rotated, spaced lines. Nothing else on
  // the page names the vendor in plain text.
  const cx = LOGO.cx;
  const cy = 792 - LOGO.cy;
  page.drawEllipse({ x: cx, y: cy, xScale: LOGO.rx, yScale: LOGO.ry, color: rgb(0.86, 0.86, 0.86), borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 3 });
  page.drawEllipse({ x: cx, y: cy, xScale: LOGO.rx - 12, yScale: LOGO.ry - 9, borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 1 });
  const words = LOGO_WORDS(name);
  const rows = [
    { word: words[0] ?? "", size: 16, dy: 2, rot: 7 },
    { word: words.slice(1).join(" "), size: 8, dy: -17, rot: -5 },
  ];
  for (const row of rows) {
    const spaced = row.word.split("").join(" ");
    const width = bold.widthOfTextAtSize(spaced, row.size);
    page.drawText(spaced, { x: cx - width / 2, y: cy + row.dy, size: row.size, font: bold, color: rgb(0.15, 0.15, 0.15), rotate: degrees(row.rot) });
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderSvg(m: DocModel): string {
  const parts: string[] = [];
  const text = (str: string, x: number, y: number, size: number, opts: { bold?: boolean; fill?: string; extra?: string } = {}) =>
    parts.push(`<text x="${x}" y="${y}" font-size="${size}"${opts.bold ? ' font-weight="bold"' : ""}${opts.fill ? ` fill="${opts.fill}"` : ""}${opts.extra ?? ""}>${esc(str)}</text>`);
  const rule = (y: number) => parts.push(`<line x1="${LEFT}" y1="${y}" x2="552" y2="${y}" stroke="#4d4d4d" stroke-width="1"/>`);

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612" height="792" font-family="Helvetica, Arial, sans-serif" fill="#121212">`);
  parts.push(`<rect x="0" y="0" width="612" height="792" fill="#ffffff"/>`);

  if (m.stylized) {
    const cx = LOGO.cx;
    const cy = LOGO.cy;
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${LOGO.rx}" ry="${LOGO.ry}" fill="#dbdbdb" stroke="#333333" stroke-width="3"/>`);
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${LOGO.rx - 12}" ry="${LOGO.ry - 9}" fill="none" stroke="#333333" stroke-width="1"/>`);
    const words = LOGO_WORDS(m.vendor.name);
    text(words[0] ?? "", cx, cy - 2, 16, { bold: true, fill: "#262626", extra: ` text-anchor="middle" letter-spacing="5" transform="rotate(-7 ${cx} ${cy})"` });
    text(words.slice(1).join(" "), cx, cy + 17, 8, { bold: true, fill: "#262626", extra: ` text-anchor="middle" letter-spacing="3" transform="rotate(5 ${cx} ${cy})"` });
    text(m.vendor.address[0], LEFT, Y.address1 + LOGO.addressShift, 10);
    text(m.vendor.address[1], LEFT, Y.address2 + LOGO.addressShift, 10);
  } else {
    text(m.vendor.name, LEFT, Y.vendor, 22, { bold: true });
    text(m.vendor.address[0], LEFT, Y.address1, 10);
    text(m.vendor.address[1], LEFT, Y.address2, 10);
  }

  text(m.title, RIGHT, Y.title, 20, { bold: true });
  m.meta.forEach(([label, value], i) => {
    const y = Y.metaStart + i * Y.metaStep;
    text(`${label}:`, RIGHT, y, 10, { bold: true });
    text(value, RIGHT + 90, y, 10);
  });
  rule(Y.rule1);

  text("Bill to", LEFT, Y.billToHead, 11, { bold: true });
  m.billTo.forEach((line, i) => text(line, LEFT, Y.billToStart + i * Y.billToStep, 10));

  text("Details", LEFT, Y.detailHead, 11, { bold: true });
  m.detail.forEach(([label, value], i) => {
    const y = Y.detailStart + i * Y.detailStep;
    text(`${label}:`, LEFT, y, 11, { bold: true });
    text(value, LEFT + 120, y, 11);
  });
  rule(Y.rule2);

  text("Amount due", LEFT, Y.amountLabel, 12, { bold: true });
  text(m.amount, LEFT, Y.amountValue, 22, { bold: true });

  text(m.footer[0], LEFT, Y.footer1, 9, { fill: "#737373" });
  text(m.footer[1], LEFT, Y.footer2, 9, { fill: "#737373" });
  parts.push("</svg>");
  return parts.join("\n") + "\n";
}

// ---------- Self checks on the emitted text (mirror of the suite marker rules) ----------

function checkMarkers(label: string, text: string) {
  for (const m of text.matchAll(/\b\d{10}\b/g)) assert(m[0].startsWith("99"), `${label}: ten digit number ${m[0]} starts with 99`);
  for (const m of text.matchAll(/\bM\d{6,}\b/g)) assert(m[0].startsWith("M9"), `${label}: meter-like ${m[0]} starts with M9`);
  for (const m of text.matchAll(/\bv\d{4,}\b/g)) assert(m[0].startsWith("v99"), `${label}: vendor-like ${m[0]} starts with v99`);
  for (const m of text.matchAll(/\b0\d{6}\b/g)) assert(m[0].startsWith("0999"), `${label}: property-like ${m[0]} starts with 0999`);
  for (const m of text.matchAll(/\bINV-\d{4,}\b/g)) assert(/^INV-30\d{2}$/.test(m[0]), `${label}: invoice id ${m[0]} in range`);
  for (const m of text.matchAll(/\bV-\d{2,}\b/g)) assert(/^V-(0[1-9]|1[0-4])$/.test(m[0]), `${label}: vendor id ${m[0]} in range`);
  assert(!text.includes("\u2014"), `${label}: no em dash`);
}

// ---------- Build, assert, write ----------

const vendors: Vendor[] = VENDOR_DEFS.map(({ vendor_id, name, service_type, default_gl }) => ({ vendor_id, name, service_type, default_gl }));
const coding_history = buildCodingHistory();
const invoices = buildInvoices();
const seed: Seed = { vendors, gl_accounts: GL_ACCOUNTS, coding_history, invoices };

// Vendors
assert(vendors.length === 14, "14 vendors");
assert(vendors.filter((v) => v.service_type === "single" && v.default_gl !== null).length === 9, "9 single-service vendors with a default code");
assert(vendors.filter((v) => v.service_type === "multi").length === 4, "4 multi-service vendors");
assert(vendors.filter((v) => v.default_gl === null && v.service_type === "single").length === 1, "1 unseen vendor");
assert(vendors.every((v) => v.default_gl === null || GL_CODES.includes(v.default_gl as (typeof GL_CODES)[number])), "default codes are in the chart");
assert(vendors.every((v) => v.vendor_id === UTILITY_VENDOR || (v.default_gl !== "6110" && v.default_gl !== "6120")), "only the utility vendor defaults to a utility code");
assert(vendors.every((v) => !/[0-9]/.test(v.name)), "vendor names carry no digits");

// Coding history
assert(coding_history.every((r) => r.vendor_id !== UNSEEN_VENDOR), "the unseen vendor has no history");
for (const v of vendors) {
  const rows = coding_history.filter((r) => r.vendor_id === v.vendor_id);
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (v.vendor_id === UNSEEN_VENDOR) assert(rows.length === 0, "V-14 has no rows");
  else if (v.service_type === "single") assert(rows.length === 1 && rows[0].gl_code === v.default_gl && total >= 6 && total <= 20, `${v.vendor_id} single history`);
  else assert(rows.length >= 2 && rows.length <= 3 && total >= 6 && total <= 20, `${v.vendor_id} multi history`);
}
const historyTotal = (id: string) => coding_history.filter((r) => r.vendor_id === id).reduce((s, r) => s + r.count, 0);
assert(historyTotal("V-01") === 16 && historyTotal("V-03") === 15, "V-01 is 14 of 16 and V-03 is 9 of 15");
const pestRow = coding_history.find((r) => r.vendor_id === PEST_VENDOR)!;
assert(pestRow.gl_code === "7410" && pestRow.count >= 8, "pest control vendor has at least 8 codings on 7410");

// Invoices
assert(invoices.length === 30, "30 invoices");
invoices.forEach((inv, i) => assert(inv.invoice_id === `INV-${3004 + i}`, `contiguous ids from INV-3004 (${inv.invoice_id})`));
const byType = (t: "single" | "multi") => invoices.filter((inv) => vendorDef(inv.vendor_id).service_type === t).length;
assert(byType("single") === 22 && byType("multi") === 8, "22 single-service and 8 multi-service invoices");
const count = (s: Invoice["status"]) => invoices.filter((inv) => inv.status === s).length;
assert(count("ready") === 27 && count("manual") === 1 && count("routed") === 2, "27 ready, 1 manual, 2 routed");
assert(invoices.filter((inv) => inv.scripted).map((inv) => inv.invoice_id).join(",") === "INV-3007,INV-3012,INV-3019,INV-3021,INV-3025,INV-3030,INV-3033", "the seven scripted ids");
assert(invoices.filter((inv) => inv.invoice_type === "utility").every((inv) => inv.vendor_id === UTILITY_VENDOR && inv.account_number !== null && inv.meter_number !== null && inv.unit_label === null), "utility bills come from V-09 with account and meter");
assert(new Set(invoices.filter((inv) => inv.invoice_type === "utility").map((inv) => inv.property_code)).size === 2, "the two utility bills are on different properties");
assert(invoices.every((inv) => inv.due_date === addDays(inv.invoice_date, 30)), "due dates are 30 days after invoice dates");
assert(invoices.every((inv) => inv.invoice_date >= INVOICE_FROM && inv.invoice_date <= INVOICE_TO), "invoice dates in the window");
assert(invoices.every((inv) => /^[A-Z]{2}-\d{5}$/.test(inv.invoice_number)), "invoice numbers are two letters and five digits");
assert(new Set(invoices.map((inv) => inv.invoice_number)).size === 30, "invoice numbers are unique");
assert(invoices.every((inv) => (inv.invoice_type === "utility" ? inv.amount >= 60 && inv.amount <= 450 : inv.amount >= 45 && inv.amount <= 4800)), "amounts in range");
assert(invoices.every((inv) => /^\d+(\.\d{1,2})?$/.test(String(inv.amount))), "amounts have at most two decimals");
const serviceInvoices = invoices.filter((inv) => inv.invoice_type === "service");
const noUnit = serviceInvoices.filter((inv) => inv.unit_label === null).length;
assert(noUnit >= 6 && noUnit <= 8, `around a quarter of service invoices have no unit (${noUnit} of ${serviceInvoices.length})`);
assert(serviceInvoices.every((inv) => inv.meter_number === null), "service invoices carry no meter number");
assert(serviceInvoices.filter((inv) => inv.account_number !== null).map((inv) => inv.invoice_id).join(",") === "INV-3033", "only INV-3033 prints a customer account among service invoices");

const inv3007 = invoices[3];
assert(inv3007.invoice_id === "INV-3007" && inv3007.vendor_id === "V-01" && inv3007.property_code === "PR" && inv3007.unit_label === "PR-12", "INV-3007 identity");
assert(inv3007.invoice_number === "CR-88213" && inv3007.invoice_date === "2026-08-28" && inv3007.amount === 2400 && inv3007.due_date === "2026-09-27", "INV-3007 header fields");
assert(inv3007.service_from === "2026-08-24" && inv3007.service_to === "2026-08-26" && inv3007.account_number === null && inv3007.meter_number === null, "INV-3007 service fields");
assert(inv3007.invoice_type === "service" && inv3007.service_short === "roof leak repair" && inv3007.scripted && inv3007.extraction_status === "read" && inv3007.status === "ready", "INV-3007 outcome");
assert(`${vendorDef("V-01").name} ${inv3007.service_short} ${inv3007.property_code} ${inv3007.unit_label} ${inv3007.service_from} to ${inv3007.service_to}` === "Coral Ridge Roofing roof leak repair PR PR-12 2026-08-24 to 2026-08-26", "INV-3007 description text");

const byId = (id: string) => invoices.find((inv) => inv.invoice_id === id)!;
const inv3012 = byId("INV-3012");
assert(inv3012.vendor_id === PEST_VENDOR && inv3012.service_from === null && inv3012.service_to === null && inv3012.unit_label !== null && inv3012.status === "ready", "INV-3012 prints no service dates");
const inv3019 = byId("INV-3019");
assert(inv3019.vendor_id === UNSEEN_VENDOR && inv3019.service_from !== null && inv3019.status === "ready", "INV-3019 unseen vendor");
const inv3021 = byId("INV-3021");
assert(vendorDef(inv3021.vendor_id).service_type === "multi" && inv3021.vendor_id !== "V-01" && inv3021.vendor_id !== "V-03" && inv3021.extraction_status === "failed" && inv3021.status === "manual", "INV-3021 stylized, manual");
const inv3025 = byId("INV-3025");
assert(inv3025.vendor_id === UTILITY_VENDOR && inv3025.invoice_type === "utility" && inv3025.status === "routed" && inv3025.service_short === "electric service", "INV-3025 routed utility");
const inv3030 = byId("INV-3030");
assert(inv3030.vendor_id === "V-03" && inv3030.service_from !== null && inv3030.unit_label !== null && inv3030.account_number === null && inv3030.status === "ready", "INV-3030 plumbing");
const inv3033 = byId("INV-3033");
assert(inv3033.vendor_id === "V-02" && inv3033.account_number !== null && /^99\d{8}$/.test(inv3033.account_number) && inv3033.meter_number === null && inv3033.status === "ready", "INV-3033 carries a customer account");

// Canned
const canned = new Map<string, ExtractionFields>(invoices.map((inv) => [inv.invoice_id, cannedFor(inv)]));
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const inv of invoices) {
  const c = canned.get(inv.invoice_id)!;
  assert(Object.keys(c).length === 12, `${inv.invoice_id} canned has every key`);
  if (inv.extraction_status === "read") {
    assert(c.amount !== null && c.amount > 0 && c.vendor_name !== null && normalize(c.vendor_name) === normalize(vendorDef(inv.vendor_id).name), `${inv.invoice_id} canned passes the checks`);
    if (c.service_from !== null && c.service_to !== null) assert(c.service_from <= c.service_to, `${inv.invoice_id} canned dates in order`);
  } else {
    assert(c.vendor_name === null && c.amount === null && c.property_hint === inv.property_code && c.invoice_number === inv.invoice_number && c.invoice_date === inv.invoice_date, `${inv.invoice_id} canned fails the checks as scripted`);
  }
}

// Write
fs.mkdirSync(CANNED_DIR, { recursive: true });
fs.mkdirSync(DOC_DIR, { recursive: true });
for (const stale of fs.readdirSync(CANNED_DIR)) if (stale.endsWith(".json")) fs.unlinkSync(path.join(CANNED_DIR, stale));
for (const stale of fs.readdirSync(DOC_DIR)) if (stale.endsWith(".pdf") || stale.endsWith(".svg")) fs.unlinkSync(path.join(DOC_DIR, stale));

const seedText = JSON.stringify(seed, null, 2) + "\n";
checkMarkers("seed.json", seedText);
fs.writeFileSync(path.join(SEED_DIR, "seed.json"), seedText);

(async () => {
  for (const inv of invoices) {
    const cannedText = JSON.stringify(canned.get(inv.invoice_id), null, 2) + "\n";
    checkMarkers(`canned/${inv.invoice_id}.json`, cannedText);
    fs.writeFileSync(path.join(CANNED_DIR, `${inv.invoice_id}.json`), cannedText);

    const model = docModel(inv);
    const svg = renderSvg(model);
    checkMarkers(`${inv.invoice_id}.svg`, svg);
    for (const [, value] of [...model.meta, ...model.detail]) assert(svg.includes(esc(value)), `${inv.invoice_id}.svg prints ${value}`);
    assert(svg.includes(esc(model.amount)), `${inv.invoice_id}.svg prints the amount`);
    assert(model.stylized ? !svg.includes(esc(model.vendor.name)) : svg.includes(esc(model.vendor.name)), `${inv.invoice_id}.svg vendor line matches the canned reading`);
    fs.writeFileSync(path.join(DOC_DIR, `${inv.invoice_id}.svg`), svg);
    fs.writeFileSync(path.join(DOC_DIR, `${inv.invoice_id}.pdf`), await renderPdf(model));
  }

  const single = invoices.filter((inv) => vendorDef(inv.vendor_id).service_type === "single").length;
  console.log(`seed written: ${vendors.length} vendors, ${GL_ACCOUNTS.length} gl accounts, ${coding_history.length} coding history rows, ${invoices.length} invoices`);
  console.log(`invoices: ${single} single-service, ${invoices.length - single} multi-service; ${count("ready")} ready, ${count("manual")} manual, ${count("routed")} routed`);
  console.log(`canned: ${invoices.length} files; documents: ${invoices.length} pdf and ${invoices.length} svg in public${DOC_URL}`);
})();

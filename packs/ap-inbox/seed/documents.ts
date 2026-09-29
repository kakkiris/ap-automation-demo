import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

// Document rendering for the intake seed: 24 PDFs with pdf-lib and two SVGs that look
// like a phone photo of handwritten notes and a grey mail scan. Every document prints
// the same payee, invoice number, date, addresses, lines and total that its canned
// extraction returns, so the presenter sees one set of numbers.
//
// pdf-lib names font resources with Math.random. The seed must be byte-identical run to
// run, so Math.random is replaced with a seeded generator before any PDF is built. That
// is the only reason it is touched; no seed value comes from it.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}
const docRand = mulberry32(20260827);
Math.random = () => docRand();

const FIXED_DATE = new Date("2026-08-01T12:00:00Z");
const PRODUCER = "ap-automation-demo seed";
const LETTER: [number, number] = [612, 792];
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.45);
const RULE = rgb(0.78, 0.78, 0.76);
const BLOCK = rgb(0.72, 0.72, 0.7);

export interface VendorBlock {
  name: string;
  street: string;
  cityLine: string;
  phone: string;
}

export interface DocLine {
  description: string;
  address: string | null;
  amount: string | null; // as printed, "60.00"
  chargeType: string | null;
}

export type DocKind = "invoice" | "list" | "statement" | "utility";

export interface DocumentSpec {
  itemId: string;
  fileName: string;
  kind: DocKind;
  vendor: VendorBlock;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string | null;
  billTo: string[];
  serviceLines: string[]; // printed under "Service address"
  parcelRefs: string[];
  utilityAccountNumber: string | null;
  lines: DocLine[];
  total: string | null; // null draws a grey block where the total would be (unreadable)
  note: string | null;
  extra: string[]; // free lines printed under the header (billing period, usage)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

class Sheet {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(LETTER);
    this.y = 736;
  }
  ensure(height: number) {
    if (this.y - height < 64) this.newPage();
  }
  text(s: string, x: number, size = 10, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; y?: number } = {}) {
    this.page.drawText(s, { x, y: opts.y ?? this.y, size, font: opts.bold ? this.bold : this.font, color: opts.color ?? INK });
  }
  right(s: string, rightX: number, size = 10, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; y?: number } = {}) {
    const f = opts.bold ? this.bold : this.font;
    const w = f.widthOfTextAtSize(s, size);
    this.page.drawText(s, { x: rightX - w, y: opts.y ?? this.y, size, font: f, color: opts.color ?? INK });
  }
  rule(y = this.y, x1 = 54, x2 = 558) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: RULE });
  }
  down(h: number) {
    this.y -= h;
  }
}

function title(kind: DocKind): string {
  if (kind === "statement") return "STATEMENT";
  if (kind === "utility") return "BILL";
  return "INVOICE";
}

async function renderPdf(spec: DocumentSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title(spec.kind)} ${spec.invoiceNumber}`);
  doc.setAuthor(spec.vendor.name);
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const s = new Sheet(doc, font, bold);

  // Vendor block, left; document title and numbers, right.
  s.text(spec.vendor.name, 54, 16, { bold: true });
  s.right(title(spec.kind), 558, 20, { bold: true, color: MUTED });
  s.down(16);
  s.text(spec.vendor.street, 54, 9.5, { color: MUTED });
  s.down(12);
  s.text(spec.vendor.cityLine, 54, 9.5, { color: MUTED });
  s.down(12);
  s.text(spec.vendor.phone, 54, 9.5, { color: MUTED });

  let ry = 714;
  const label = spec.kind === "utility" ? "Statement number" : spec.kind === "statement" ? "Statement number" : "Invoice number";
  s.right(`${label}  ${spec.invoiceNumber}`, 558, 10, { y: ry });
  ry -= 13;
  s.right(`${spec.kind === "utility" || spec.kind === "statement" ? "Statement date" : "Invoice date"}  ${prettyDate(spec.invoiceDate)}`, 558, 10, { y: ry });
  if (spec.dueDate) {
    ry -= 13;
    s.right(`Due date  ${prettyDate(spec.dueDate)}`, 558, 10, { y: ry });
  }
  if (spec.utilityAccountNumber) {
    ry -= 13;
    s.right(`Account number  ${spec.utilityAccountNumber}`, 558, 10, { y: ry, bold: true });
  }

  s.y = 660;
  s.rule();
  s.down(20);

  // Bill to block.
  s.text("Bill to", 54, 9, { bold: true, color: MUTED });
  s.down(13);
  for (const line of spec.billTo) {
    s.text(line, 54, 10);
    s.down(12);
  }

  // Service address block, right column of the same band.
  if (spec.serviceLines.length > 0 || spec.parcelRefs.length > 0) {
    let sy = 640;
    s.text(spec.kind === "utility" ? "Service address" : "Service address", 330, 9, { bold: true, color: MUTED, y: sy });
    sy -= 13;
    for (const line of spec.serviceLines) {
      s.text(line, 330, 10, { y: sy });
      sy -= 12;
    }
    for (const ref of spec.parcelRefs) {
      s.text(`Parcel ${ref}`, 330, 10, { y: sy });
      sy -= 12;
    }
  }

  s.y = Math.min(s.y, 570);
  for (const line of spec.extra) {
    s.text(line, 54, 10, { color: MUTED });
    s.down(13);
  }
  s.down(8);

  if (spec.kind === "statement") {
    s.text("Property", 54, 9, { bold: true, color: MUTED });
    s.text("Charge", 330, 9, { bold: true, color: MUTED });
    s.right("Amount", 558, 9, { bold: true, color: MUTED });
    s.down(6);
    s.rule();
    s.down(18);
    let n = 1;
    for (const line of spec.lines) {
      s.ensure(44);
      s.text(`${n}.  ${line.address ?? ""}`, 54, 10.5, { bold: true });
      s.down(14);
      s.text(line.description, 70, 9.5, { color: MUTED });
      s.text(line.chargeType ? `Charge type: ${line.chargeType}` : "", 330, 9.5, { color: MUTED });
      s.right(line.amount ?? "", 558, 10.5);
      s.down(9);
      s.rule(s.y, 70, 558);
      s.down(15);
      n++;
    }
  } else {
    s.text("Description", 54, 9, { bold: true, color: MUTED });
    if (spec.lines.some((l) => l.address)) s.text("Property", 300, 9, { bold: true, color: MUTED });
    s.right("Amount", 558, 9, { bold: true, color: MUTED });
    s.down(6);
    s.rule();
    s.down(16);
    for (const line of spec.lines) {
      s.ensure(20);
      s.text(line.description, 54, 10);
      if (line.address) s.text(line.address, 300, 10);
      if (line.amount !== null) s.right(line.amount, 558, 10);
      s.down(16);
    }
  }

  s.ensure(48);
  s.down(4);
  s.rule(s.y, 330, 558);
  s.down(20);
  const totalLabel = spec.kind === "utility" ? "Amount due" : spec.kind === "statement" ? "Statement total" : "Total due";
  s.text(totalLabel, 330, 12, { bold: true });
  if (spec.total === null) {
    // The amount is not printed anywhere: a grey block stands where it would be.
    s.page.drawRectangle({ x: 470, y: s.y - 6, width: 88, height: 20, color: BLOCK });
  } else {
    s.right(spec.total, 558, 13, { bold: true });
  }
  s.down(30);

  if (spec.note) {
    s.text(spec.note, 54, 9.5, { color: MUTED });
    s.down(14);
  }
  s.text("Thank you for your business.", 54, 9, { color: MUTED });

  return doc.save({ useObjectStreams: false });
}

// SVG helpers. Text is escaped; no em dash appears anywhere.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface NotesSvgSpec {
  heading: string;
  subheading: string;
  refLine: string;
  lots: string[];
  totalLine: string;
  footer: string;
}

/** A phone photo of a ruled notepad page with handwritten lots. */
export function renderNotesSvg(spec: NotesSvgSpec): string {
  const w = 900;
  const h = 1240;
  const hand = "'Bradley Hand', 'Segoe Script', 'Comic Sans MS', 'Chalkboard SE', cursive";
  const rows: string[] = [];
  let y = 236;
  const jitter = () => (docRand() * 1.6 - 0.8).toFixed(2);
  const push = (text: string, size: number, x = 214, weight = "normal", fill = "#1d2b6b") => {
    rows.push(
      `<text x="${x}" y="${y}" font-family="${hand}" font-size="${size}" font-weight="${weight}" fill="${fill}" transform="rotate(${jitter()} ${x} ${y})">${esc(text)}</text>`,
    );
  };
  push(spec.heading, 36, 214, "bold");
  y += 46;
  push(spec.subheading, 26);
  y += 46;
  push(spec.refLine, 26);
  y += 60;
  for (const lot of spec.lots) {
    push(lot, 27);
    y += 46;
  }
  y += 24;
  push(spec.totalLine, 32, 214, "bold");
  y += 50;
  push(spec.footer, 22, 214, "normal", "#4a5580");

  const ruled: string[] = [];
  for (let ly = 200; ly < 1120; ly += 46) {
    ruled.push(`<line x1="128" y1="${ly}" x2="772" y2="${ly}" stroke="#b6c4d9" stroke-width="1.4"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="vignette" cx="50%" cy="44%" r="74%">
      <stop offset="58%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f2e6"/>
      <stop offset="100%" stop-color="#e9e2d0"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="0.35"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="#3b3731"/>
  <rect x="60" y="1130" width="780" height="70" fill="#2d2a25" opacity="0.6"/>
  <g transform="translate(450 620) rotate(-2.6) translate(-450 -620)">
    <rect x="122" y="112" width="668" height="1030" fill="#000" opacity="0.28" transform="translate(10 12)"/>
    <rect x="118" y="108" width="668" height="1030" fill="url(#paper)"/>
    <line x1="196" y1="108" x2="196" y2="1138" stroke="#e0a1a1" stroke-width="1.6"/>
    ${ruled.join("\n    ")}
    <g filter="url(#soft)">
      ${rows.join("\n      ")}
    </g>
  </g>
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)"/>
</svg>
`;
}

export interface ScanSvgSpec {
  vendor: VendorBlock;
  billTo: string[];
  invoiceNumber: string;
  invoiceDate: string;
  lines: { description: string; amount: string }[];
  total: string;
}

/** A grey, slightly skewed mail scan; the total is printed faintly on purpose. */
export function renderScanSvg(spec: ScanSvgSpec): string {
  const w = 850;
  const h = 1100;
  const sans = "Helvetica, Arial, sans-serif";
  const t = (text: string, x: number, y: number, size: number, fill = "#4b4b50", weight = "normal", anchor = "start") =>
    `<text x="${x}" y="${y}" font-family="${sans}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`;
  const body: string[] = [];
  body.push(t(spec.vendor.name, 110, 150, 26, "#3f3f44", "bold"));
  body.push(t(spec.vendor.street, 110, 176, 14));
  body.push(t(spec.vendor.cityLine, 110, 196, 14));
  body.push(t(spec.vendor.phone, 110, 216, 14));
  body.push(t("INVOICE", 740, 150, 30, "#6b6b70", "bold", "end"));
  body.push(t(`Invoice number  ${spec.invoiceNumber}`, 740, 182, 14, "#4b4b50", "normal", "end"));
  body.push(t(`Invoice date  ${prettyDate(spec.invoiceDate)}`, 740, 202, 14, "#4b4b50", "normal", "end"));
  body.push(`<line x1="110" y1="250" x2="740" y2="250" stroke="#a9a9a6" stroke-width="1"/>`);
  body.push(t("Bill to", 110, 282, 12, "#7a7a7e", "bold"));
  let y = 302;
  for (const line of spec.billTo) {
    body.push(t(line, 110, y, 14));
    y += 19;
  }
  y = 420;
  body.push(t("Description", 110, y, 12, "#7a7a7e", "bold"));
  body.push(t("Amount", 740, y, 12, "#7a7a7e", "bold", "end"));
  body.push(`<line x1="110" y1="${y + 10}" x2="740" y2="${y + 10}" stroke="#a9a9a6" stroke-width="1"/>`);
  y += 38;
  for (const line of spec.lines) {
    body.push(t(line.description, 110, y, 14));
    body.push(t(line.amount, 740, y, 14, "#5a5a5e", "normal", "end"));
    y += 26;
  }
  y += 20;
  body.push(`<line x1="470" y1="${y}" x2="740" y2="${y}" stroke="#a9a9a6" stroke-width="1"/>`);
  y += 34;
  body.push(t("Total due", 470, y, 17, "#4b4b50", "bold"));
  body.push(`<g filter="url(#blur)" opacity="0.62">${t(spec.total, 740, y, 18, "#9c9c98", "bold", "end")}</g>`);
  y += 60;
  body.push(t("Thank you for your business.", 110, y, 12, "#8a8a8e"));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ececea"/>
      <stop offset="100%" stop-color="#d9d9d5"/>
    </linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0.16"/>
      <stop offset="18%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" seed="11" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/>
    </filter>
    <filter id="blur"><feGaussianBlur stdDeviation="0.9"/></filter>
    <filter id="smear"><feGaussianBlur stdDeviation="0.25"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="#c9c9c6"/>
  <g transform="translate(425 550) rotate(1.7) skewX(-2.2) translate(-425 -550)">
    <rect x="44" y="34" width="762" height="1032" fill="url(#sheet)"/>
    <rect x="44" y="34" width="762" height="1032" fill="url(#shade)"/>
    <g filter="url(#smear)">
      ${body.join("\n      ")}
    </g>
    <rect x="44" y="34" width="762" height="1032" fill="none" stroke="#b5b5b1" stroke-width="2"/>
  </g>
  <rect width="${w}" height="${h}" filter="url(#noise)"/>
</svg>
`;
}

export async function writePdf(outDir: string, spec: DocumentSpec): Promise<number> {
  const bytes = await renderPdf(spec);
  fs.writeFileSync(path.join(outDir, spec.fileName), bytes);
  return bytes.length;
}

export function writeSvg(outDir: string, fileName: string, svg: string): number {
  fs.writeFileSync(path.join(outDir, fileName), svg);
  return Buffer.byteLength(svg);
}

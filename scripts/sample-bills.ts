import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Seed } from "../packs/utility-bills-to-yardi/types";

// Five synthetic bill PDFs for the drop zone: A-5, B-4, B-6, B-7, and one clean bill.
// Layout: provider block, account number, service address, service period, a meter
// summary block with the meter number as printed, amount due. Names and numbers come
// from the seed, so every figure is example data.
const seed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed.json"), "utf8")) as Seed;
const outDir = path.join(process.cwd(), "public", "sample-bills");
fs.mkdirSync(outDir, { recursive: true });

const august = seed.bills.filter((b) => b.arrival_month === seed.demo_month);
const clean = august.find((b) => b.provider === "Fairshore Power" && b.meter_as_printed && seed.accounts.some((a) => a.account_number === b.account_number) && !Object.values(seed.scripted).includes(b.id))!;
const picks: [string, string][] = [["A-5", seed.scripted["A-5"]], ["B-4", seed.scripted["B-4"]], ["B-6", seed.scripted["B-6"]], ["B-7", seed.scripted["B-7"]], ["clean", clean.id]];

async function render(name: string, billId: string) {
  const bill = seed.bills.find((b) => b.id === billId)!;
  const property = seed.properties.find((p) => p.id === bill.property_id)!;
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 740;
  const line = (text: string, size = 11, f = font, color = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(text, { x: 60, y, size, font: f, color });
    y -= size + 8;
  };
  line(bill.provider, 22, bold);
  line("Utility statement", 12);
  line("Example data for a demo. Not a real bill.", 9, font, rgb(0.5, 0.5, 0.5));
  y -= 10;
  line(`Account number: ${bill.account_number}`, 12, bold);
  line(`Service address: ${bill.service_address}`);
  line(`Property: ${property.name}, ${property.city}`);
  line(`Service period: ${bill.service_start} to ${bill.service_end}`);
  y -= 10;
  page.drawRectangle({ x: 55, y: y - 40, width: 320, height: 56, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
  line("Meter summary", 11, bold);
  line(`Meter number: ${bill.meter_as_printed ?? "not printed"}`);
  line("Read type: actual", 10);
  y -= 20;
  line(`Amount due: $${bill.amount.toFixed(2)}`, 16, bold);
  line(`Due date: ${bill.service_end.slice(0, 8)}25`, 11);
  y -= 20;
  line("This statement carries no invoice number.", 9, font, rgb(0.4, 0.4, 0.4));
  line(`Reference: ${name}.pdf resolves to bill ${bill.id} in the demo.`, 9, font, rgb(0.4, 0.4, 0.4));
  fs.writeFileSync(path.join(outDir, `${name}.pdf`), await doc.save());
}

(async () => {
  for (const [name, id] of picks) await render(name, id);
  console.log(`sample bills written: ${picks.map(([n]) => n + ".pdf").join(", ")}`);
})();
